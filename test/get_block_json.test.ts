import { deepStrictEqual, strictEqual } from "assert";

import { RelockeQL } from "../src/relockeql.js";

describe("get_block JSON action data", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns decoded action data instead of a JSON string", async () => {
    const actionData = {
      from: "alice",
      memo: "hello",
      quantity: "1.0000 A",
      to: "bob"
    };

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          block_num: 123,
          transactions: [
            {
              trx: {
                transaction: {
                  actions: [
                    {
                      account: "eosio.token",
                      authorization: [],
                      data: actionData,
                      name: "transfer"
                    }
                  ]
                }
              }
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
                get_block(block_num_or_id: "123") {
                  transactions {
                    trx {
                      transaction {
                        actions {
                          data
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `
      },
      { chains: { vaulta: "https://rpc.example" } }
    );

    strictEqual(result.errors, undefined);
    deepStrictEqual(
      result.data?.vaulta.get_blockchain.get_block.transactions[0].trx
        .transaction.actions[0].data,
      actionData
    );
  });
});
