import {
  GraphQLBoolean,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLResolveInfo
} from "graphql";

import { relocke_types } from "./relocke_types.js";
import { authorization_type } from "./graphql_input_types/authorization.js";
import { query_arg_fields as query_argument_fields } from "./graphql_input_types/query_argument_fields.js";
import { query_resolver as resolve } from "./query_resolver.js";
import type { Abi } from "./blockchain/get_abi.js";

interface BaseFieldInfo {
  object: boolean;
  optional: boolean;
  list: boolean;
  binary_ex: boolean;
  variant: boolean;
}

interface ASTField {
  name: string;
  type: string;
  $info: BaseFieldInfo;
}

interface ABIField {
  name: string;
  type: string;
}

interface ABIStruct {
  name: string;
  base?: string;
  fields: ABIField[];
}

interface ABIAction {
  name: string;
  type: string;
  ricardian_contract?: string;
}

export interface ABI {
  version: string;
  tables: { name: string; type: string }[];
  actions: ABIAction[];
  structs: ABIStruct[];
  types?: any[];
  variants?: any[];
}

interface GraphQLFieldWithResolve extends GraphQLFieldConfig<any, any> {
  resolve?: (
    source: any,
    args: any,
    context: any,
    info: GraphQLResolveInfo
  ) => any;
}

interface GraphQLFields {
  [key: string]: GraphQLFieldWithResolve;
}

interface GraphQLInaputFields {
  [key: string]: { type: any };
}

/**
 * Recursively resolves all the base fields and collects them into a single array.
 * @param base Base struct field name.
 * @param structs List of ABI structs.
 * @returns List of base fields.
 */
function handleBaseFields(base: string, structs: ABIStruct[]): ABIField[] {
  const base_struct = structs.find(({ name }) => name === base);
  if (!base_struct) {
    throw new Error(`Base struct "${base}" not found`);
  }
  const { fields, base: nested_base } = base_struct;
  return [
    ...(nested_base ? handleBaseFields(nested_base, structs) : []),
    ...fields
  ];
}

/**
 * Performs some transformations on the ABI structs to make it malleable to the GraphQL spec.
 * ABI structs are converted onto GraphQL Types.
 * @param structs ABI structs
 * @param type_alias Type alias map
 * @returns Struct AST that will be consumed by abi_to_graphql_ast
 */
function handleStructs(
  structs: ABIStruct[],
  type_alias: Record<string, string>
): Record<string, ASTField[]> {
  const graphql_ast_structs: Record<string, ASTField[]> = {};

  for (const struct of structs) {
    const { name, base, fields } = struct;
    const fields_with_base_fields = base
      ? [...handleBaseFields(base, structs), ...fields]
      : fields;
    const ast_fields: ASTField[] = [];
    for (const field of fields_with_base_fields) {
      const optional = !!field.type.match(/[$?]/g);
      const binary_ex = !!field.type.match(/\$/g);
      const variant = !!field.type.match(/@/g);
      const list = !!field.type.match(/\[\]/g);
      let type = field.type.replace(/[[\]?$@]/g, "");
      type = type_alias[type] ?? type;

      const object = !relocke_types[type];
      ast_fields.push({
        name: field.name,
        type,
        $info: { object, optional, list, binary_ex, variant }
      });
    }
    graphql_ast_structs[name] = ast_fields;
  }
  return graphql_ast_structs;
}

/**
 * Generate an Abstract syntax tree (AST) for an EOSIO application Binary interface (ABI).
 * @param abi EOSIO smart contract Application Binary interface (ABI).
 * @returns a GraphQL AST for a given smart contract.
 */
export function abi_to_graphql_ast(
  abi: ABI
): Readonly<Record<string, ASTField[]>> {
  const { types, variants, structs } = abi;
  const type_alias: Record<string, string> = {};
  const new_structs: ABIStruct[] = [...structs];

  if (variants?.length) {
    for (const { name, types: variant_types } of variants) {
      new_structs.push({
        name: name!,
        base: "",
        fields: variant_types!.map((item: string) => ({
          name: item,
          type: item + "$@"
        })) // @ indiacted a variant type and binary extension.
      });
    }
  }

  if (types?.length) {
    for (const { type: real_type, new_type_name } of types) {
      if (real_type && new_type_name) {
        if (relocke_types[real_type]) {
          type_alias[new_type_name] = real_type;
          continue;
        }

        if (real_type.endsWith("[]")) {
          new_structs.push({
            name: new_type_name,
            base: "",
            fields: [
              {
                name: real_type.replace("[]", ""),
                type: real_type
              }
            ]
          });
          continue;
        }

        const foundStruct = new_structs.find((x) => x.name === real_type);
        if (foundStruct) {
          new_structs.push({
            ...foundStruct,
            name: new_type_name
          });
        }
      }
    }
  }

  const structs_ast = handleStructs(new_structs, type_alias);
  return Object.freeze(structs_ast);
}

/**
 * Wraps a GraphQL type in a GraphQLNonNullType and GraphQLListType.
 * @param type GraphQL type to wrap.
 * @param param1 Optional and list info.
 * @returns wrapped GraphQL type.
 */
