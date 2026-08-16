import { deepStrictEqual, strictEqual } from "assert";

import { RelockeQL } from "../src/relockeql.js";

const ABI_HASH = "a".repeat(64);
const WASM_HASH = "b".repeat(64);

type RpcCall = {
  body: unknown;
  init?: RequestInit;
  path: string;
};

function mockContractRpc(
  overrides: Partial<Record<string, unknown>> = {}
): RpcCall[] {
  const calls: RpcCall[] = [];
  const responses: Record<string, unknown> = {
    "/v1/chain/get_code_hash": {
      account_name: "rloc",
      code_hash: WASM_HASH
    },
    "/v1/chain/get_raw_abi": {
      abi: "raw-abi",
      abi_hash: ABI_HASH,
      account_name: "rloc",
      code_hash: WASM_HASH
    },
    "/v1/chain/get_raw_code_and_abi": {
      abi: "raw-abi",
      account_name: "rloc",
      wasm: "raw-wasm"
    },
    ...overrides
  };

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push({
      body: JSON.parse(String(init?.body)),
      init,
      path
    });
    return new Response(JSON.stringify(responses[path]));
  };

  return calls;
}

async function queryContract(selection: string, fetchOptions?: RequestInit) {
  return RelockeQL(
    {
      query: /* GraphQL */ `
        {
          vaulta {
            get_blockchain {
              get_smart_contract(account_name: "rloc") {
                ${selection}
              }
            }
          }
        }
      `
    },
    {
      chains: { vaulta: "https://rpc.example" },
      fetchOptions
    }
  );
}

describe("get_smart_contract", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shares get_raw_code_and_abi when WASM and ABI are selected", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("wasm abi", {
      headers: { authorization: "test-token" }
    });

    deepStrictEqual(result.errors, undefined);
    deepStrictEqual(
      {
        ...result.data?.vaulta.get_blockchain.get_smart_contract
      },
      {
        abi: "raw-abi",
        wasm: "raw-wasm"
      }
    );
    deepStrictEqual(
      calls.map(({ path }) => path),
      ["/v1/chain/get_raw_code_and_abi"]
    );
    deepStrictEqual(calls[0].body, { account_name: "rloc" });
    strictEqual(calls[0].init?.method, "POST");
    deepStrictEqual(calls[0].init?.headers, {
      authorization: "test-token"
    });
  });

  it("uses get_raw_abi for ABI without fetching WASM", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("abi");

    strictEqual(
      result.data?.vaulta.get_blockchain.get_smart_contract.abi,
      "raw-abi"
    );
    deepStrictEqual(
      calls.map(({ path }) => path),
      ["/v1/chain/get_raw_abi"]
    );
  });

  it("retrieves both hashes with one get_raw_abi request", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("abi_hash wasm_hash");

    deepStrictEqual(
      {
        ...result.data?.vaulta.get_blockchain.get_smart_contract
      },
      {
        abi_hash: ABI_HASH,
        wasm_hash: WASM_HASH
      }
    );
    deepStrictEqual(
      calls.map(({ path }) => path),
      ["/v1/chain/get_raw_abi"]
    );
  });

  it("shares get_raw_abi between ABI and WASM hash selections", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("abi wasm_hash");

    deepStrictEqual(
      { ...result.data?.vaulta.get_blockchain.get_smart_contract },
      {
        abi: "raw-abi",
        wasm_hash: WASM_HASH
      }
    );
    deepStrictEqual(
      calls.map(({ path }) => path),
      ["/v1/chain/get_raw_abi"]
    );
  });

  it("uses get_code_hash when only the WASM hash is selected", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("wasm_hash");

    strictEqual(
      result.data?.vaulta.get_blockchain.get_smart_contract.wasm_hash,
      WASM_HASH
    );
    deepStrictEqual(
      calls.map(({ path }) => path),
      ["/v1/chain/get_code_hash"]
    );
  });

  it("uses only raw code and raw ABI requests for all four fields", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("wasm abi abi_hash wasm_hash");

    deepStrictEqual(
      {
        ...result.data?.vaulta.get_blockchain.get_smart_contract
      },
      {
        abi: "raw-abi",
        abi_hash: ABI_HASH,
        wasm: "raw-wasm",
        wasm_hash: WASM_HASH
      }
    );
    deepStrictEqual(calls.map(({ path }) => path).sort(), [
      "/v1/chain/get_raw_abi",
      "/v1/chain/get_raw_code_and_abi"
    ]);
  });

  it("honors aliases, fragments, variables, and selection directives", async () => {
    const calls = mockContractRpc();
    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          query SelectedContract(
            $includeAbiHash: Boolean!
            $skipAbi: Boolean!
          ) {
            vaulta {
              get_blockchain {
                get_smart_contract(account_name: "rloc") {
                  __typename
                  ... on smart_contract_type {
                    hash: wasm_hash
                  }
                  ...ContractFields
                }
              }
            }
          }

          fragment ContractFields on smart_contract_type {
            abi @skip(if: $skipAbi)
            abi_hash @include(if: $includeAbiHash)
          }
        `,
        variables: { includeAbiHash: false, skipAbi: true }
      },
      { chains: { vaulta: "https://rpc.example" } }
    );

    deepStrictEqual(
      {
        ...result.data?.vaulta.get_blockchain.get_smart_contract
      },
      {
        __typename: "smart_contract_type",
        hash: WASM_HASH
      }
    );
    deepStrictEqual(
      calls.map(({ path }) => path),
      ["/v1/chain/get_code_hash"]
    );
  });

  it("does not contact an RPC endpoint for __typename alone", async () => {
    const calls = mockContractRpc();
    const result = await queryContract("__typename");

    strictEqual(
      result.data?.vaulta.get_blockchain.get_smart_contract.__typename,
      "smart_contract_type"
    );
    strictEqual(calls.length, 0);
  });

  it("deduplicates aliases per request without caching across requests", async () => {
    const calls = mockContractRpc();
    const request = {
      query: /* GraphQL */ `
        {
          vaulta {
            get_blockchain {
              first: get_smart_contract(account_name: "rloc") {
                wasm
              }
              second: get_smart_contract(account_name: "rloc") {
                wasm
              }
            }
          }
        }
      `
    };
    const options = { chains: { vaulta: "https://rpc.example" } };

    await RelockeQL(request, options);
    strictEqual(calls.length, 1);

    await RelockeQL(request, options);
    strictEqual(calls.length, 2);
  });

  it("propagates endpoint errors as GraphQL errors", async () => {
    const calls = mockContractRpc({
      "/v1/chain/get_code_hash": {
        error: { code: 500 },
        message: "Contract lookup failed"
      }
    });
    const result = await queryContract("wasm_hash");

    strictEqual(result.errors?.[0].message, "Contract lookup failed");
    strictEqual(calls.length, 1);
  });
});
