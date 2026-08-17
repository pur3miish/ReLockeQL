import { GraphQLError, GraphQLInt, GraphQLNonNull } from "graphql";

import { iso8601_datetime_type } from "../relocke_types/iso8601_datetime_type.js";
import { name_type } from "../relocke_types/name_type.js";
import type { Context } from "../types/Context.js";
import {
  fetchHyperionJson,
  hyperion_action_search_result_type,
  hyperionValues,
  normalizeHyperionActions,
  requireHyperionNetwork
} from "./hyperion.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

type HyperionActionsPayload = {
  actions?: unknown;
  query_time_ms?: unknown;
};

function dateTimeMs(value: string) {
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value);
  return Date.parse(hasOffset ? value : `${value}Z`);
}

export const get_actions = {
  description:
    "List a bounded set of newest-first actions for one notified account, contract, and action name through this chain's explicitly configured Hyperion endpoint. Omit time boundaries to retrieve the latest actions, or provide an optional lower boundary for a window of at most seven days. Total-result counting, offset pagination, arbitrary indexed-field filters, and ascending scans are not exposed.",
  type: new GraphQLNonNull(hyperion_action_search_result_type),
  args: {
    account: {
      description:
        "Account notified while the requested contract action executed.",
      type: new GraphQLNonNull(name_type)
    },
    contract: {
      description: "Account hosting the requested contract action.",
      type: new GraphQLNonNull(name_type)
    },
    action: {
      description: "Exact contract action name to list.",
      type: new GraphQLNonNull(name_type)
    },
    after: {
      description:
        "Optional exclusive lower time boundary as an ISO-8601 timestamp. When supplied, the search window may span no more than seven days.",
      type: iso8601_datetime_type
    },
    before: {
      description:
        "Optional exclusive upper time boundary as an ISO-8601 timestamp. Omit both boundaries to retrieve the latest actions, then pass the oldest returned action timestamp as before to page backward. When after is supplied, the window may span no more than seven days.",
      type: iso8601_datetime_type
    },
    limit: {
      description: `Number of recent actions to return, from 1 through ${MAX_LIMIT}. Defaults to ${DEFAULT_LIMIT}.`,
      type: GraphQLInt,
      defaultValue: DEFAULT_LIMIT
    }
  },
  async resolve(
    root: unknown,
    args: {
      account: string;
      action: string;
      after?: string;
      before?: string;
      contract: string;
      limit: number;
    },
    context: Context,
    info: Parameters<Context["network"]>[2]
  ) {
    const afterMs = args.after ? dateTimeMs(args.after) : null;
    const beforeMs = args.before ? dateTimeMs(args.before) : Date.now();

    if (
      !Number.isInteger(args.limit) ||
      args.limit < 1 ||
      args.limit > MAX_LIMIT ||
      (afterMs !== null &&
        (afterMs >= beforeMs || beforeMs - afterMs > MAX_WINDOW_MS))
    ) {
      throw new GraphQLError("Invalid Hyperion action search input.", {
        extensions: { code: "BAD_USER_INPUT" }
      });
    }

    const network = context.network(root, args, info);
    const hyperion = requireHyperionNetwork(network);
    const parameters: Record<string, string> = {
      account: args.account,
      filter: `${args.contract}:${args.action}`,
      limit: String(args.limit),
      noBinary: "true",
      sort: "desc",
      track: "false"
    };

    if (args.after) parameters.after = args.after;
    if (args.before) parameters.before = args.before;

    const response = await fetchHyperionJson(
      hyperion.url,
      "/v2/history/get_actions",
      parameters,
      hyperion.fetchOptions
    );

    const payload = response as HyperionActionsPayload;
    const actions = normalizeHyperionActions(payload?.actions);

    if (
      !actions ||
      actions.some(
        ({ action, contract, receivers }) =>
          action !== args.action ||
          contract !== args.contract ||
          !receivers.includes(args.account)
      )
    ) {
      throw new GraphQLError(
        "The configured Hyperion endpoint returned an invalid action-history response.",
        { extensions: { code: "HYPERION_MALFORMED_RESPONSE" } }
      );
    }

    return {
      actions,
      query_time_ms: hyperionValues.numberValue(payload.query_time_ms)
    };
  }
};
