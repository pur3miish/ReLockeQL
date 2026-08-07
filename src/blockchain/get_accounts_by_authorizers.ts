import { base58_to_binary, binary_to_base58 } from "base58-js";
import {
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";
import { ripemd160 } from "ripemd160-js";

import { authorizing_account_type } from "../graphql_object_types/authorizing_account_type.js";
import { name_type } from "../relocke_types/name_type.js";
import { public_key_type } from "../relocke_types/public_key_type.js";

// --- TypeScript interfaces ---

interface AuthorizedAccount {
  account_name?: string;
  permission_name?: string;
  authorizing_key?: string;
  authorizing_account?: any; // Replace with authorizing_account_type TS interface if available
  weight?: string;
  threshold?: string;
}

interface AccountsByAuthorizersData {
  accounts?: AuthorizedAccount[];
}

// --- GraphQL Object Types ---

const authorized_accounts_type = new GraphQLObjectType<AuthorizedAccount>({
  name: "authorized_accounts_type",
  fields: () => ({
    account_name: { type: name_type },
    permission_name: { type: name_type },
    authorizing_key: { type: public_key_type },
    authorizing_account: { type: authorizing_account_type },
    weight: { type: GraphQLString },
    threshold: { type: GraphQLString }
  })
});

const accounts_by_authorizers_type =
  new GraphQLObjectType<AccountsByAuthorizersData>({
    name: "accounts_by_authorizers",
    description:
      "Fetch permissions authorities that are, in part or whole, satisfiable.",
    fields: () => ({
      accounts: { type: new GraphQLList(authorized_accounts_type) }
    })
  });

async function public_key_to_legacy(key: string): Promise<string> {
  if (!key.startsWith("PUB_K1_")) return key;

  const public_key = base58_to_binary(key.replace("PUB_K1_", "")).slice(0, -4);
  const checksum = ripemd160(public_key).slice(0, 4) as Uint8Array;

  return "EOS" + binary_to_base58(new Uint8Array([...public_key, ...checksum]));
}

// --- Context interface ---

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

// --- GraphQL FieldConfig for accounts_by_authorizers ---

export const accounts_by_authorizers: GraphQLFieldConfig<
  unknown,
  Context,
  { accounts?: string[]; keys?: string[] }
> = {
  type: accounts_by_authorizers_type,
  args: {
    accounts: { type: new GraphQLList(new GraphQLNonNull(name_type)) },
    keys: { type: new GraphQLList(new GraphQLNonNull(public_key_type)) }
  },
  async resolve(root, { accounts = [], keys = [] }, context, info) {
    const { rpc_url, fetchOptions } = context.network(
      root,
      { accounts, keys },
      info
    );

    const uri = `${rpc_url}/v1/chain/get_accounts_by_authorizers`;

    // Await all keys in case they're promises
    const awaited_keys = await Promise.all(keys);

    const processed_keys = await Promise.all(
      awaited_keys.map(public_key_to_legacy)
    );

    const response = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        keys: processed_keys,
        accounts,
        json: true
      })
    });

    const data = await response.json();

    if (data.error) throw new GraphQLError(data.message, { extensions: data });

    return data as AccountsByAuthorizersData;
  }
};
