import serialize from "eosio-wasm-js/serialize.js";
import serialize_transaction_header from "eosio-wasm-js/transaction_header.js";
import { GraphQLError } from "graphql";

import { type NetworkContext } from "./types/Context.js";

interface ActionData {
  authorization?: any[];
  [key: string]: any;
}

interface ActionToSerialize {
  contract: string;
  action: string;
  data: ActionData;
}

interface SerializeInstruction {
  $info: {
    variant: boolean;
    binary_ex: boolean;
    optional: boolean;
    list: boolean;
  };
  name: string;
  type: string;
}

interface ASTList {
  [contract: string]: {
    [actionName: string]: SerializeInstruction[];
  };
}

interface TransactionAction {
  account: string;
  action: string;
  authorization: any[];
  data: any;
  hex_data: string;
}

interface TransactionBodyResult {
  context_free_actions: (Omit<TransactionAction, "action"> & {
    name: string;
  })[];
  actions: (Omit<TransactionAction, "action"> & { name: string })[];
  transaction_extensions: any[];
  transaction_body: string;
}

interface MutationConfiguration {
  blocksBehind?: number;
  expireSeconds?: number;
  max_net_usage_words?: number;
  max_cpu_usage_ms?: number;
}

interface GetInfoResponse {
  chain_id: string;
  head_block_num: number;
}

const default_config: Required<MutationConfiguration> = {
  blocksBehind: 3,
  expireSeconds: 30,
  max_net_usage_words: 0,
  max_cpu_usage_ms: 0
};

const validate_actions = (): never => {
  throw new GraphQLError(`Invalid RelockeQL query.`, {
    extensions: {
      why: "RelockeQL enforces one action per object in the list to preserve the top to bottom execution order.",
      example: "actions: [{ action1: … }, { action2: … }]"
    }
  });
};

const serialize_value = (type: string, value: any): string => {
  if (type === "bytes" && value === "") {
    return "00";
  }

  const serializers = serialize as unknown as Record<
    string,
    (value: any) => string
  >;

  const serializer = serializers[type];

  if (!serializer) {
    throw new Error(`Unsupported serialization type: ${type}`);
  }

  return serializer(value);
};

function get_transaction_body(
  actions: Array<Record<string, Record<string, any>>>,
  ast_list: ASTList
): TransactionBodyResult {
  const actions_list_to_serialize: ActionToSerialize[] = [];

  for (const action of actions) {
    if (Object.values(action).length > 1) validate_actions();

    const [contract] = Object.keys(action);
    const [values] = Object.values(action);
    const action_fields = Object.keys(values);
    if (action_fields.length > 1) validate_actions();

    actions_list_to_serialize.push(
      ...action_fields.map((actionName) => ({
        contract,
        action: actionName,
        data: values[actionName]
      }))
    );
  }

  const _actions: TransactionAction[] = [];
  const _context_free_actions: TransactionAction[] = [];
  const transaction_extensions = "00";

  for (const action of actions_list_to_serialize) {
    const {
      contract,
      action: action_name,
      data: { authorization, ...data }
    } = action;

    const build_serialize_list = (
      data: any,
      instructions: SerializeInstruction[]
    ): Array<{ type: string; value: any }> => {
      const serialize_list: Array<{ type: string; value: any }> = [];

      for (const instruction of instructions) {
        const { $info, name, type } = instruction;
        const datum = data[name];
        const next_instruction = ast_list[contract]?.[type];

        if ($info.variant) {
          if (Object.keys(data).length > 1)
            throw new Error(`Must only include one type for variant.`);
          if (!datum) continue;
          serialize_list.push({
            type: "varuint32",
            value: instructions.findIndex((i) => i.type === type)
          });
        }

        if ($info.binary_ex) $info.optional = false;

        if ($info.optional)
          serialize_list.push({ type: "bool", value: datum !== undefined });

        if ($info.list && datum !== undefined)
          serialize_list.push({ type: "varuint32", value: datum.length });

        if (next_instruction) {
          if ($info.list) {
            if (datum !== undefined && !$info.binary_ex) {
              for (const d of datum) {
                serialize_list.push(
                  ...build_serialize_list(d, next_instruction)
                );
              }
            }
          } else {
            serialize_list.push(
              ...build_serialize_list(datum, next_instruction)
            );
          }
        } else if ($info.list && datum !== undefined) {
          for (const d of datum) serialize_list.push({ type, value: d });
        } else if (datum !== undefined) {
          serialize_list.push({ type, value: datum });
        }
      }

      return serialize_list;
    };

    const list = build_serialize_list(data, ast_list[contract][action_name]);

    let hex_string = "";
    for (const { type, value } of list)
      hex_string += serialize_value(type, value);

    if (authorization?.length)
      _actions.push({
        account: contract.replace(/_/g, "."),
        action: action_name.replace(/_/g, "."),
        authorization,
        data,
        hex_data: hex_string
      });
    else
      _context_free_actions.push({
        account: contract.replace(/_/g, "."),
        action: action_name.replace(/_/g, "."),
        authorization: [],
        data,
        hex_data: hex_string
      });
  }

  return {
    context_free_actions: _context_free_actions.map(
      ({ action: name, ...rest }) => ({
        ...rest,
        name
      })
    ),
    actions: _actions.map(({ action: name, ...rest }) => ({
      ...rest,
      name
    })),
    transaction_extensions: [],
    transaction_body:
      serialize.actions(_context_free_actions) +
      serialize.actions(_actions) +
      transaction_extensions
  };
}

