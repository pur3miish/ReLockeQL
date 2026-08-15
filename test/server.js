import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RelockeQL } from "../dist/relockeql.js";

const MAX_BODY_BYTES = 1_000_000;

function endpoint(value, variableName) {
  if (!value?.trim()) {
    throw new Error(`${variableName} is required.`);
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid HTTP or HTTPS URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${variableName} must use HTTP or HTTPS.`);
  }

  return url.toString().replace(/\/$/u, "");
}

export function readServerConfiguration(environment = process.env) {
  const chain = environment.RELOCKEQL_CHAIN?.trim();

  if (!chain) throw new Error("RELOCKEQL_CHAIN is required.");
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/u.test(chain)) {
    throw new Error("RELOCKEQL_CHAIN must be a valid GraphQL field name.");
  }

  const chains = {
    [chain]: endpoint(environment.RELOCKEQL_RPC_URL, "RELOCKEQL_RPC_URL")
  };
  const hyperionUrl = environment.RELOCKEQL_HYPERION_URL?.trim();

  if (hyperionUrl) {
    chains[`hyperion_${chain}`] = endpoint(
      hyperionUrl,
      "RELOCKEQL_HYPERION_URL"
    );
  }

  const contractAccounts = (environment.RELOCKEQL_CONTRACTS ?? "")
    .split(",")
    .map((account) => account.trim())
    .filter(Boolean);
  const port = Number(environment.PORT ?? 3002);

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PORT must be an integer from 0 through 65535.");
  }

  return {
    chain,
    port,
    options: {
      chains,
      ...(contractAccounts.length
        ? { contracts: { [chain]: contractAccounts } }
        : {})
    }
  };
}

function sendJson(response, status, payload, headers = {}) {
  if (response.destroyed || response.writableEnded) return;

  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let body = "";
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;

    if (receivedBytes > MAX_BODY_BYTES) {
      const error = new Error("Request body exceeds one megabyte.");
      error.status = 413;
      throw error;
    }

    body += chunk.toString();
  }

  if (!body.trim()) {
    const error = new Error("A JSON GraphQL request body is required.");
    error.status = 400;
    throw error;
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must contain valid JSON.");
    error.status = 400;
    throw error;
  }
}

export function createRelockeQLRequestHandler(options, execute = RelockeQL) {
  return async (request, response) => {
    if (request.method !== "POST") {
      sendJson(
        response,
        405,
        { error: "Send GraphQL requests using POST." },
        { Allow: "POST" }
      );
      return;
    }

    try {
      const { query, variables, operationName } = await readJsonBody(request);

      if (typeof query !== "string" || !query.trim()) {
        sendJson(response, 400, {
          error: "The request body must include a non-empty GraphQL query."
        });
        return;
      }

      const result = await execute(
        { query, operationName, variables },
        options
      );
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;

      if (status === 500) console.error("GraphQL request failed:", error);
      sendJson(response, status, {
        error:
          status === 500 ? "Error processing GraphQL request." : error.message
      });
    }
  };
}

export function createRelockeQLServer(options, execute = RelockeQL) {
  return http.createServer(createRelockeQLRequestHandler(options, execute));
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  try {
    const { chain, options, port } = readServerConfiguration();
    const server = createRelockeQLServer(options);

    server.listen(port, () => {
      console.log(
        `ReLockeQL server for ${chain} is running on http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error(`Unable to start ReLockeQL server: ${error.message}`);
    console.error(
      "Set RELOCKEQL_CHAIN and RELOCKEQL_RPC_URL. Hyperion and contract variables are optional."
    );
    process.exitCode = 1;
  }
}
