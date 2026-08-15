// src/types/Context.ts
import { GraphQLResolveInfo } from "graphql";

export type NetworkContext = {
  rpc_url: string | URL | Request;
  hyperion_url?: string | URL;
  fetchOptions?: RequestInit;
  hyperionFetchOptions?: RequestInit;
};
export type SignTransactionContext = (
  hash: Uint8Array,
  serialized_transaction?: {
    chain_id: string;
    transaction_header: string;
    transaction_body: string;
  },
  transaction?: any
) => Promise<string[]>;

export type Context = {
  network(root: any, args: any, info: GraphQLResolveInfo): NetworkContext;
  signTransaction?: SignTransactionContext;
};
