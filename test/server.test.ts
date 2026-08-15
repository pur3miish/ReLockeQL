import { deepStrictEqual, rejects, strictEqual } from "node:assert";
import { Readable } from "node:stream";

import {
  createRelockeQLRequestHandler,
  readServerConfiguration
} from "./server.js";

function request(method: string, body = "") {
  return Object.assign(Readable.from(body ? [Buffer.from(body)] : []), {
    method
  });
}

function response() {
  let body = "";
  let ended = false;
  let headers: Record<string, string> = {};
  let status = 0;

  return {
    get body() {
      return body;
    },
    destroyed: false,
    end(value = "") {
      if (ended) throw new Error("Response ended more than once.");
      body = String(value);
      ended = true;
    },
    get headers() {
      return headers;
    },
    get status() {
      return status;
    },
    get writableEnded() {
      return ended;
    },
    writeHead(value: number, nextHeaders: Record<string, string>) {
      if (status) throw new Error("Headers written more than once.");
      status = value;
      headers = nextHeaders;
    }
  };
}

describe("example HTTP server", () => {
  it("requires callers to configure at least one explicit RPC endpoint", async () => {
    await rejects(
      async () => readServerConfiguration({}),
      /RELOCKEQL_CHAINS is required/u
    );

    await rejects(
      async () =>
        readServerConfiguration({
          RELOCKEQL_CHAINS: JSON.stringify({
            hyperion_vaulta: "https://history.example"
          })
        }),
      /at least one RPC chain endpoint/u
    );
  });

  it("configures every RPC and Hyperion provider from one chain map", () => {
    deepStrictEqual(
      readServerConfiguration({
        PORT: "4000",
        RELOCKEQL_CHAINS: JSON.stringify({
          custom_chain: "https://custom.example/",
          hyperion_vaulta: "https://history.example/",
          vaulta: "https://rpc.example/",
          wax: "https://wax.example/"
        }),
        RELOCKEQL_CONTRACTS: JSON.stringify({
          vaulta: [" eosio.token ", "eosio"]
        })
      }),
      {
        chains: ["custom_chain", "vaulta", "wax"],
        options: {
          chains: {
            custom_chain: "https://custom.example",
            hyperion_vaulta: "https://history.example",
            vaulta: "https://rpc.example",
            wax: "https://wax.example"
          },
          contracts: { vaulta: ["eosio.token", "eosio"] }
        },
        port: 4000
      }
    );
  });

  it("rejects invalid multi-chain configuration", async () => {
    await rejects(
      async () => readServerConfiguration({ RELOCKEQL_CHAINS: "not-json" }),
      /must contain valid JSON/u
    );
    await rejects(
      async () =>
        readServerConfiguration({
          RELOCKEQL_CHAINS: JSON.stringify({
            "invalid-chain": "https://rpc.example"
          })
        }),
      /valid GraphQL field name/u
    );
    await rejects(
      async () =>
        readServerConfiguration({
          RELOCKEQL_CHAINS: JSON.stringify({
            hyperion_wax: "https://history.example",
            vaulta: "https://rpc.example"
          })
        }),
      /matching wax RPC endpoint/u
    );
  });

  it("keeps serving after an invalid request without writing headers twice", async () => {
    const requests: unknown[] = [];
    const handler = createRelockeQLRequestHandler(
      { chains: { vaulta: "https://rpc.example" } },
      async (graphqlRequest: unknown) => {
        requests.push(graphqlRequest);
        return { data: { ok: true } };
      }
    );
    const invalidResponse = response();

    await handler(request("POST", "{"), invalidResponse);
    strictEqual(invalidResponse.status, 400);
    deepStrictEqual(JSON.parse(invalidResponse.body), {
      error: "Request body must contain valid JSON."
    });

    const validResponse = response();
    await handler(
      request("POST", JSON.stringify({ query: "{ __typename }" })),
      validResponse
    );
    strictEqual(validResponse.status, 200);
    deepStrictEqual(JSON.parse(validResponse.body), { data: { ok: true } });
    deepStrictEqual(requests, [
      {
        operationName: undefined,
        query: "{ __typename }",
        variables: undefined
      }
    ]);
  });

  it("returns a method error for browser GET requests", async () => {
    const handler = createRelockeQLRequestHandler(
      { chains: { vaulta: "https://rpc.example" } },
      async () => ({ data: {} })
    );
    const getResponse = response();

    await handler(request("GET"), getResponse);
    strictEqual(getResponse.status, 405);
    strictEqual(getResponse.headers.Allow, "POST");
  });
});
