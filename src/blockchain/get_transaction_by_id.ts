import { GraphQLError, GraphQLNonNull } from "graphql";

import { relocke_types } from "../relocke_types.js";
import type { Context } from "../types/Context.js";
import {
  fetchHyperionJson,
  hyperion_transaction_type,
  type HyperionTransaction,
  hyperionValues,
  normalizeHyperionActions,
  requireHyperionNetwork
} from "./hyperion.js";

type HyperionTransactionPayload = {
  actions?: unknown;
  block_num?: unknown;
  error?: unknown;
  executed?: unknown;
  last_indexed_block?: unknown;
  last_indexed_block_time?: unknown;
  lib?: unknown;
  query_time_ms?: unknown;
  timestamp?: unknown;
  trx_id?: unknown;
};

export const get_transaction_by_id = {
  description:
    "Retrieve one transaction and all of its actions from this chain's explicitly configured Hyperion endpoint. Returns null only when Hyperion confirms the transaction was not found; provider failures are returned as GraphQL errors.",
  type: hyperion_transaction_type,
  args: {
    id: {
      description:
        "The exact 64-character hexadecimal transaction ID to retrieve.",
      type: new GraphQLNonNull(relocke_types.checksum256)
    }
  },
  async resolve(
    root: unknown,
    args: { id: string },
    context: Context,
    info: Parameters<Context["network"]>[2]
  ): Promise<HyperionTransaction | null> {
    const network = context.network(root, args, info);
    const hyperion = requireHyperionNetwork(network);
    const transactionId = args.id.toLowerCase();
    const response = await fetchHyperionJson(
      hyperion.url,
      "/v2/history/get_transaction",
      { id: transactionId },
      hyperion.fetchOptions
    );

    if (!response || typeof response !== "object") {
      throw new GraphQLError(
        "The configured Hyperion endpoint returned an invalid transaction response.",
        { extensions: { code: "HYPERION_MALFORMED_RESPONSE" } }
      );
    }

    const payload = response as HyperionTransactionPayload;
    const responseTransactionId = hyperionValues.stringValue(payload.trx_id);
    const noActions =
      payload.actions === undefined ||
      payload.actions === null ||
      (Array.isArray(payload.actions) && payload.actions.length === 0);

    if (
      payload.executed === false &&
      noActions &&
      !payload.error &&
      (!responseTransactionId ||
        responseTransactionId.toLowerCase() === transactionId)
    ) {
      return null;
    }

    if (
      responseTransactionId &&
      responseTransactionId.toLowerCase() !== transactionId
    ) {
      throw new GraphQLError(
        "The configured Hyperion endpoint returned a different transaction ID.",
        { extensions: { code: "HYPERION_MALFORMED_RESPONSE" } }
      );
    }

    if (payload.executed === false) {
      throw new GraphQLError(
        "The configured Hyperion endpoint returned a contradictory transaction response.",
        { extensions: { code: "HYPERION_MALFORMED_RESPONSE" } }
      );
    }

    const actions = normalizeHyperionActions(
      payload.actions,
      responseTransactionId ?? transactionId
    );

    if (!actions || payload.error) {
      throw new GraphQLError(
        "The configured Hyperion endpoint returned an invalid transaction response.",
        { extensions: { code: "HYPERION_MALFORMED_RESPONSE" } }
      );
    }

    return {
      actions,
      block_num:
        hyperionValues.numberValue(payload.block_num) ??
        actions[0]?.block_num ??
        null,
      executed: typeof payload.executed === "boolean" ? payload.executed : null,
      last_indexed_block: hyperionValues.numberValue(
        payload.last_indexed_block
      ),
      last_indexed_block_time: hyperionValues.stringValue(
        payload.last_indexed_block_time
      ),
      lib: hyperionValues.numberValue(payload.lib),
      query_time_ms: hyperionValues.numberValue(payload.query_time_ms),
      timestamp:
        hyperionValues.stringValue(payload.timestamp) ??
        actions[0]?.timestamp ??
        null,
      transaction_id: responseTransactionId ?? transactionId
    };
  }
};
