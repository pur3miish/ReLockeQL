import { deepStrictEqual, match, strictEqual } from "assert";

import { RelockeQL } from "../src/relockeql.js";

const transactionId = "a".repeat(64);

const action = {
  act: {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: "alice", permission: "active" }],
    data: {
      from: "alice",
      to: "bob",
      quantity: "1.0000 A",
      memo: "hello"
    }
  },
  block_num: 123,
  global_sequence: "9007199254740993",
  receipts: [{ receiver: "alice" }, { receiver: "bob" }],
  timestamp: "2026-08-15T10:00:00.000",
  trx_id: transactionId
};

describe("Hyperion history", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("gets one transaction from the separately configured Hyperion endpoint", async () => {
    let requestedUrl: URL | undefined;

    globalThis.fetch = async (input) => {
      requestedUrl = new URL(input.toString());

      return new Response(
        JSON.stringify({
          actions: [action],
          block_num: 123,
          executed: true,
          last_indexed_block: 130,
          last_indexed_block_time: "2026-08-15T10:00:03.000",
          lib: 125,
          query_time_ms: 2.5,
          timestamp: action.timestamp,
          trx_id: transactionId
        })
      );
    };

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_transaction_by_id(id: "${transactionId}") {
                  transaction_id
                  block_num
                  executed
                  actions {
                    contract
                    action
                    actors
                    receivers
                    data
                  }
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(result.errors, undefined);
    strictEqual(requestedUrl?.origin, "https://history.example");
    strictEqual(requestedUrl?.pathname, "/v2/history/get_transaction");
    strictEqual(requestedUrl?.searchParams.get("id"), transactionId);
    deepStrictEqual(
      result.data?.vaulta.get_blockchain.get_transaction_by_id.actions[0].data,
      action.act.data
    );
  });

  it("searches bounded recent token transfers without offset or ascending scans", async () => {
    let requestedUrl: URL | undefined;

    globalThis.fetch = async (input) => {
      requestedUrl = new URL(input.toString());

      return new Response(
        JSON.stringify({ actions: [action], query_time_ms: 1.25 })
      );
    };

    const before = "2026-08-15T10:00:00Z";
    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_token_transfers(
                  account: "alice"
                  contract: "eosio.token"
                  before: "${before}"
                  limit: 10
                ) {
                  query_time_ms
                  actions {
                    transaction_id
                    data
                  }
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(result.errors, undefined);
    strictEqual(requestedUrl?.pathname, "/v2/history/get_actions");
    strictEqual(requestedUrl?.searchParams.get("account"), "alice");
    strictEqual(
      requestedUrl?.searchParams.get("filter"),
      "eosio.token:transfer"
    );
    strictEqual(requestedUrl?.searchParams.get("before"), before);
    strictEqual(requestedUrl?.searchParams.get("limit"), "10");
    strictEqual(requestedUrl?.searchParams.get("sort"), "desc");
    strictEqual(requestedUrl?.searchParams.get("hot_only"), "true");
    strictEqual(requestedUrl?.searchParams.get("noBinary"), "true");
    strictEqual(requestedUrl?.searchParams.has("skip"), false);
    deepStrictEqual(
      result.data?.vaulta.get_blockchain.get_token_transfers.actions[0].data,
      action.act.data
    );
  });

  it("rejects history queries when the chain has no Hyperion endpoint", async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response("{}");
    };

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_transaction_by_id(id: "${transactionId}") {
                  transaction_id
                }
              }
            }
          }
        `
      },
      { chains: { vaulta: "https://rpc.example" } }
    );

    strictEqual(fetchCalled, false);
    strictEqual(
      result.errors?.[0].extensions?.code,
      "HYPERION_ENDPOINT_REQUIRED"
    );
  });

  it("returns null for Hyperion's executed-false not-found envelope", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ executed: false, trx_id: transactionId }));

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_transaction_by_id(id: "${transactionId}") {
                  transaction_id
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(result.data?.vaulta.get_blockchain.get_transaction_by_id, null);
  });

  it("rejects a provider response containing another transaction ID", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          actions: [{ ...action, trx_id: "b".repeat(64) }],
          executed: true,
          trx_id: "b".repeat(64)
        })
      );

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_transaction_by_id(id: "${transactionId}") {
                  transaction_id
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(
      result.errors?.[0].extensions?.code,
      "HYPERION_MALFORMED_RESPONSE"
    );
  });

  it("rejects executed-false responses that contain actions", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          actions: [action],
          executed: false,
          trx_id: transactionId
        })
      );

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_transaction_by_id(id: "${transactionId}") {
                  transaction_id
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(
      result.errors?.[0].extensions?.code,
      "HYPERION_MALFORMED_RESPONSE"
    );
  });

  it("defaults transfer searches to 25 results", async () => {
    let requestedUrl: URL | undefined;

    globalThis.fetch = async (input) => {
      requestedUrl = new URL(input.toString());
      return new Response(JSON.stringify({ actions: [] }));
    };

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_token_transfers(account: "alice", contract: "eosio.token") {
                  actions {
                    transaction_id
                  }
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(result.errors, undefined);
    strictEqual(requestedUrl?.searchParams.get("limit"), "25");
  });

  it("reports HTTP failures instead of treating them as not-found transactions", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_transaction_by_id(id: "${transactionId}") {
                  transaction_id
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(
      result.errors?.[0].extensions?.code,
      "HYPERION_ENDPOINT_UNAVAILABLE"
    );
    strictEqual(result.errors?.[0].extensions?.status, 404);
  });

  it("rejects actions that contradict the requested transfer filter", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          actions: [
            {
              ...action,
              act: { ...action.act, name: "issue" }
            }
          ]
        })
      );

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_token_transfers(account: "alice", contract: "eosio.token") {
                  actions {
                    transaction_id
                  }
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(
      result.errors?.[0].extensions?.code,
      "HYPERION_MALFORMED_RESPONSE"
    );
  });

  it("rejects excessive transfer limits before contacting Hyperion", async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response("{}");
    };

    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            vaulta {
              get_blockchain {
                get_token_transfers(
                  account: "alice"
                  contract: "eosio.token"
                  limit: 101
                ) {
                  actions {
                    transaction_id
                  }
                }
              }
            }
          }
        `
      },
      {
        chains: {
          vaulta: "https://rpc.example",
          hyperion_vaulta: "https://history.example"
        }
      }
    );

    strictEqual(fetchCalled, false);
    strictEqual(result.errors?.[0].extensions?.code, "BAD_USER_INPUT");
    match(result.errors?.[0].message ?? "", /Invalid Hyperion/u);
  });
});
