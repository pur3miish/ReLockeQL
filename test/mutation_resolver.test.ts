import { strictEqual } from "assert";

import { abi_to_graphql_ast } from "../src/abi_to_graphql_ast.js";
import { mutation_resolver } from "../src/mutation_resolver.js";
import eosio_abi from "./abis/eosio.json" with { type: "json" };

describe("mutation_resolver", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("serializes empty bytes fields", async () => {
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = input.toString();

      if (url.endsWith("/v1/chain/get_info")) {
        return new Response(
          JSON.stringify({
            chain_id:
              "0000000000000000000000000000000000000000000000000000000000000000",
            head_block_num: 100
          })
        );
      }

      if (url.endsWith("/v1/chain/get_block")) {
        return new Response(
          JSON.stringify({
            timestamp: "2024-01-01T00:00:00.000",
            block_num: 97,
            ref_block_prefix: 123456
          })
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const result = await mutation_resolver(
      {
        actions: [
          {
            eosio: {
              setcode: {
                account: "eosio.token",
                vmtype: 0,
                vmversion: 0,
                code: "",
                memo: "",
                authorization: [
                  {
                    actor: "kingofjungle",
                    permission: "active"
                  }
                ]
              }
            }
          }
        ]
      },
      { rpc_url: "http://localhost", fetchOptions: {} },
      { eosio: abi_to_graphql_ast(eosio_abi) }
    );

    strictEqual(result.transaction.actions?.[0].data.code, "");
    strictEqual(
      result.transaction.actions?.[0].hex_data.endsWith("0000"),
      true
    );
  });
});
