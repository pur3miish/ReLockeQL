import { ok } from "assert";

import { RelockeQL } from "../src/relockeql.js";

describe("RPC endpoint routing", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("queries the explicitly configured RPC endpoint", async () => {
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = input.toString();
      return new Response(JSON.stringify({ account_name: "eosio" }));
    };

    const data = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            jungle {
              get_blockchain {
                get_account(account_name: "eosio") {
                  account_name
                }
              }
            }
          }
        `
      },
      { chains: { jungle: "https://jungle.relocke.io" } }
    );

    ok(
      data.data?.jungle?.get_blockchain?.get_account?.account_name == "eosio",
      "Expected account name"
    );
    ok(
      requestedUrl === "https://jungle.relocke.io/v1/chain/get_account",
      "Expected the configured RPC endpoint"
    );
  });
});
