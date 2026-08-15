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
  it("requires callers to configure an explicit RPC endpoint", () => {
    rejects(
      async () => readServerConfiguration({ RELOCKEQL_CHAIN: "vaulta" }),
      /RELOCKEQL_RPC_URL is required/u
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
