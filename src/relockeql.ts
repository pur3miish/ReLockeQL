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
  chains?: { [chain_name in ChainsType]: URL | string };
  fetchOptions?: RequestInit;
  abiFetchOptions?: RequestInit;
  extendQuery?: ExtendQueryType;
};

export declare type RelockeQLResult = {
  data?: any;
  errors?: ReadonlyArray<GraphQLError>;
};

const defaultChains = [
  "vaulta",
  "telos",
  "xpr",
  "wax",
  "jungle"
] as ChainsType[];

export const default_rpc_urls = {
  // Chain - aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906
  vaulta: "https://eos.relocke.io",
  // Chain - 4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11
  telos: "https://telos.relocke.io",
  // chain - 384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0
  xpr: "https://proton.relocke.io",
  // chain - 1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4
  wax: "https://wax.relocke.io",
  // Chain - 73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d
  jungle: "https://jungle.relocke.io"
} as { [chain in ChainsType]: string | URL };

export async function RelockeQL(
  { query, variables, operationName }: RelockeQLRequest,
  options?: APIOptionsType
): Promise<RelockeQLResult> {
  const build_chains = new Set(defaultChains);

  if (options?.chains)
    Object.keys(options?.chains).forEach((chain) => build_chains.add(chain));

  const chains = [...build_chains];

  const fields = {} as {
    [chain in ChainsType]: GraphQLFieldConfig<unknown, unknown, unknown>;
  };

  const mutationFields = {} as {
    [chain in ChainsType]: GraphQLFieldConfig<unknown, unknown, unknown>;
  };

  for (const chain of chains) {
    const rpc_url = options?.chains?.[chain] ?? default_rpc_urls[chain];
    const contracts = options?.contracts?.[chain] ?? [];

    const typeResolution = chain.padStart(
      !chain.length ? 0 : chain.length + 1,
      "_"
    );

    const abis = (await get_abis(contracts, {
      rpc_url,
      fetchOptions: options?.abiFetchOptions
    })) as AbiResponse[];

    const T = abis.map((x) => ({
      account_name: x.account_name,
      abi: x.abi
    })) as AccountABI[];

    const { mutation_fields, query_fields, ast_list } =
      build_graphql_fields_from_abis(T, typeResolution);

    fields[chain as ChainsType] = {
      type: new GraphQLObjectType({
        description: `Query infomation about the ${chain} and smart contracts.`,
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
      resolve() {
        return {};
      },
      type: new GraphQLObjectType({
        description: `Serialise and update the smart contracts for ${chain}.`,
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

                if (options?.signTransaction) {
                  map.send_transaction = send_transaction(a, ast_list);
                }

                return map;
              })()
            : {})
        }
      })
    };
  }

  const extended_query = options?.extendQuery?.query ?? {};
  const queries = new GraphQLObjectType({
    name: "Query",
    fields: {
      ...fields,
      ...extended_query
    }
  });
  const extended_mutation = options?.extendQuery?.mutation ?? {};

  const mutations = new GraphQLObjectType({
    name: "Mutation",
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
        const rpc_url = options?.chains?.[chain] ?? default_rpc_urls[chain];

        return { rpc_url, fetchOptions: options?.fetchOptions };
      },
      async signTransaction(hash, serialized_transaction, transaction) {
        if (options?.signTransaction)
          return options?.signTransaction(
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