interface MutationResolverArgs {
  actions: Array<Record<string, Record<string, any>>>;
  configuration?: MutationConfiguration;
}

interface MutationResolverResult {
  chain_id: string;
  transaction_header: string;
  transaction_body: string;
  transaction: {
    expiration: string | number;
    ref_block_num: number;
    ref_block_prefix: number;
    max_net_usage_words: number;
    max_cpu_usage_ms: number;
    delay_sec: number;
    context_free_actions?: any[];
    actions?: any[];
    transaction_extensions?: any[];
  };
}

export async function mutation_resolver(
  { actions, configuration = default_config }: MutationResolverArgs,
  network: NetworkContext,
  ast_list: ASTList
): Promise<MutationResolverResult> {
  if ((configuration.max_cpu_usage_ms ?? 0) > 0xff)
    throw new Error("Invalid max_cpu_usage_ms value (maximum 255).");
  if ((configuration.max_net_usage_words ?? 0) > 0xffffffff)
    throw new Error(
      "Invalid max_net_usage_words value (maximum 4,294,967,295)."
    );

  const { rpc_url, fetchOptions } = network;
  const { transaction_body, ...transaction_list } = get_transaction_body(
    actions,
    ast_list
  );

  const response = await fetch(`${rpc_url}/v1/chain/get_info`, {
    method: "POST",
    ...fetchOptions
  });

  const { chain_id, head_block_num } =
    (await response.json()) as GetInfoResponse;
  const block_num_or_id = head_block_num - (configuration.blocksBehind ?? 3);

  const blockResponse = await fetch(`${rpc_url}/v1/chain/get_block`, {
    method: "POST",
    ...fetchOptions,
    body: JSON.stringify({ block_num_or_id })
  });

  const { timestamp, block_num, ref_block_prefix } = await blockResponse.json();

  const expiration =
    Math.round(Date.parse(timestamp + "Z") / 1000) +
    (configuration.expireSeconds ?? 30);

  const txn_header = {
    expiration,
    ref_block_num: block_num & 0xffff,
    ref_block_prefix,
    max_net_usage_words: configuration.max_net_usage_words ?? 0,
    max_cpu_usage_ms: configuration.max_cpu_usage_ms ?? 0,
    delay_sec: 0
  };

  const transaction_header = serialize_transaction_header(txn_header);
  txn_header.expiration = timestamp;

  return {
    chain_id,
    transaction_header,
    transaction_body,
    transaction: {
      ...txn_header,
      ...transaction_list
    }
  };
}
