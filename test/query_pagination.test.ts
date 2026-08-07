import { deepStrictEqual, match, strictEqual } from "assert";
import {
  execute,
  GraphQLObjectType,
  GraphQLSchema,
  parse,
  validate
} from "graphql";

import type { Abi } from "../src/blockchain/get_abi.js";
import { build_graphql_fields_from_abis } from "../src/build_graphql_fields_from_abis.js";

const abi: Abi = {
  version: "eosio::abi/1.2",
  types: [],
  structs: [
    {
      name: "powup_order",
      base: "",
      fields: [
        { name: "id", type: "uint64" },
        { name: "owner", type: "name" },
        { name: "cpu_weight", type: "uint64" },
        { name: "net_weight", type: "uint64" }
      ]
    }
  ],
  actions: [],
  tables: [
    {
      name: "powup.order",
      index_type: "i64",
      key_names: [],
      key_types: [],
      type: "powup_order"
    }
  ],
  ricardian_clauses: [],
  variants: []
};

describe("contract table pagination", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("exposes rows, more, and next_key through the generated table field", async () => {
    let requestBody: Record<string, unknown> | undefined;

    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          rows: [
            {
              id: "11677451",
              owner: "eosx.game",
              cpu_weight: "35000000",
              net_weight: "100000"
            }
          ],
          more: true,
          next_key: "11677452"
        })
      );
    };

    const { query_fields } = build_graphql_fields_from_abis([
      { account_name: "eosio", abi }
    ]);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: query_fields
      })
    });

    const document = parse(/* GraphQL */ `
      {
        eosio {
          powup_order(arg: { scope: "" }) {
            rows {
              id
              owner
              cpu_weight
              net_weight
            }
            more
            next_key
          }
        }
      }
    `);

    deepStrictEqual(validate(schema, document), []);

    const result = await execute({
      schema,
      document,
      contextValue: {
        network: () => ({ rpc_url: "http://localhost" })
      }
    });

    deepStrictEqual(JSON.parse(JSON.stringify(result)), {
      data: {
        eosio: {
          powup_order: {
            rows: [
              {
                id: "11677451",
                owner: "eosx.game",
                cpu_weight: "35000000",
                net_weight: "100000"
              }
            ],
            more: true,
            next_key: "11677452"
          }
        }
      }
    });
    deepStrictEqual(requestBody, {
      json: true,
      code: "eosio",
      table: "powup.order",
      scope: "",
      index_position: 1,
      key_type: "name",
      encode_type: "dec"
    });
  });

  it("does not expose rows directly on the table field", () => {
    const { query_fields } = build_graphql_fields_from_abis([
      { account_name: "eosio", abi }
    ]);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: query_fields
      })
    });

    const errors = validate(
      schema,
      parse(/* GraphQL */ `
        {
          eosio {
            powup_order {
              id
            }
          }
        }
      `)
    );

    strictEqual(errors.length, 1);
    match(errors[0].message, /Cannot query field "id"/);
  });

  it("uses table argument defaults when arg is omitted", async () => {
    let requestBody: Record<string, unknown> | undefined;

    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          rows: [],
          more: false,
          next_key: ""
        })
      );
    };

    const { query_fields } = build_graphql_fields_from_abis([
      { account_name: "eosio", abi }
    ]);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: query_fields
      })
    });

    const result = await execute({
      schema,
      document: parse(/* GraphQL */ `
        {
          eosio {
            powup_order {
              rows {
                id
              }
              more
              next_key
            }
          }
        }
      `),
      contextValue: {
        network: () => ({ rpc_url: "http://localhost" })
      }
    });

    deepStrictEqual(result.errors, undefined);
    deepStrictEqual(requestBody, {
      json: true,
      code: "eosio",
      table: "powup.order",
      scope: "",
      index_position: 1,
      key_type: "name",
      encode_type: "dec"
    });
  });
});
