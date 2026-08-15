import {
  GraphQLBoolean,
  GraphQLError,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { json_type } from "../relocke_types/json_type.js";
import type { NetworkContext } from "../types/Context.js";

const HYPERION_TIMEOUT_MS = 8_000;

type HyperionAuthorization = {
  actor: string;
  permission: string;
};

export type HyperionAction = {
  action: string;
  actors: string[];
  authorization: HyperionAuthorization[];
  block_num: number | null;
  contract: string;
  data: unknown;
  global_sequence: string | null;
  receivers: string[];
  timestamp: string | null;
  transaction_id: string;
};

export type HyperionTransaction = {
  actions: HyperionAction[];
  block_num: number | null;
  executed: boolean | null;
  last_indexed_block: number | null;
  last_indexed_block_time: string | null;
  lib: number | null;
  query_time_ms: number | null;
  timestamp: string | null;
  transaction_id: string;
};

type HyperionActionPayload = {
  "@timestamp"?: unknown;
  act?: {
    account?: unknown;
    authorization?: unknown;
    data?: unknown;
    name?: unknown;
  };
  block_num?: unknown;
  global_sequence?: unknown;
  receipts?: unknown;
  timestamp?: unknown;
  trx_id?: unknown;
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function numberValue(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : null;
}

function authorizationValue(value: unknown): HyperionAuthorization[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const entries = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const actor = stringValue((entry as { actor?: unknown }).actor);
    const permission = stringValue(
      (entry as { permission?: unknown }).permission
    );

    return actor && permission ? [{ actor, permission }] : [];
  });

  return entries;
}

function receiversValue(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const receivers = value.flatMap((receipt) => {
    if (!receipt || typeof receipt !== "object") return [];

    const receiver = stringValue((receipt as { receiver?: unknown }).receiver);
    return receiver ? [receiver] : [];
  });

  return [...new Set(receivers)];
}

export function normalizeHyperionActions(
  value: unknown,
  fallbackTransactionId?: string
): HyperionAction[] | null {
  if (!Array.isArray(value)) return null;

  const actions = value.map((entry) => {
    if (!entry || typeof entry !== "object") return null;

    const payload = entry as HyperionActionPayload;
    const contract = stringValue(payload.act?.account);
    const action = stringValue(payload.act?.name);
    const transaction_id =
      stringValue(payload.trx_id) ?? fallbackTransactionId ?? null;
    const authorization = authorizationValue(payload.act?.authorization);
    const receivers = receiversValue(payload.receipts);

    if (
      !contract ||
      !action ||
      !transaction_id ||
      !authorization ||
      !receivers ||
      (fallbackTransactionId &&
        transaction_id.toLowerCase() !== fallbackTransactionId.toLowerCase())
    ) {
      return null;
    }

    return {
      action,
      actors: [...new Set(authorization.map(({ actor }) => actor))],
      authorization,
      block_num: numberValue(payload.block_num),
      contract,
      data: payload.act?.data ?? null,
      global_sequence:
        typeof payload.global_sequence === "string" ||
        typeof payload.global_sequence === "number"
          ? String(payload.global_sequence)
          : null,
      receivers,
      timestamp:
        stringValue(payload.timestamp) ?? stringValue(payload["@timestamp"]),
      transaction_id
    } satisfies HyperionAction;
  });

  return actions.every(Boolean) ? (actions as HyperionAction[]) : null;
}

function hyperionError(code: string, message: string, status?: number) {
  return new GraphQLError(message, {
    extensions: { code, ...(status ? { status } : {}) }
  });
}

export function requireHyperionNetwork(network: NetworkContext) {
  if (!network.hyperion_url) {
    throw hyperionError(
      "HYPERION_ENDPOINT_REQUIRED",
      "Configure a Hyperion endpoint for this chain using its hyperion_<chain> key."
    );
  }

  return {
    fetchOptions: network.hyperionFetchOptions,
    url: network.hyperion_url
  };
}

export async function fetchHyperionJson(
  endpoint: string | URL,
  pathname: string,
  parameters: Record<string, string>,
  fetchOptions?: RequestInit
): Promise<unknown> {
  const url = new URL(pathname, endpoint);

  Object.entries(parameters).forEach(([name, value]) => {
    url.searchParams.set(name, value);
  });

  const headers = new Headers(fetchOptions?.headers);
  headers.set("Accept", "application/json");

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      method: "GET",
      headers,
      signal: fetchOptions?.signal ?? AbortSignal.timeout(HYPERION_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw hyperionError(
        "HYPERION_ENDPOINT_UNAVAILABLE",
        `The configured Hyperion endpoint returned HTTP ${response.status}.`,
        response.status
      );
    }

    try {
      return await response.json();
    } catch {
      throw hyperionError(
        "HYPERION_MALFORMED_RESPONSE",
        "The configured Hyperion endpoint returned invalid JSON."
      );
    }
  } catch (error) {
    if (error instanceof GraphQLError) throw error;

    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    throw hyperionError(
      timeout ? "HYPERION_TIMEOUT" : "HYPERION_ENDPOINT_UNAVAILABLE",
      timeout
        ? "The configured Hyperion endpoint did not respond within eight seconds."
        : "The configured Hyperion endpoint could not be reached."
    );
  }
}

const hyperion_authorization_type =
  new GraphQLObjectType<HyperionAuthorization>({
    name: "hyperion_authorization_type",
    fields: {
      actor: { type: new GraphQLNonNull(GraphQLString) },
      permission: { type: new GraphQLNonNull(GraphQLString) }
    }
  });

export const hyperion_action_type = new GraphQLObjectType<HyperionAction>({
  name: "hyperion_action_type",
  fields: {
    transaction_id: { type: new GraphQLNonNull(GraphQLString) },
    block_num: { type: GraphQLInt },
    timestamp: { type: GraphQLString },
    global_sequence: { type: GraphQLString },
    contract: { type: new GraphQLNonNull(GraphQLString) },
    action: { type: new GraphQLNonNull(GraphQLString) },
    authorization: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(hyperion_authorization_type))
      )
    },
    actors: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      )
    },
    receivers: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      )
    },
    data: { type: json_type }
  }
});

export const hyperion_transaction_type =
  new GraphQLObjectType<HyperionTransaction>({
    name: "hyperion_transaction_type",
    description: "A transaction and its actions returned by Hyperion history.",
    fields: {
      transaction_id: { type: new GraphQLNonNull(GraphQLString) },
      block_num: { type: GraphQLInt },
      timestamp: { type: GraphQLString },
      executed: { type: GraphQLBoolean },
      lib: { type: GraphQLInt },
      last_indexed_block: { type: GraphQLInt },
      last_indexed_block_time: { type: GraphQLString },
      query_time_ms: { type: GraphQLFloat },
      actions: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(hyperion_action_type))
        )
      }
    }
  });

export const hyperion_action_search_result_type = new GraphQLObjectType<{
  actions: HyperionAction[];
  query_time_ms: number | null;
}>({
  name: "hyperion_action_search_result_type",
  fields: {
    query_time_ms: { type: GraphQLFloat },
    actions: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(hyperion_action_type))
      )
    }
  }
});

export const hyperionValues = { numberValue, stringValue };
