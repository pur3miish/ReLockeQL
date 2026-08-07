import { RelockeQL } from "../src/relockeql.js";

describe("testing v1/chain/", () => {
  it("get_account", async () => {
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

    const { data } = await RelockeQL({ query });

    console.log(data);
  });
});