function Wrap(
  type: any,
  { optional, list }: { optional: boolean; list: boolean }
): any {
  let gql_type = type;
  if (list) gql_type = new GraphQLList(gql_type);
  if (!optional) gql_type = new GraphQLNonNull(gql_type);
  return gql_type;
}

/**
 * Generates GraphQL query and mutation fields from an ABI AST.
 * @param AST Abstract syntax tree generated by abi_to_graphql_ast function.
 * @param ABI Relocke application binary interface (ABI).
 * @param account_name Blockchain account name.
 * @param chainName Optional chain name.
 * @returns GraphQL query and mutation fields.
 */
export function get_graphql_fields_from_AST(
  AST: Readonly<Record<string, ASTField[]>>,
  ABI: Abi,
  account_name = "",
  chainName = ""
): {
  query_fields: GraphQLFieldConfigMap<any, any>;
  mutation_fields: GraphQLInputFieldConfigMap;
} {
  const { tables = [], actions = [] } = ABI;
  const gql_account_name = account_name.replace(/\./g, "_") + "_";

  const query_fields: GraphQLFieldConfigMap<any, any> = {};
  const queryTypes: Record<string, GraphQLFieldConfig<any, any>> = {};
  const GQL_TYPES: Record<string, GraphQLObjectType> = {};

  for (let table of tables) {
    let { name: table_name, type: table_type } = table;

    table_name = table_name.replace(/\./g, "_");
    const table_fields = AST[table_type];

    const buildQGL = (
      fields: ASTField[],
      acc: GraphQLFieldConfigMap<any, any> = {}
    ): GraphQLFieldConfigMap<any, any> => {
      for (const field of fields) {
        const { name, type, $info } = field;

        // Do this because of variant type from table.
        const resolveFn = (data: any, args: any, context: any, info: any) => {
          if ($info.variant) return type === data[0] ? data[1] : null;
          return data[info.fieldName];
        };

        if ($info.object) {
          if (!GQL_TYPES[type])
            GQL_TYPES[type] = new GraphQLObjectType({
              name: gql_account_name + type + chainName,
              fields: buildQGL(AST[type])
            });

          acc[name] = {
            type: Wrap(GQL_TYPES[type], $info),
            resolve: resolveFn
          };
        } else {
          acc[name] = {
            type: Wrap(relocke_types[type], $info),
            resolve: resolveFn
          };
        }
      }
      return acc;
    };

    if (!queryTypes[table_type]) {
      const row_type = new GraphQLObjectType({
        name: gql_account_name + table_type + "_query" + chainName,
        fields: buildQGL(table_fields)
      });

      queryTypes[table_type] = {
        type: new GraphQLObjectType({
          name: gql_account_name + table_type + "_query_page" + chainName,
          fields: {
            rows: {
              type: new GraphQLList(row_type),
              description: "Rows returned from the contract table."
            },
            more: {
              type: GraphQLBoolean,
              description: "Whether more rows are available."
            },
            next_key: {
              type: GraphQLString,
              description: "Key to use as the next lower bound."
            }
          }
        }),
        args: {
          arg: {
            // @ts-ignore
            name: "argument_type",
            type: query_argument_fields
          }
        },
        resolve
      };
    }

    query_fields[table_name] = queryTypes[table_type];
  }

  const GQL_MTYPES: Record<string, GraphQLInputObjectType> = {};
  const mutation_fields: GraphQLInputFieldConfigMap = {};
  const mutationTypes: Record<string, { type: GraphQLInputObjectType }> = {};

  for (const action of actions) {
    let {
      name: action_name,
      type: action_type,
      ricardian_contract = ""
    } = action;
    action_name = action_name.replace(/\./g, "_");
    const action_fields = AST[action_type];

    const buildQGL = (
      fields: ASTField[],
      acc: GraphQLInputFieldConfigMap = {}
    ): GraphQLInputFieldConfigMap => {
      for (const field of fields) {
        const { name, type, $info } = field;

        if ($info.object) {
          if (!GQL_MTYPES[type])
            GQL_MTYPES[type] = new GraphQLInputObjectType({
              name: gql_account_name + "input_" + type + chainName,
              fields: buildQGL(AST[type])
            });
          acc[name] = { type: Wrap(GQL_MTYPES[type], $info) };
        } else {
          acc[name] = { type: Wrap(relocke_types[type], $info) };
        }
      }
      return acc;
    };

    if (!mutationTypes[action_type]) {
      mutationTypes[action_type] = {
        type: new GraphQLInputObjectType({
          name: gql_account_name + action_type + chainName,
          description: ricardian_contract
            .replace(/(https?|http|ftp):\/\/[^\s$.?#].[^\s]*$/g, "")
            .replace(/icon:/g, "")
            .replace(/(\s)?nowrap(\s)?/g, ""),
          fields: {
            ...buildQGL(action_fields),
            authorization: {
              description: "Authorization to sign the transaction",
              type: new GraphQLList(new GraphQLNonNull(authorization_type))
            }
          }
        })
      };
    }

    mutation_fields[action_name] = mutationTypes[action_type];
  }

  return { query_fields, mutation_fields };
}
