import {
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { name_type } from "../relocke_types/name_type.js";

// --- TypeScript Interfaces for Relocke ABI ---

interface AbiVariant {
  name?: string;
  types?: string[];
}

interface AbiRicardianClause {
  id?: string;
  body?: string;
}

interface AbiTable {
  name: string;
  index_type?: string;
  type: string;
  key_names?: string[];
  key_types?: string[];
}

interface AbiAction {
  name: string;
  type: string;
  ricardian_contract?: string;
}

interface AbiType {
  new_type_name?: string;
  type?: string;
}

interface AbiField {
  name?: string;
  type?: string;
}

interface AbiStruct {
  name?: string;
  base?: string;
  fields?: AbiField[];
}

export interface Abi {
  actions?: AbiAction[];
  ricardian_clauses?: AbiRicardianClause[];
  structs?: AbiStruct[];
  types?: AbiType[];
  tables?: AbiTable[];
  variants?: AbiVariant[];
  version?: string;
}

// --- GraphQL Object Types ---

const variants_type = new GraphQLObjectType<AbiVariant>({
  name: "abi_variant_type",
  fields: () => ({
    name: { type: GraphQLString },
    types: { type: new GraphQLList(GraphQLString) }
  })
});

const ricardian_clauses_type = new GraphQLObjectType<AbiRicardianClause>({
  name: "abi_ricardian_clauses",
  fields: () => ({
    id: { type: GraphQLString },
    body: { type: GraphQLString }
  })
});

const tables_type = new GraphQLObjectType<AbiTable>({
  name: "abi_tables_type",
  fields: () => ({
    name: { type: GraphQLString },
    index_type: { type: GraphQLString },
    type: { type: GraphQLString },
    key_names: { type: new GraphQLList(GraphQLString) },
    key_types: { type: new GraphQLList(GraphQLString) }
  })
});

const actions_type = new GraphQLObjectType<AbiAction>({
  name: "abi_actions_type",
  fields: () => ({
    name: { type: GraphQLString },
    type: { type: GraphQLString },
    ricardian_contract: { type: GraphQLString }
  })
});

const types_type = new GraphQLObjectType<AbiType>({
  name: "abi_types_type",
  fields: () => ({
    new_type_name: { type: GraphQLString },
    type: {
      description: "Native and blockchain types.",
      type: GraphQLString
    }
  })
});

const field_type = new GraphQLObjectType<AbiField>({
  name: "abi_field_type",
  fields: () => ({
    name: { type: GraphQLString },
    type: { type: GraphQLString }
  })
});

const struct_type = new GraphQLObjectType<AbiStruct>({
  name: "abi_struct_type",
  fields: () => ({
    name: { type: GraphQLString },
    base: { type: GraphQLString },
    fields: { type: new GraphQLList(field_type) }
  })
});

const abi_type = new GraphQLObjectType<Abi>({
  name: "abi_type",
  description:
    "The Application Binary Interface (ABI) is a JSON-based description on how to convert user actions between their JSON and Binary representations.",
  fields: () => ({
    actions: { type: new GraphQLList(actions_type) },
    ricardian_clauses: {
      description:
        "Ricardian clauses describe the intended outcome of a particular action. It may also be utilized to establish terms between the sender and the contract.",
      type: new GraphQLList(ricardian_clauses_type)
    },
    structs: { type: new GraphQLList(struct_type) },
    types: { type: new GraphQLList(types_type) },
    tables: { type: new GraphQLList(tables_type) },
    variants: { type: new GraphQLList(variants_type) },
    version: { type: GraphQLString }
  })
});

// --- Context Type ---

export interface Context {
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

// --- GraphQL Field Config for get_abi ---

export const get_abi: GraphQLFieldConfig<
  unknown,
  Context,
  { account_name: string }
> = {
  description: "Retrieve an application binary interface (ABI).",
  type: abi_type,
  args: {
    account_name: {
      description: "Account name of the smart contract holder.",
      type: new GraphQLNonNull(name_type)
    }
  },
  async resolve(root, args, context, info): Promise<Abi> {
    const { rpc_url, fetchOptions } = context.network(root, args, info);

    const uri = `${rpc_url}/v1/chain/get_abi`;
    const res = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        account_name: args.account_name,
        json: true
      })
    });

    const data = await res.json();

    if (data.error) throw new GraphQLError(data.message, { extensions: data });

    return data.abi as Abi;
  }
};
