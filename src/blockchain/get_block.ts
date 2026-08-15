import {
  GraphQLError,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { authorization_type } from "../graphql_object_types/authorization.js";
import { bytes_type } from "../relocke_types/bytes_type.js";
import { json_type } from "../relocke_types/json_type.js";

interface Action {
  account?: string;
  name?: string;
  authorization?: Array<any>;
  data?: any;
  hex_data?: string;
}

const action_type = new GraphQLObjectType<Action>({
  name: "action_type",
  description: "A decoded action included in a block transaction.",
  fields: () => ({
    account: {
      type: GraphQLString,
      description: "Account hosting the contract that defines the action."
    },
    name: {
      type: GraphQLString,
      description: "Name of the contract action."
    },
    authorization: {
      type: new GraphQLList(authorization_type),
      description: "Account permissions that authorized the action."
    },
    data: {
      type: json_type,
      description:
        "Decoded JSON action payload returned by the configured RPC provider."
    },
    hex_data: {
      type: bytes_type,
      description:
        "ABI-encoded action payload represented as hexadecimal bytes."
    }
  })
});

interface Producer {
  producer_name?: string;
  block_signing_key?: string;
}

const producer_type = new GraphQLObjectType<Producer>({
  name: "producer_type",
  description: "A producer entry in a proposed producer schedule.",
  fields: () => ({
    producer_name: {
      type: GraphQLString,
      description: "Account name of the block producer."
    },
    block_signing_key: {
      type: GraphQLString,
      description: `Base58 encoded Relocke public key.`
    }
  })
});

interface NewProducer {
  version?: string;
  producers?: Producer[];
}

const new_producer_type = new GraphQLObjectType<NewProducer>({
  name: "new_producer_type",
  description: "A producer schedule proposed by this block, when present.",
  fields: () => ({
    version: {
      type: GraphQLString,
      description: "Version number of the proposed producer schedule."
    },
    producers: {
      type: new GraphQLList(producer_type),
      description: "Producer entries in the proposed schedule."
    }
  })
});

interface PackedTransaction {
  expiration?: string;
  ref_block_num?: string;
  ref_block_prefix?: string;
  max_net_usage_words?: string;
  max_cpu_usage_ms?: string;
  delay_sec?: string;
  context_free_actions?: Action[];
  actions?: Action[];
}

const packed_transaction_type = new GraphQLObjectType<PackedTransaction>({
  name: "packed_transaction_type",
  description: "The decoded transaction body embedded in a block receipt.",
  fields: () => ({
    expiration: {
      type: GraphQLString,
      description: "Time after which the transaction is no longer valid."
    },
    ref_block_num: {
      type: GraphQLString,
      description: "Lower 16 bits of the referenced block number."
    },
    ref_block_prefix: {
      type: GraphQLString,
      description: "32-bit prefix of the referenced block ID."
    },
    max_net_usage_words: {
      type: GraphQLString,
      description: "Maximum network usage allowed, in eight-byte words."
    },
    max_cpu_usage_ms: {
      type: GraphQLString,
      description: "Maximum CPU time allowed, in milliseconds."
    },
    delay_sec: {
      type: GraphQLString,
      description: "Requested delay before execution, in seconds."
    },
    context_free_actions: {
      type: new GraphQLList(action_type),
      description: "Actions that do not require authorization."
    },
    actions: {
      type: new GraphQLList(action_type),
      description: "Authorized actions executed by the transaction."
    }
  })
});

interface Trx {
  id?: string;
  signatures?: string[];
  compression?: string;
  packed_context_free_data?: string;
  context_free_data?: string[];
  packed_trx?: string;
  transaction?: PackedTransaction;
}

const trx_type = new GraphQLObjectType<Trx>({
  name: "trx_type",
  description:
    "A transaction ID or expanded transaction included in a block receipt.",
  fields: () => ({
    id: {
      type: GraphQLID,
      description: "Transaction ID when the receipt contains an ID reference."
    },
    signatures: {
      type: new GraphQLList(GraphQLString),
      description: "Cryptographic signatures attached to the transaction."
    },
    compression: {
      type: GraphQLString,
      description: "Compression mode used for packed transaction data."
    },
    packed_context_free_data: {
      type: GraphQLString,
      description: "Packed context-free data represented as hexadecimal bytes."
    },
    context_free_data: {
      type: new GraphQLList(GraphQLString),
      description: "Decoded context-free data entries."
    },
    packed_trx: {
      type: GraphQLString,
      description: "Packed transaction represented as hexadecimal bytes."
    },
    transaction: {
      type: packed_transaction_type,
      description:
        "Expanded transaction body when returned by the RPC provider."
    }
  })
});

interface Transactions {
  status?: string;
  cpu_usage_us?: string;
  net_usage_words?: string;
  trx?: Trx;
}

const transactions_type = new GraphQLObjectType<Transactions>({
  name: "transaction_type",
  description: "A transaction receipt included in a block.",
  fields: () => ({
    status: {
      type: GraphQLString,
      description: "Execution status reported for the transaction."
    },
    cpu_usage_us: {
      type: GraphQLString,
      description: "CPU consumed by the transaction, in microseconds."
    },
    net_usage_words: {
      type: GraphQLString,
      description: "Network bandwidth consumed, in eight-byte words."
    },
    trx: {
      type: trx_type,
      description: "Transaction ID or expanded transaction payload."
    }
  })
});

interface Block {
  timestamp?: string;
  producer?: string;
  confirmed?: string;
  previous?: string;
  transaction_mroot?: string;
  action_mroot?: string;
  schedule_version?: string;
  new_producers?: NewProducer;
  header_extensions?: string[];
  producer_signature?: string;
  transactions?: Transactions[];
  block_extensions?: string[];
  id?: string;
  block_num?: string;
  ref_block_prefix?: string;
}

const block_type = new GraphQLObjectType<Block>({
  name: "block_type",
  description: "Return info relating to a specific block.",
  fields: () => ({
    timestamp: {
      description: "Date/time string in the format `YYYY-MM-DDTHH:MM:SS.sss`",
      type: GraphQLString
    },
    producer: {
      description: "The `name` of the producer.",
      type: GraphQLString
    },
    confirmed: {
      description:
        "Number of prior blocks confirmed by this block producer in current schedule",
      type: GraphQLString
    },
    previous: {
      description: "The `sha256` hash representing the previous.",
      type: GraphQLString
    },
    transaction_mroot: {
      description: "The transaction merkle root `sha256`.",
      type: GraphQLString
    },
    action_mroot: {
      description: "The action merkle root `sha256` string.",
      type: GraphQLString
    },
    schedule_version: {
      description:
        "Number of times producer schedule has changed since genesis.",
      type: GraphQLString
    },
    new_producers: {
      description: "A list of new producers.",
      type: new_producer_type
    },
    header_extensions: {
      type: new GraphQLList(GraphQLString),
      description: "Protocol extensions attached to the block header."
    },
    producer_signature: {
      type: GraphQLString,
      description: `Base58 encoded Relocke cryptographic signature.`
    },
    transactions: {
      type: new GraphQLList(transactions_type),
      description: "List of valid transaction receipts included in block."
    },
    block_extensions: {
      type: new GraphQLList(GraphQLString),
      description: "Protocol extensions attached to the block."
    },
    id: {
      description: "The ID of the a given block `sha256`.",
      type: GraphQLString
    },
    block_num: {
      description:
        "Height of this block in the chain, no. of blocks since genesis.",
      type: GraphQLString
    },
    ref_block_prefix: {
      description: "32-bit portion of block ID",
      type: GraphQLString
    }
  })
});

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

export const get_block = {
  description:
    "Retrieve one block by height or block ID from this chain's configured RPC endpoint.",
  type: block_type,
  args: {
    block_num_or_id: {
      description: "The `block number` or a `block id`.",
      type: new GraphQLNonNull(GraphQLString)
    }
  },
  async resolve(
    root: unknown,
    args: { block_num_or_id: string },
    context: Context,
    info: unknown
  ): Promise<Block> {
    const { rpc_url, fetchOptions } = context.network(root, args, info);

    const uri = `${rpc_url}/v1/chain/get_block`;
    const req = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        block_num_or_id: Number(args.block_num_or_id),
        json: true
      })
    });

    const data = await req.json();

    if (data.error) throw new GraphQLError(data.message, { extensions: data });

    return data;
  }
};
