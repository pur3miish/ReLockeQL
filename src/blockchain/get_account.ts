import {
  GraphQLBoolean,
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { asset_type } from "../relocke_types/asset_type.js";
import { Relocke_key_type } from "../relocke_types/key_type.js";
import { name_type } from "../relocke_types/name_type.js";

// --- TypeScript Interfaces ---

interface Resource {
  owner?: string;
  net_weight?: string;
  cpu_weight?: string;
  ram_bytes?: string;
}

interface Bandwidth {
  used?: string;
  available?: string;
  max?: string;
  last_usage_update_time?: string;
}

interface AccountAuthPermission {
  actor?: string;
  permission?: string;
}

interface AccountsAuth {
  weight?: number;
  permission?: AccountAuthPermission;
}

interface RequireAuth {
  threshold?: number;
  keys?: Array<any>; // Should align with Relocke_key_type's TypeScript type if available
  accounts?: AccountsAuth[];
}

interface LinkedAction {
  account?: string;
  action?: string;
}

interface Permission {
  perm_name?: string;
  parent?: string;
  required_auth?: RequireAuth;
  linked_actions?: LinkedAction[];
}

interface SelfDelegatedBandwidth {
  to?: string;
  from?: string;
  net_weight?: string; // or asset_type TypeScript interface
  cpu_weight?: string; // or asset_type TypeScript interface
}

interface RefundRequest {
  owner?: string;
  request_time?: string;
  net_amount?: string; // or asset_type TypeScript interface
  cpu_amount?: string; // or asset_type TypeScript interface
}

interface VoterInfo {
  owner?: string;
  proxy?: string;
  producers?: string[];
  staked?: string;
  last_vote_weight?: string;
  proxied_vote_weight?: string;
  is_proxy?: number;
  flags1?: number;
  reserved2?: number;
  reserved3?: string;
}

interface PairTimePointSecInt64 {
  key?: string;
  value?: string;
}

interface RexInfo {
  version?: string;
  owner?: string;
  vote_stake?: string;
  rex_balance?: string;
  matured_rex?: string;
  rex_maturities?: PairTimePointSecInt64[];
}

interface Account {
  account_name?: string;
  head_block_num?: string;
  head_block_time?: string;
  privileged?: boolean;
  last_code_update?: string;
  created?: string;
  core_liquid_balance?: string; // or asset_type interface
  ram_quota?: string;
  net_weight?: string;
  cpu_weight?: string;
  net_limit?: Bandwidth;
  cpu_limit?: Bandwidth;
  ram_usage?: string;
  permissions?: Permission[];
  total_resources?: Resource;
  self_delegated_bandwidth?: SelfDelegatedBandwidth;
  refund_request?: RefundRequest;
  voter_info?: VoterInfo;
  subjective_cpu_bill_limit?: Bandwidth;
  rex_info?: RexInfo;
  eosio_any_linked_actions?: LinkedAction[];
}

// --- GraphQL Types ---

const resource_type = new GraphQLObjectType<Resource>({
  name: "resource_type",
  fields: () => ({
    owner: { type: name_type },
    net_weight: { type: GraphQLString },
    cpu_weight: { type: GraphQLString },
    ram_bytes: { type: GraphQLString }
  })
});

const bandwidth_type = new GraphQLObjectType<Bandwidth>({
  name: "bandwidth_type",
  fields: () => ({
    used: { type: GraphQLString },
    available: { type: GraphQLString },
    max: { type: GraphQLString },
    last_usage_update_time: { type: GraphQLString }
  })
});

const account_auth_permission_type =
  new GraphQLObjectType<AccountAuthPermission>({
    name: "account_auth_permission_type",
    fields: () => ({
      actor: { type: name_type },
      permission: { type: name_type }
    })
  });

const accounts_auth_type = new GraphQLObjectType<AccountsAuth>({
  name: "accounts_auth_type",
  fields: () => ({
    weight: { type: GraphQLInt },
    permission: { type: account_auth_permission_type }
  })
});

const require_auth_type = new GraphQLObjectType<RequireAuth>({
  name: "require_auth_type",
  fields: () => ({
    threshold: { type: GraphQLInt },
    keys: { type: new GraphQLList(Relocke_key_type) },
    accounts: { type: new GraphQLList(accounts_auth_type) }
  })
});

const linked_actions_type = new GraphQLObjectType<LinkedAction>({
  name: "linked_actions_type",
  fields: {
    account: { type: name_type },
    action: { type: name_type }
  }
});

const permission_type = new GraphQLObjectType<Permission>({
  name: "permission_type",
  description: "Relocke account permissions",
  fields: {
    perm_name: { type: name_type },
    parent: { type: name_type },
    required_auth: { type: require_auth_type },
    linked_actions: { type: new GraphQLList(linked_actions_type) }
  }
});

const self_delegated_bandwidth_type =
  new GraphQLObjectType<SelfDelegatedBandwidth>({
    name: "self_delegated_bandwidth",
    description: "Lists the amount of bandwidth your account has delegated",
    fields: () => ({
      to: { type: name_type },
      from: { type: name_type },
      net_weight: { type: asset_type },
      cpu_weight: { type: asset_type }
    })
  });

const refund_request_type = new GraphQLObjectType<RefundRequest>({
  name: "account_refund_request",
  description: "",
  fields: () => ({
    owner: { type: name_type },
    request_time: { type: GraphQLString },
    net_amount: { type: asset_type },
    cpu_amount: { type: asset_type }
  })
});

const voter_info_type = new GraphQLObjectType<VoterInfo>({
  name: "voter_info_type",
  fields: () => ({
    owner: { type: GraphQLString },
    proxy: { type: GraphQLString },
    producers: { type: new GraphQLList(GraphQLString) },
    staked: { type: GraphQLString },
    last_vote_weight: { type: GraphQLString },
    proxied_vote_weight: { type: GraphQLString },
    is_proxy: { type: GraphQLInt },
    flags1: { type: GraphQLInt },
    reserved2: { type: GraphQLInt },
    reserved3: { type: GraphQLString }
  })
});

const pair_time_point_sec_int64_type =
  new GraphQLObjectType<PairTimePointSecInt64>({
    name: "pair_time_point_sec_int64",
    fields: {
      key: { type: GraphQLString },
      value: { type: GraphQLString }
    }
  });

const rex_info_type = new GraphQLObjectType<RexInfo>({
  name: "rex_info_type",
  fields: {
    version: { type: GraphQLString },
    owner: { type: GraphQLString },
    vote_stake: { type: GraphQLString },
    rex_balance: { type: GraphQLString },
    matured_rex: { type: GraphQLString },
    rex_maturities: { type: new GraphQLList(pair_time_point_sec_int64_type) }
  }
});

const account_type = new GraphQLObjectType<Account>({
  name: "account_type",
  description: `Retrieve details about a specific account on the blockchain.`,
  fields: () => ({
    account_name: { type: name_type },
    head_block_num: { type: GraphQLString },
    head_block_time: { type: GraphQLString },
    privileged: { type: GraphQLBoolean },
    last_code_update: { type: GraphQLString },
    created: { type: GraphQLString },
    core_liquid_balance: { type: asset_type },
    ram_quota: { type: GraphQLString },
    net_weight: { type: GraphQLString },
    cpu_weight: { type: GraphQLString },
    net_limit: { type: bandwidth_type },
    cpu_limit: { type: bandwidth_type },
    ram_usage: { type: GraphQLString },
    permissions: {
      description: "List of the Relocke `account_name` permissions",
      type: new GraphQLList(permission_type)
    },
    total_resources: { type: resource_type },
    self_delegated_bandwidth: { type: self_delegated_bandwidth_type },
    refund_request: { type: refund_request_type },
    voter_info: { type: voter_info_type },
    subjective_cpu_bill_limit: { type: bandwidth_type },
    rex_info: { type: rex_info_type },
    eosio_any_linked_actions: { type: new GraphQLList(linked_actions_type) }
  })
});

// --- Context Type ---

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

// --- get_account GraphQLFieldConfig ---

export const get_account: GraphQLFieldConfig<
  unknown,
  Context,
  { account_name: string }
> = {
  type: account_type,
  args: {
    account_name: {
      type: new GraphQLNonNull(name_type)
    }
  },
  async resolve(root, { account_name }, context, info) {
    const { rpc_url, fetchOptions } = context.network(
      root,
      { account_name },
      info
    );

    const uri = `${rpc_url}/v1/chain/get_account`;
    const req = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        account_name,
        json: true
      })
    });

    const data = await req.json();

    if (data.error) throw new GraphQLError(data.message, { extensions: data });

    return data as Account;
  }
};
