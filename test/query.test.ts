import { strictEqual } from "assert";

import { RelockeQL } from "../src/relockeql.js";

describe("testing v1/chain/", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("get_account", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ account_name: "eosio" }));

    const query = /* GraphQL */ `
      {
        jungle {
          get_blockchain {
            get_account(account_name: "eosio") {
              account_name
              ram_quota
              privileged
              net_weight
              cpu_weight
              permissions {
                perm_name
                parent
                required_auth {
                  threshold
                  keys {
                    key
                    weight
                  }
                  accounts {
                    weight
                    permission {
                      actor
                      permission
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const { data } = await RelockeQL(
      { query },
      { chains: { jungle: "https://jungle.relocke.io" } }
    );

    strictEqual(
      data?.jungle?.get_blockchain?.get_account?.account_name,
      "eosio"
    );
  });
});
