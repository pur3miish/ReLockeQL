import {
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { Relocke_key_type as key_type } from "../relocke_types/key_type.js";
import { public_key_type } from "../relocke_types/public_key_type.js";

interface ProducerAuthority {
  threshold: number;
  keys: any[]; // ideally specify key type if known
}

interface Producer {
  owner: string;
  total_votes: string;
  producer_key: string;
  is_active: string;
  url: string;
  unpaid_blocks: string;
  last_claim_time: string;
  location: string;
  producer_authority: [any, ProducerAuthority]; // tuple where 2nd element is authority
}

interface ProducersResult {
  total_producer_vote_weight: string;
  more: string;
  rows: Producer[];
  error?: any;
  message?: string;
}

const producer_authority_type = new GraphQLObjectType<ProducerAuthority>({
  name: "block_producer_authority",
  fields: {
    threshold: {
      type: GraphQLInt
    },
    keys: {
      type: new GraphQLList(key_type)
    }
  }
});

const producers = new GraphQLObjectType<Producer>({
  name: "blockchain_block_producers",
  fields: {
    owner: {
      type: GraphQLString
    },
    total_votes: {
      type: GraphQLString
    },
    producer_key: {
      type: public_key_type
    },
    is_active: {
      type: GraphQLString
    },
    url: {
      type: GraphQLString
    },
    unpaid_blocks: {
      type: GraphQLString
    },
    last_claim_time: {
      type: GraphQLString
    },
    location: {
      type: GraphQLString
    },
    producer_authority: {
      type: producer_authority_type,
      resolve(data) {
        // Extract second element in tuple
        return data.producer_authority[1];
      }
    }
  }
});

const producers_type = new GraphQLObjectType<ProducersResult>({
  name: "relocke_producers",
  fields: {
    total_producer_vote_weight: {
      type: GraphQLString
    },
    more: {
      type: GraphQLString,
      description: "the next block producer in the list"
    },
    rows: {
      type: new GraphQLList(producers)
    }
  }
});

interface GetProducersArgs {
  limit?: string;
  lower_bound?: string;
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

export const get_producers: GraphQLFieldConfig<unknown, any, GetProducersArgs> =
  {
    description: "Return info about block producers.",
    type: producers_type,
    args: {
      limit: {
        description: "total number of producers to retrieve",
        type: GraphQLString,
        defaultValue: "10"
      },
      lower_bound: {
        type: GraphQLString
      }
    },
    async resolve(root, args, context: Context, info) {
      const { rpc_url, fetchOptions } = context.network(root, args, info);

      const uri = `${rpc_url}/v1/chain/get_producers`;

      const req = await fetch(uri, {
        method: "POST",
        body: JSON.stringify({ ...args, json: true }),
        ...fetchOptions
      });

      const data: ProducersResult = await req.json();

      if (data.error)
        throw new GraphQLError(data.message || "Unknown error", {
          extensions: data as Record<string, any>
        });

      return data;
    }
  };
