import {
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

interface InfoData {
  server_version: string;
  chain_id: string;
  earliest_available_block_num: string;
  server_full_version_string: string;
  head_block_num: string;
  head_block_id: string;
  head_block_time: string;
  head_block_producer: string;
  last_irreversible_block_num: string;
  last_irreversible_block_id: string;
  last_irreversible_block_time: string;
  virtual_block_cpu_limit: string;
  virtual_block_net_limit: string;
  block_cpu_limit: string;
  block_net_limit: string;
  server_version_string: string;
  fork_db_head_block_num: string;
  fork_db_head_block_id: string;
}

const info_type = new GraphQLObjectType<InfoData>({
  name: "info_type",
  description: "Returns various details about the Relocke blockchain",
  fields: () => ({
    server_version: {
      type: GraphQLString,
      description: "Hash representing the last commit in the tagged release"
    },
    chain_id: {
      type: GraphQLString,
      description: "Hash representing the ID of the chain"
    },
    earliest_available_block_num: {
      type: GraphQLString,
      description: "First available block for transaction history query"
    },
    server_full_version_string: {
      type: GraphQLString
    },
    head_block_num: {
      type: GraphQLString,
      description: "Highest block number on the chain"
    },
    head_block_id: {
      type: GraphQLString,
      description: "Highest block ID on the chain"
    },
    head_block_time: {
      type: GraphQLString,
      description: "Highest block unix timestamp"
    },
    head_block_producer: {
      type: GraphQLString,
      description: "Producer that signed the highest block (head block)"
    },
    last_irreversible_block_num: {
      type: GraphQLString,
      description:
        "Highest block number on the chain that has been irreversibly applied to state"
    },
    last_irreversible_block_id: {
      type: GraphQLString,
      description:
        "Highest block ID on the chain that has been irreversibly applied to state"
    },
    last_irreversible_block_time: {
      type: GraphQLString,
      description: "First available block for transaction history query"
    },
    virtual_block_cpu_limit: {
      type: GraphQLString,
      description:
        "CPU limit calculated after each block is produced, approximately 1000 times block_cpu_limit"
    },
    virtual_block_net_limit: {
      type: GraphQLString,
      description:
        "NET limit calculated after each block is produced, approximately 1000 times block_net_limit"
    },
    block_cpu_limit: {
      type: GraphQLString,
      description: "Actual maximum CPU limit"
    },
    block_net_limit: {
      type: GraphQLString,
      description: "Actual maximum NET limit"
    },
    server_version_string: {
      type: GraphQLString,
      description:
        "String representation of server version - Majorish-Minorish-Patchy - Warning - Not actually SEMVER!"
    },
    fork_db_head_block_num: {
      type: GraphQLString,
      description:
        "Sequential block number representing the best known head in the fork database tree"
    },
    fork_db_head_block_id: {
      type: GraphQLString,
      description:
        "Sequential block number representing the best known head in the fork database tree"
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

export const info: GraphQLFieldConfig<unknown, any> = {
  description: "Return info about the operational state of the blockchain.",
  type: info_type,
  args: {},
  async resolve(root, args, context: Context, info) {
    const { rpc_url, fetchOptions } = context.network(root, args, info);

    const uri = `${rpc_url}/v1/chain/get_info`;
    const req = await fetch(uri, {
      method: "POST",
      ...fetchOptions
    });

    const data: InfoData & { error?: any; message?: string } = await req.json();

    if (data.error)
      throw new GraphQLError(data.message || "Unknown error", {
        extensions: data as Record<string, any>
      });

    return data;
  }
};
