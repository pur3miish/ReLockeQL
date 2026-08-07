import {
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { name_type } from "../relocke_types/name_type.js";

interface SmartContractData {
  wasm: string;
  abi: string;
  error?: any;
  message?: string;
}

const smart_contract_type = new GraphQLObjectType<SmartContractData>({
  name: "smart_contract_type",
  fields: () => ({
    wasm: {
      type: GraphQLString,
      description: "base64 encoded contract WASM"
    },
    abi: {
      description: "base64 encoded contract ABI",
      type: GraphQLString
    }
  })
});

interface GetSmartContractArgs {
  account_name: string;
}

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

export const get_smart_contract: GraphQLFieldConfig<
  unknown,
  any,
  GetSmartContractArgs
> = {
  description: "Retrieve a smart contract from the blockchain.",
  type: smart_contract_type,
  args: {
    account_name: {
      description: "The account holding the `smart contract`.",
      type: new GraphQLNonNull(name_type)
    }
  },
  async resolve(root, { account_name }, context: Context, info) {
    const { rpc_url, fetchOptions } = context.network(
      root,
      { account_name },
      info
    );

    const uri = `${rpc_url}/v1/chain/get_raw_code_and_abi`;

    const response = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        account_name,
        code_as_wasm: 1
      })
    });

    const data: SmartContractData = await response.json();

    if (data.error)
      throw new GraphQLError(data.message || "Unknown error", {
        // Cast to satisfy the extensions type
        extensions: data as Record<string, any>
      });

    return data;
  }
};
