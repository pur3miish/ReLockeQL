import {
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLResolveInfo
} from "graphql";

import {
  ABI,
  abi_to_graphql_ast,
  get_graphql_fields_from_AST
} from "./abi_to_graphql_ast.js";
import type { Abi } from "./blockchain/get_abi.js";

export interface AccountABI {
  abi: Abi;
  account_name: string;
}

interface GraphQLFieldsResult {
  query_fields: GraphQLFieldConfigMap<any, any>;
  mutation_fields: GraphQLInputFieldConfigMap;
}

interface ASTList {
  [key: string]: any;
}

interface QueryField {
  name: string;
  type: GraphQLObjectType;
  resolve: (
    root: any,
    args: any,
    context: any,
    info: GraphQLResolveInfo
  ) => any;
}

interface MutationField {
  type: GraphQLInputObjectType;
}

interface BuildGraphQLFieldsResult {
  query_fields: Record<string, QueryField>;
  mutation_fields: Record<string, MutationField>;
  ast_list: ASTList;
}

interface Context {
  network(
    root: any,
    args: any,
    info: any
  ): {
    rpc_url: string | URL | Request;
    fetchOptions: RequestInit;
  };
  signTransaction?: (transaction: any) => Promise<any>;
}

export function build_graphql_fields_from_abis(
  abi_list: AccountABI[],
  typeResolution = ""
): BuildGraphQLFieldsResult {
  const contract_query_fields: Record<string, QueryField> = {};
  const contract_mutation_fields: Record<string, MutationField> = {};
  const ast_list: ASTList = {};

  for (const { abi, account_name } of abi_list) {
    const name = account_name.replace(/\./g, "_");
    const AST = abi_to_graphql_ast(abi as ABI);

    ast_list[name] = AST; // For use in serializing data in mutation resolver.

    const { query_fields, mutation_fields }: GraphQLFieldsResult =
      get_graphql_fields_from_AST(AST, abi, name, typeResolution);

    if (Object.keys(query_fields).length) {
      contract_query_fields[name] = {
        name,
        type: new GraphQLObjectType({
          name: `${name}_query${typeResolution}`,
          fields: query_fields
        }),
        resolve(root, arg, context: Context, info) {
          return { code: info.fieldName.replace(/_/g, ".") };
        }
      };
    }

    if (Object.keys(mutation_fields).length) {
      contract_mutation_fields[name] = {
        type: new GraphQLInputObjectType({
          name: name + typeResolution,
          fields: mutation_fields
        })
      };
    }
  }

  return {
    query_fields: contract_query_fields,
    mutation_fields: contract_mutation_fields,
    ast_list
  };
}
