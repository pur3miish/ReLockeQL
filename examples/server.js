import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RelockeQL } from "../dist/relockeql.js";

const MAX_BODY_BYTES = 1_000_000;

function endpoint(value, variableName) {
  if (typeof value !== "string" || !value.trim()) {
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

function jsonObject(value, variableName, required = false) {
  if (!value?.trim()) {
    if (required) throw new Error(`${variableName} is required.`);
    return {};
  }

  let parsed;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${variableName} must contain valid JSON.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${variableName} must be a JSON object.`);
  }

  return parsed;
}

function chainName(value, variableName) {
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/u.test(value)) {
    throw new Error(`${variableName} must be a valid GraphQL field name.`);
  }

  return value;
}

export function readServerConfiguration(environment = process.env) {
  const configuredChains = jsonObject(
    environment.RELOCKEQL_CHAINS,
    "RELOCKEQL_CHAINS",
    true
  );
  const chains = {};

  for (const [name, url] of Object.entries(configuredChains)) {
    const rpcChainName = name.startsWith("hyperion_")
      ? name.slice("hyperion_".length)
      : name;

    chainName(rpcChainName, `RELOCKEQL_CHAINS.${name}`);
    chains[name] = endpoint(url, `RELOCKEQL_CHAINS.${name}`);
  }

  const rpcChains = Object.keys(chains).filter(
    (name) => !name.startsWith("hyperion_")
  );

  if (!rpcChains.length) {
    throw new Error(
      "RELOCKEQL_CHAINS must contain at least one RPC chain endpoint."
    );
  }

  for (const name of Object.keys(chains).filter((configuredName) =>
    configuredName.startsWith("hyperion_")
  )) {
    const rpcChainName = name.slice("hyperion_".length);

    if (!chains[rpcChainName]) {
      throw new Error(
        `RELOCKEQL_CHAINS.${name} requires the matching ${rpcChainName} RPC endpoint.`
      );
    }
  }

  const configuredContracts = jsonObject(
    environment.RELOCKEQL_CONTRACTS,
    "RELOCKEQL_CONTRACTS"
  );
  const contracts = {};

  for (const [name, accounts] of Object.entries(configuredContracts)) {
    chainName(name, `RELOCKEQL_CONTRACTS.${name}`);

    if (!rpcChains.includes(name)) {
      throw new Error(
        `RELOCKEQL_CONTRACTS.${name} requires a configured RPC chain.`
      );
    }
    if (
      !Array.isArray(accounts) ||
      accounts.some((account) => typeof account !== "string" || !account.trim())
    ) {
      throw new Error(
        `RELOCKEQL_CONTRACTS.${name} must be an array of contract account names.`
      );
    }

    if (accounts.length) {
      contracts[name] = accounts.map((account) => account.trim());
    }
  }

  const port = Number(environment.PORT ?? 3002);

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PORT must be an integer from 0 through 65535.");
  }

  return {
    chains: rpcChains,
    port,
    options: {
      chains,
      ...(Object.keys(contracts).length ? { contracts } : {})
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
    const { chains, options, port } = readServerConfiguration();
    const server = createRelockeQLServer(options);

    server.listen(port, () => {
      console.log(
        `ReLockeQL server for ${chains.join(", ")} is running on http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error(`Unable to start ReLockeQL server: ${error.message}`);
    console.error(
      "Set RELOCKEQL_CHAINS to a JSON endpoint map. RELOCKEQL_CONTRACTS is optional."
    );
    process.exitCode = 1;
  }
}
