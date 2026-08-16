import {
  getDirectiveValues,
  GraphQLError,
  type GraphQLFieldConfig,
  GraphQLIncludeDirective,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  GraphQLString,
  Kind,
  type SelectionSetNode
} from "graphql";

import { relocke_types } from "../relocke_types.js";
import { name_type } from "../relocke_types/name_type.js";
import type { Context, NetworkContext } from "../types/Context.js";

interface SmartContractSource {
  account_name: string;
  cache: Map<string, Promise<unknown>>;
  network: NetworkContext;
  selectedFields: Set<string>;
}

interface RpcResponse {
  error?: unknown;
  message?: string;
}

interface RawCodeAndAbiResponse extends RpcResponse {
  abi: string;
  wasm: string;
}

interface RawAbiResponse extends RpcResponse {
  abi: string;
  abi_hash: string;
  code_hash: string;
}

interface CodeHashResponse extends RpcResponse {
  code_hash: string;
}

interface GetSmartContractArgs {
  account_name: string;
}

function selectionIsIncluded(
  node: Parameters<typeof getDirectiveValues>[1],
  variableValues: GraphQLResolveInfo["variableValues"]
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.if === true) return false;

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues
  );
  return include?.if !== false;
}

function collectSelectedFields(
  selectionSet: SelectionSetNode,
  info: GraphQLResolveInfo,
  selectedFields: Set<string>,
  visitedFragments: Set<string>
): void {
  for (const selection of selectionSet.selections) {
    if (!selectionIsIncluded(selection, info.variableValues)) continue;

    if (selection.kind === Kind.FIELD) {
      selectedFields.add(selection.name.value);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      collectSelectedFields(
        selection.selectionSet,
        info,
        selectedFields,
        visitedFragments
      );
      continue;
    }

    const fragmentName = selection.name.value;
    if (visitedFragments.has(fragmentName)) continue;

    const fragment = info.fragments[fragmentName];
    if (!fragment) continue;

    visitedFragments.add(fragmentName);
    collectSelectedFields(
      fragment.selectionSet,
      info,
      selectedFields,
      visitedFragments
    );
  }
}

function getSelectedFields(info: GraphQLResolveInfo): Set<string> {
  const selectedFields = new Set<string>();
  const visitedFragments = new Set<string>();

  for (const fieldNode of info.fieldNodes) {
    if (fieldNode.selectionSet) {
      collectSelectedFields(
        fieldNode.selectionSet,
        info,
        selectedFields,
        visitedFragments
      );
    }
  }

  return selectedFields;
}

function needsRawAbi(selectedFields: Set<string>): boolean {
  return (
    selectedFields.has("abi_hash") ||
    (selectedFields.has("abi") && !selectedFields.has("wasm"))
  );
}

function fetchContractEndpoint<T extends RpcResponse>(
  source: SmartContractSource,
  endpoint: "get_code_hash" | "get_raw_abi" | "get_raw_code_and_abi"
): Promise<T> {
  const uri = `${source.network.rpc_url}/v1/chain/${endpoint}`;
  const cacheKey = JSON.stringify([
    "get_smart_contract",
    uri,
    source.account_name
  ]);
  const cached = source.cache.get(cacheKey) as Promise<T> | undefined;
  if (cached) return cached;

  const request = fetch(uri, {
    method: "POST",
    ...source.network.fetchOptions,
    body: JSON.stringify({ account_name: source.account_name })
  }).then(async (response) => {
    const data = (await response.json()) as T;

    if (data.error) {
      throw new GraphQLError(data.message || "Unknown error", {
        extensions: data as Record<string, unknown>
      });
    }

    return data;
  });

  source.cache.set(cacheKey, request);
  return request;
}

function rawCodeAndAbi(source: SmartContractSource) {
  return fetchContractEndpoint<RawCodeAndAbiResponse>(
    source,
    "get_raw_code_and_abi"
  );
}

function rawAbi(source: SmartContractSource) {
  return fetchContractEndpoint<RawAbiResponse>(source, "get_raw_abi");
}

const smart_contract_type = new GraphQLObjectType<SmartContractSource, Context>(
  {
    name: "smart_contract_type",
    fields: () => ({
      wasm: {
        type: GraphQLString,
        description: "Base64-encoded contract WASM.",
        async resolve(source) {
          return (await rawCodeAndAbi(source)).wasm;
        }
      },
      abi: {
        description: "Base64-encoded contract ABI.",
        type: GraphQLString,
        async resolve(source) {
          if (source.selectedFields.has("wasm")) {
            return (await rawCodeAndAbi(source)).abi;
          }

          return (await rawAbi(source)).abi;
        }
      },
      abi_hash: {
        description: "SHA-256 hash of the serialized contract ABI.",
        type: relocke_types.checksum256,
        async resolve(source) {
          return (await rawAbi(source)).abi_hash;
        }
      },
      wasm_hash: {
        description: "SHA-256 hash of the deployed contract WASM.",
        type: relocke_types.checksum256,
        async resolve(source) {
          if (needsRawAbi(source.selectedFields)) {
            return (await rawAbi(source)).code_hash;
          }

          return (
            await fetchContractEndpoint<CodeHashResponse>(
              source,
              "get_code_hash"
            )
          ).code_hash;
        }
      }
    })
  }
);

export const get_smart_contract: GraphQLFieldConfig<
  unknown,
  Context,
  GetSmartContractArgs
> = {
  description:
    "Retrieve selected smart contract code, ABI, and deployment hashes from the blockchain.",
  type: smart_contract_type,
  args: {
    account_name: {
      description: "The account holding the smart contract.",
      type: new GraphQLNonNull(name_type)
    }
  },
  resolve(root, { account_name }, context, info) {
    return {
      account_name,
      cache: context.requestCache ?? new Map<string, Promise<unknown>>(),
      network: context.network(root, { account_name }, info),
      selectedFields: getSelectedFields(info)
    };
  }
};
