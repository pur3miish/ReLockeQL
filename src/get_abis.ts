import { GraphQLError } from "graphql";

import type { Abi } from "./blockchain/get_abi.js";

interface FetchOptions extends RequestInit {}

interface GetAbisParams {
  rpc_url: string | URL | Request;
  fetchOptions?: FetchOptions;
}

export interface AbiResponse {
  account_name: string;
  abi?: Abi[];
  error?: {
    details?: Array<{ message?: string }>;
    message?: string;
  };
  message?: string;
}

// Extensions type for GraphQLError - index signature required
interface GraphQLErrorExtensions {
  [key: string]: any;
}

export async function get_abis(
  contracts: string[] = [],
  { rpc_url, fetchOptions = {} }: GetAbisParams
): Promise<AbiResponse[]> {
  if (!contracts.length) return [];

  const uri = `${rpc_url}/v1/chain/get_abi`;

  const abi_req = contracts.map((account_name) =>
    fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({ account_name, json: true })
    }).then((req) => req.json() as Promise<AbiResponse>)
  );

  const ABIs = await Promise.all(abi_req);

  const errors: { message: string }[] = [];
  ABIs.forEach(({ error, abi, account_name }, i) => {
    if (error) {
      try {
        if (error.details?.[0]?.message?.startsWith("unknown key ("))
          errors.push({ message: `No account found for “${contracts[i]}”` });
      } catch {
        // Cast ABIs[i] to GraphQLErrorExtensions so TypeScript accepts it as extensions
        throw new GraphQLError(ABIs[i].message || "Unknown error", {
          extensions: ABIs[i] as GraphQLErrorExtensions
        });
      }
    }
    if (!abi)
      errors.push({ message: `No contract found for “${account_name}”` });
  });

  if (errors.length)
    throw new GraphQLError("Invalid Relocke smart contracts provided.", {
      extensions: errors as unknown as GraphQLErrorExtensions
    });

  return ABIs;
}
