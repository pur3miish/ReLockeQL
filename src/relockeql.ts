import {
  execute,
  type GraphQLError,
  type GraphQLFieldConfig,
  type GraphQLFieldConfigMap,
  GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSchema,
  parse,
  type ResponsePath,
  Source,
  validate
} from "graphql";

import { blockchain_query_field } from "./blockchain_query_field.js";
import {
  type AccountABI,
  build_graphql_fields_from_abis
} from "./build_graphql_fields_from_abis.js";
import { type AbiResponse, get_abis } from "./get_abis.js";
import { actions_type as actions } from "./graphql_input_types/actions.js";
import { send_serialized_transaction } from "./send_serialized_transaction.js";
import { send_transaction } from "./send_transaction.js";
import { serialize_transaction } from "./serialize_transaction.js";
import type { Context, SignTransactionContext } from "./types/Context.js";

export interface RelockeQLRequest {
  query: string;
  operationName?: string | null;
  variables?: Record<string, any> | null;
}

/**
 * List of Relocke chains.
 */
declare type ChainsType =
  "vaulta" | "telos" | "xpr" | "wax" | "jungle" | string;

/**
 * Lists you smart contracts across the various Relocke chains.
 */
export declare type ContractsType = {
  [key in ChainsType]?: string[];
};

/**
 * RPC endpoints use their chain name. Hyperion history endpoints use the
 * corresponding `hyperion_<chain>` key and never create a top-level schema.
 */
export declare type ChainEndpointsType = {
  [endpoint_name: string]: URL | string | undefined;
};

/**
 * Enables you to enhance your GraphQL schema to add auxiliary queries and mnutation fields to your API.
 */
declare type ExtendQueryType = {
  query?: {
    [name in string]: GraphQLFieldConfig<unknown, unknown, unknown>;
  };
  mutation?: {
    [name in string]: GraphQLFieldConfig<unknown, unknown, unknown>;
  };
};

export declare type APIOptionsType = {
  signTransaction?: SignTransactionContext;
  contracts?: ContractsType;
  chains: ChainEndpointsType;
  fetchOptions?: RequestInit;
  hyperionFetchOptions?: RequestInit;
  abiFetchOptions?: RequestInit;
  extendQuery?: ExtendQueryType;
};

export declare type RelockeQLResult = {
  data?: any;
  errors?: ReadonlyArray<GraphQLError>;
};

export async function RelockeQL(
  { query, variables, operationName }: RelockeQLRequest,
  options: APIOptionsType
): Promise<RelockeQLResult> {
  const chains = Object.entries(options?.chains ?? {})
    .filter(([name, endpoint]) => !name.startsWith("hyperion_") && endpoint)
    .map(([name]) => name as ChainsType);

  if (!chains.length) {
    throw new Error(
      "RelockeQL requires at least one RPC endpoint in options.chains."
    );
  }

  const fields = {} as {
    [chain in ChainsType]: GraphQLFieldConfig<unknown, unknown, unknown>;
  };

  const mutationFields = {} as {
    [chain in ChainsType]: GraphQLFieldConfig<unknown, unknown, unknown>;
  };

  for (const chain of chains) {
    const rpc_url = options.chains[chain]!;
    const contracts = options.contracts?.[chain] ?? [];

    const typeResolution = chain.padStart(
      !chain.length ? 0 : chain.length + 1,
      "_"
    );

    const abis = (await get_abis(contracts, {
      rpc_url,
      fetchOptions: options.abiFetchOptions
    })) as AbiResponse[];

    const T = abis.map((x) => ({
      account_name: x.account_name,
      abi: x.abi
    })) as AccountABI[];

    const { mutation_fields, query_fields, ast_list } =
      build_graphql_fields_from_abis(T, typeResolution);

    fields[chain as ChainsType] = {
      description: `Query ${chain} blockchain state, history, and configured smart contracts.`,
      type: new GraphQLObjectType({
        description: `Queries available for the ${chain} blockchain and its configured smart contracts.`,
        name: `${chain}_query`,
        fields: {
          get_blockchain: blockchain_query_field,
          ...query_fields
        }
      }),
      resolve() {
        return {};
      }
    };

    mutationFields[chain as ChainsType] = {
      description: `Build and submit transactions for the ${chain} blockchain.`,
      resolve() {
        return {};
      },
      type: new GraphQLObjectType({
        description: `Transaction serialization and submission operations for the ${chain} blockchain.`,
        name: chain + "_mutation",
        fields: {
          send_serialized_transaction,
          ...(Object.keys(mutation_fields)?.length
            ? ((): GraphQLFieldConfigMap<any, Context> => {
                const a = actions(mutation_fields, typeResolution);
                const serialize_transaction_type = serialize_transaction(
                  a,
                  ast_list
                );

                const map: GraphQLFieldConfigMap<any, Context> = {
                  serialize_transaction: serialize_transaction_type
                };

                if (options.signTransaction) {
                  map.send_transaction = send_transaction(a, ast_list);
                }

                return map;
              })()
            : {})
        }
      })
    };
  }

  const extended_query = options.extendQuery?.query ?? {};
  const queries = new GraphQLObjectType({
    name: "Query",
    description: "Configured blockchain query entry points.",
    fields: {
      ...fields,
      ...extended_query
    }
  });
  const extended_mutation = options.extendQuery?.mutation ?? {};

  const mutations = new GraphQLObjectType({
    name: "Mutation",
    description: "Configured blockchain transaction entry points.",
    fields: { ...mutationFields, ...extended_mutation }
  });

  const schema = new GraphQLSchema({ query: queries, mutation: mutations });
  const document = parse(new Source(query));
  const queryErrors = validate(schema, document);

  if (queryErrors?.length) return { errors: queryErrors };

  const data = await execute({
    schema,
    document,
    rootValue: {},
    contextValue: {
      network: (root: unknown, args: unknown, info: GraphQLResolveInfo) => {
        const getFieldPath = (path: ResponsePath, c?: ResponsePath): string =>
          !path.prev
            ? (c?.typename ?? "")
                .replace(/_query$/gmu, "")
                .replace(/_mutation$/gmu, "")
            : getFieldPath(path.prev, path);

        const chain = getFieldPath(info.path) as ChainsType;
        const rpc_url = options.chains[chain];

        if (!rpc_url) {
          throw new Error(`No RPC endpoint configured for ${chain}.`);
        }

        return {
          rpc_url,
          hyperion_url: options.chains[`hyperion_${chain}`],
          fetchOptions: options.fetchOptions,
          hyperionFetchOptions: options.hyperionFetchOptions
        };
      },
      async signTransaction(hash, serialized_transaction, transaction) {
        if (options.signTransaction)
          return options.signTransaction(
            hash,
            serialized_transaction,
            transaction
          );
      }
    } as Context,
    variableValues: variables,
    operationName,
    fieldResolver(rootValue, args, ctx, { fieldName }) {
      return rootValue[fieldName];
    }
  });

  return data;
}
