import { GraphQLError, GraphQLResolveInfo } from "graphql";

import { type Context } from "./types/Context.js";

/** Arguments passed to the resolver */
interface QueryArg {
  key_type?: string;
  encode_type?: string;
  lower_bound?: string;
  [key: string]: any; // other possible query arguments
}

/** Root object received by resolver */
interface Root {
  code: string;
}

/** Args object received by resolver */
interface Args {
  arg?: QueryArg;
}

export interface TableQueryResult {
  rows: any[];
  more: boolean;
  next_key: string;
}

interface TableQueryResponse extends TableQueryResult {
  error?: unknown;
  message?: string;
}

/**
 * RelockeQL Query resolver.
 * @param root GraphQL resolver root query
 * @param args Query arguments object
 * @param context RelockeQL request context
 * @param info GraphQL resolver info object
 * @returns Rows and pagination metadata from the queried table
 */
export async function query_resolver(
  root: Root,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
): Promise<TableQueryResult> {
  const { code } = root;
  const arg: QueryArg = {
    scope: "",
    index_position: 1,
    key_type: "name",
    encode_type: "dec",
    ...args.arg
  };
  const { rpc_url, fetchOptions } = context.network(root, args, info);

  const { fieldName: query_name } = info;
  const table = query_name.replace(/_/g, ".");

  if (
    arg.key_type === "i256" ||
    arg.key_type === "ripemd160" ||
    arg.key_type === "sha256"
  ) {
    arg.encode_type = "hex";
    arg.lower_bound = arg.lower_bound ?? "00";
  }

  const uri = rpc_url + "/v1/chain/get_table_rows";

  const response = await fetch(uri, {
    method: "POST",
    ...fetchOptions,
    body: JSON.stringify({ json: true, code, table, ...arg })
  });

  const data = (await response.json()) as TableQueryResponse;

  if (data.error) {
    throw new GraphQLError(data.message || "Unknown error", {
      extensions: data as unknown as Record<string, unknown>
    });
  }

  return data;
}
