import { deepStrictEqual, rejects, strictEqual } from "assert";

import { abi_to_graphql_ast } from "../src/abi_to_graphql_ast.js";
import { mutation_resolver } from "../src/mutation_resolver.js";
import eosio_token_abi from "./abis/eosio.token.json" with { type: "json" };

const CHAIN_ID =
  "038f4b0fc8ff18a4f0842a8f0564611f6e96e8535901dd45e43ac8691a1c4dca";

const EXPECTED_TRANSFER_DATA =
  "00808a517dc354cb" +
  "6012f557656ca4ba" +
  "1027000000000000" +
  "04454f5300000000" +
  "14" +
  "466f72206120736563757265206675747572652e";

const EXPECTED_SECOND_TRANSFER_DATA =
  "00808a517dc354cb" +
  "6012f557656ca4ba" +
  "204e000000000000" +
  "04454f5300000000" +
  "28" +
  "466f722061207365636f6e64207365637572652066757475726520286d756c746976657273653f29";

const EXPECTED_TRANSACTION_HEADER = "29d28e5bd0948b2e1f1e000000";

const ast_list = {
  eosio_token: abi_to_graphql_ast(eosio_token_abi)
};

function transfer(quantity: string, memo: string, withAuthorization = true) {
  return {
    eosio_token: {
      transfer: {
        from: "thegazelle",
        to: "remasteryoda",
        quantity,
        memo,

        ...(withAuthorization
          ? {
              authorization: [
                {
                  actor: "thegazelle",
                  permission: "active"
                }
              ]
            }
          : {})
      }
    }
  };
}

function installRpcFixture(): {
  getBlockRequest: () => Record<string, unknown> | undefined;
} {
  let blockRequest: Record<string, unknown> | undefined;

  globalThis.fetch = async (input, init) => {
    const url = input.toString();

    if (url.endsWith("/v1/chain/get_info")) {
      return new Response(
        JSON.stringify({
          chain_id: CHAIN_ID,
          head_block_num: 38099
        })
      );
    }

    if (url.endsWith("/v1/chain/get_block")) {
      blockRequest = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          timestamp: "2018-09-04T18:42:19.000",

          block_num: 38096,

          ref_block_prefix: 505360011
        })
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  return {
    getBlockRequest: () => blockRequest
  };
}

describe("transaction conformance", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("matches the canonical EOSJS transfer action bytes", async () => {
    const rpc = installRpcFixture();

    const result = await mutation_resolver(
      {
        actions: [transfer("1.0000 EOS", "For a secure future.")],

        configuration: {
          blocksBehind: 3,
          expireSeconds: 30
        }
      },

      {
        rpc_url: "http://localhost",
        fetchOptions: {}
      },

      ast_list
    );

    strictEqual(
      result.transaction.actions?.[0].hex_data,
      EXPECTED_TRANSFER_DATA
    );

    /*
     * Also assert the complete
     * deterministic transaction
     * header fixture.
     */
    strictEqual(result.transaction_header, EXPECTED_TRANSACTION_HEADER);

    deepStrictEqual(rpc.getBlockRequest(), {
      block_num_or_id: 38096
    });
  });

  it("preserves multi-action ordering", async () => {
    installRpcFixture();

    const result = await mutation_resolver(
      {
        actions: [
          transfer("1.0000 EOS", "For a secure future."),

          transfer("2.0000 EOS", "For a second secure future (multiverse?)")
        ]
      },

      {
        rpc_url: "http://localhost"
      },

      ast_list
    );

    deepStrictEqual(
      result.transaction.actions?.map((action) => action.hex_data),

      [EXPECTED_TRANSFER_DATA, EXPECTED_SECOND_TRANSFER_DATA]
    );

    /*
     * 00 = zero context-free actions
     * 02 = two normal actions
     */
    strictEqual(result.transaction_body.startsWith("0002"), true);
  });

  it("separates context-free and authorized actions", async () => {
    installRpcFixture();

    const result = await mutation_resolver(
      {
        actions: [
          transfer("1.0000 EOS", "context free", false),

          transfer("2.0000 EOS", "authorized", true)
        ]
      },

      {
        rpc_url: "http://localhost"
      },

      ast_list
    );

    strictEqual(result.transaction.context_free_actions?.length, 1);

    strictEqual(result.transaction.actions?.length, 1);

    deepStrictEqual(
      result.transaction.context_free_actions?.[0].authorization,
      []
    );

    strictEqual(result.transaction.actions?.[0].authorization.length, 1);
  });

  it("serializes UTF-8 action strings by byte length", async () => {
    /*
     * IMPORTANT:
     *
     * This is expected to expose
     * a bug in the current
     * eosio-wasm-js string
     * serializer.
     */
    installRpcFixture();

    const result = await mutation_resolver(
      {
        actions: [transfer("1.0000 EOS", "ภาษาไทย 🌴")]
      },

      {
        rpc_url: "http://localhost"
      },

      ast_list
    );

    const expected =
      "00808a517dc354cb" +
      "6012f557656ca4ba" +
      "1027000000000000" +
      "04454f5300000000" +
      /*
       * UTF-8 memo is 26 bytes.
       */
      "1a" +
      "e0b8a0" +
      "e0b8b2" +
      "e0b8a9" +
      "e0b8b2" +
      "e0b984" +
      "e0b897" +
      "e0b8a2" +
      "20" +
      "f09f8cb4";

    strictEqual(result.transaction.actions?.[0].hex_data, expected);
  });

  it("rejects max_cpu_usage_ms above uint8", async () => {
    await rejects(
      mutation_resolver(
        {
          actions: [],

          configuration: {
            max_cpu_usage_ms: 256
          }
        },

        {
          rpc_url: "http://localhost"
        },

        {}
      ),

      /maximum 255/
    );
  });

  it("rejects max_net_usage_words above uint32", async () => {
    await rejects(
      mutation_resolver(
        {
          actions: [],

          configuration: {
            max_net_usage_words: 0x1_0000_0000
          }
        },

        {
          rpc_url: "http://localhost"
        },

        {}
      ),

      /4,294,967,295/
    );
  });
});
