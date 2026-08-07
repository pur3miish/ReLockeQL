import {
  GraphQLError,
  GraphQLFieldConfigMap,
  GraphQLList,
  GraphQLObjectType
} from "graphql";

import { bytes_type } from "../relocke_types/bytes_type.js";
import { public_key_type } from "../relocke_types/public_key_type.js";
import { sha256 } from "../utils/sha256.js";

// Define the input structure expected for resolve functions
export interface PackedTransaction {
  chain_id: string;
  transaction_header: string;
  transaction_body: string;
  available_keys?: string[];
  transaction?: {
    actions: {
      hex_data?: string;
      [key: string]: any;
    }[];
    [key: string]: any;
  };
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

export const packed_transaction_fields: GraphQLFieldConfigMap<
  PackedTransaction,
  any
> = {
  chain_id: {
    type: bytes_type,
    description: "A unique ID that specifies which chain we are operating on."
  },
  transaction_header: {
    type: bytes_type,
    description: "Serialized transaction header."
  },
  transaction_body: {
    type: bytes_type,
    description: "Serialized transaction body _(bytecode instructions)_."
  },
  required_keys: {
    type: new GraphQLList(public_key_type),
    description: "List of public keys needed to authorize transaction",
    async resolve(
      { available_keys, transaction },
      args,
      context: Context,
      info
    ) {
      const { rpc_url, fetchOptions } = context.network(
        { available_keys, transaction },
        args,
        info
      );

      if (available_keys?.length) {
        const keys = await Promise.all(available_keys);
        const req = await fetch(rpc_url + "/v1/chain/get_required_keys", {
          method: "POST",
          body: JSON.stringify({
            transaction: {
              ...transaction,
              actions: transaction?.actions.map(({ hex_data, ...action }) => ({
                ...action,
                data: hex_data
              }))
            },
            available_keys: keys
          }),
          ...fetchOptions
        }).then((res) => res.json());

        if (req.error) {
          throw new GraphQLError(req.message || "Unknown error", {
            extensions: { code: "CHAIN_ERROR", ...req.error }
          });
        }

        return req.required_keys;
      }

      return [];
    }
  },
  hash: {
    type: bytes_type,
    description: "Transaction hash to sign to authorize transaction",
    async resolve({ chain_id, transaction_header, transaction_body }) {
      const transaction_bytes =
        chain_id +
        transaction_header +
        transaction_body +
        "0000000000000000000000000000000000000000000000000000000000000000";

      const hash_to_sign = await sha256(
        Uint8Array.from(
          transaction_bytes
            .match(/[a-fA-F0-9]{2}/gmu)!
            .map((i) => Number(`0x${i}`))
        )
      );

      return [...hash_to_sign]
        .map((x) => Number(x).toString(16).padStart(2, "0"))
        .join("");
    }
  }
};

export const packed_transaction_type = new GraphQLObjectType<PackedTransaction>(
  {
    name: "packed_transaction",
    description: "Packed transaction, chain ID and transaction header",
    fields: packed_transaction_fields
  }
);
