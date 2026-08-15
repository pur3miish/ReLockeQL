import { deepStrictEqual, rejects } from "assert";

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
});
