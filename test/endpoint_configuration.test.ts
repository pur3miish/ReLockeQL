import { deepStrictEqual, ok, rejects, strictEqual } from "assert";

import { type APIOptionsType, RelockeQL } from "../src/relockeql.js";

describe("endpoint configuration", () => {
  it("requires callers to provide at least one RPC endpoint", async () => {
    await rejects(
      RelockeQL(
        { query: "{ __typename }" },
        undefined as unknown as APIOptionsType
      ),
      /requires at least one RPC endpoint/u
    );

    await rejects(
      RelockeQL(
        { query: "{ __typename }" },
        { chains: { hyperion_vaulta: "https://history.example" } }
      ),
      /requires at least one RPC endpoint/u
    );
  });

  it("builds chain fields only from configured RPC keys", async () => {
    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            __schema {
              queryType {
                fields {
                  name
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

    deepStrictEqual(
      result.data?.__schema.queryType.fields.map(
        ({ name }: { name: string }) => name
      ),
      ["vaulta"]
    );
  });

  it("documents public block and Hyperion schema types through introspection", async () => {
    const typeNames = [
      "action_type",
      "authorization_type",
      "block_type",
      "hyperion_action_search_result_type",
      "hyperion_action_type",
      "hyperion_authorization_type",
      "hyperion_transaction_type",
      "new_producer_type",
      "packed_transaction_type",
      "producer_type",
      "transaction_type",
      "trx_type"
    ];
    const typeQueries = typeNames
      .map(
        (name, index) => /* GraphQL */ `
          type${index}: __type(name: "${name}") {
            name
            description
            fields {
              name
              description
            }
          }
        `
      )
      .join("\n");
    const result = await RelockeQL(
      {
        query: /* GraphQL */ `
          {
            queryType: __type(name: "Query") {
              description
              fields {
                name
                description
              }
            }
            chainType: __type(name: "vaulta_query") {
              description
              fields {
                name
                description
              }
            }
            blockchainType: __type(name: "blockchain_type") {
              description
              fields {
                name
                description
                args {
                  name
                  description
                }
              }
            }
            jsonType: __type(name: "relocke_json") {
              description
            }
            ${typeQueries}
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

    const assertDescription = (value: unknown, label: string) => {
      ok(
        typeof value === "string" && value.trim().length > 0,
        `${label} must have a GraphQL description`
      );
    };
    const assertFieldsAreDescribed = (
      type: {
        description?: unknown;
        fields?: Array<{ description?: unknown; name: string }>;
        name?: string;
      },
      fallbackName: string
    ) => {
      const typeName = type.name ?? fallbackName;
      assertDescription(type.description, typeName);
      ok(type.fields?.length, `${typeName} must expose fields`);
      type.fields?.forEach((field) => {
        assertDescription(field.description, `${typeName}.${field.name}`);
      });
    };

    assertDescription(result.data?.queryType.description, "Query");
    assertDescription(
      result.data?.queryType.fields.find(
        ({ name }: { name: string }) => name === "vaulta"
      )?.description,
      "Query.vaulta"
    );
    assertDescription(result.data?.chainType.description, "vaulta_query");
    assertDescription(
      result.data?.chainType.fields.find(
        ({ name }: { name: string }) => name === "get_blockchain"
      )?.description,
      "vaulta_query.get_blockchain"
    );
    assertDescription(
      result.data?.blockchainType.description,
      "blockchain_type"
    );
    assertDescription(result.data?.jsonType.description, "relocke_json");

    ["get_block", "get_token_transfers", "get_transaction_by_id"].forEach(
      (fieldName) => {
        const field = result.data?.blockchainType.fields.find(
          ({ name }: { name: string }) => name === fieldName
        );
        assertDescription(field?.description, `blockchain_type.${fieldName}`);
        field?.args.forEach(
          (argument: { description?: unknown; name: string }) => {
            assertDescription(
              argument.description,
              `blockchain_type.${fieldName}(${argument.name}:)`
            );
          }
        );
      }
    );

    typeNames.forEach((name, index) => {
      assertFieldsAreDescribed(result.data?.[`type${index}`], name);
    });
  });
});
