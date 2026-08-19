import { deepStrictEqual, strictEqual } from "assert";
import {
  execute,
  GraphQLBoolean,
  GraphQLObjectType,
  GraphQLSchema,
  parse
} from "graphql";

import { build_graphql_fields_from_abis } from "../src/build_graphql_fields_from_abis.js";
import { actions_type } from "../src/graphql_input_types/actions.js";
import { serialize_transaction } from "../src/serialize_transaction.js";
import eosio_token_abi from "./abis/eosio.token.json" with { type: "json" };

const CHAIN_ID =
  "038f4b0fc8ff18a4f0842a8f0564611f6e96e8535901dd45e43ac8691a1c4dca";
const EXPECTED_TRANSACTION_HEADER = "29d28e5bd0948b2e1f1e000000";
const PUBLIC_KEY = "PUB_K1_5UAjunGLeR6eBfbpU4CxGssxa9DKKjbPA4zrCuUpoJQwr6a12W";

const { mutation_fields, ast_list } = build_graphql_fields_from_abis([
  { account_name: "eosio.token", abi: eosio_token_abi }
]);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      ready: { type: GraphQLBoolean }
    }
  }),
  mutation: new GraphQLObjectType({
    name: "Mutation",
    fields: {
      serialize_transaction: serialize_transaction(
        actions_type(mutation_fields),
        ast_list
      )
    }
  })
});

const transfer = /* GraphQL */ `
  transfer: {
    authorization: [{ actor: "thegazelle" }]
    from: "thegazelle"
    to: "remasteryoda"
    quantity: "1.0000 EOS"
    memo: "cache this body"
  }
`;

function run(query: string, variableValues?: Record<string, unknown>) {
  return execute({
    schema,
    document: parse(query),
    variableValues,
    contextValue: {
      network: () => ({ rpc_url: "http://localhost" })
    }
  });
}

describe("serialize_transaction field planning", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("serializes a cacheable body without making live RPC requests", async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      throw new Error(
        "Body-only serialization must not fetch live chain data."
      );
    };

    const result = await run(
      /* GraphQL */ `
        mutation CachedBody($includeBody: Boolean!) {
          serialize_transaction(
            actions: [{ eosio_token: { ${transfer} } }]
          ) {
            ...BodyFields
            transaction_header @skip(if: true)
          }
        }

        fragment BodyFields on packed_transaction {
          cached_body: transaction_body @include(if: $includeBody)
        }
      `,
      { includeBody: true }
    );

    strictEqual(result.errors, undefined);
    strictEqual(fetchCount, 0);
    deepStrictEqual(Object.keys(result.data?.serialize_transaction ?? {}), [
      "cached_body"
    ]);
    strictEqual(
      typeof result.data?.serialize_transaction?.cached_body,
      "string"
    );
  });

  it("refreshes a header without serializing the supplied actions", async () => {
    const fetchedEndpoints: string[] = [];
    globalThis.fetch = async (input) => {
      const url = input.toString();
      fetchedEndpoints.push(url.split("/").at(-1)!);

      if (url.endsWith("/v1/chain/get_info")) {
        return new Response(
          JSON.stringify({ chain_id: CHAIN_ID, head_block_num: 38099 })
        );
      }

      if (url.endsWith("/v1/chain/get_block")) {
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

    const result = await run(/* GraphQL */ `
      mutation FreshHeader {
        serialize_transaction(
          actions: [
            {
              eosio_token: {
                ${transfer}
                close: { owner: "thegazelle", symbol: "4,EOS" }
              }
            }
          ]
        ) {
          fresh_header: transaction_header
        }
      }
    `);

    strictEqual(result.errors, undefined);
    deepStrictEqual(fetchedEndpoints, ["get_info", "get_block"]);
    strictEqual(
      result.data?.serialize_transaction?.fresh_header,
      EXPECTED_TRANSACTION_HEADER
    );
  });

  it("retrieves a chain ID without fetching a reference block", async () => {
    const fetchedEndpoints: string[] = [];
    globalThis.fetch = async (input) => {
      const url = input.toString();
      fetchedEndpoints.push(url.split("/").at(-1)!);

      if (url.endsWith("/v1/chain/get_info")) {
        return new Response(
          JSON.stringify({ chain_id: CHAIN_ID, head_block_num: 38099 })
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const result = await run(/* GraphQL */ `
      mutation ChainIdOnly {
        serialize_transaction(
          actions: [{ eosio_token: { ${transfer} } }]
        ) {
          chain_id
        }
      }
    `);

    strictEqual(result.errors, undefined);
    deepStrictEqual(fetchedEndpoints, ["get_info"]);
    strictEqual(result.data?.serialize_transaction?.chain_id, CHAIN_ID);
  });

  it("builds every signing component when only the hash is selected", async () => {
    const fetchedEndpoints: string[] = [];
    globalThis.fetch = async (input) => {
      const url = input.toString();
      fetchedEndpoints.push(url.split("/").at(-1)!);

      if (url.endsWith("/v1/chain/get_info")) {
        return new Response(
          JSON.stringify({ chain_id: CHAIN_ID, head_block_num: 38099 })
        );
      }

      if (url.endsWith("/v1/chain/get_block")) {
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

    const result = await run(/* GraphQL */ `
      mutation HashOnly {
        serialize_transaction(
          actions: [{ eosio_token: { ${transfer} } }]
        ) {
          hash
        }
      }
    `);

    strictEqual(result.errors, undefined);
    deepStrictEqual(fetchedEndpoints, ["get_info", "get_block"]);
    strictEqual(
      /^[0-9a-f]{64}$/u.test(result.data?.serialize_transaction?.hash),
      true
    );
  });

  it("builds a complete transaction for non-empty required keys", async () => {
    const fetchedEndpoints: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = input.toString();
      fetchedEndpoints.push(url.split("/").at(-1)!);

      if (url.endsWith("/v1/chain/get_info")) {
        return new Response(
          JSON.stringify({ chain_id: CHAIN_ID, head_block_num: 38099 })
        );
      }

      if (url.endsWith("/v1/chain/get_block")) {
        return new Response(
          JSON.stringify({
            timestamp: "2018-09-04T18:42:19.000",
            block_num: 38096,
            ref_block_prefix: 505360011
          })
        );
      }

      if (url.endsWith("/v1/chain/get_required_keys")) {
        const request = JSON.parse(init?.body as string);
        strictEqual(typeof request.transaction.actions[0].data, "string");
        return new Response(JSON.stringify({ required_keys: [PUBLIC_KEY] }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const result = await run(/* GraphQL */ `
      mutation RequiredKeysOnly {
        serialize_transaction(
          actions: [{ eosio_token: { ${transfer} } }]
          available_keys: ["${PUBLIC_KEY}"]
        ) {
          required_keys
        }
      }
    `);

    strictEqual(result.errors, undefined);
    deepStrictEqual(fetchedEndpoints, [
      "get_info",
      "get_block",
      "get_required_keys"
    ]);
    deepStrictEqual(result.data?.serialize_transaction?.required_keys, [
      PUBLIC_KEY
    ]);
  });
});
