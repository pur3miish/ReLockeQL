import { GraphQLFieldConfig, GraphQLObjectType } from "graphql";

import { abi_bin_to_json } from "./blockchain/abi_bin_to_json.js";
import { get_abi } from "./blockchain/get_abi.js";
import { get_account } from "./blockchain/get_account.js";
import { accounts_by_authorizers as get_accounts_by_authorizers } from "./blockchain/get_accounts_by_authorizers.js";
import { get_block } from "./blockchain/get_block.js";
import { currency_balance as get_currency_balance } from "./blockchain/get_currency_balance.js";
import { get_currency_stats } from "./blockchain/get_currency_stats.js";
import { info as get_info } from "./blockchain/get_info.js";
import { get_producers } from "./blockchain/get_producers.js";
import { get_required_keys } from "./blockchain/get_required_keys.js";
import { get_smart_contract } from "./blockchain/get_smart_contract.js";
import { get_table } from "./blockchain/get_table_by_scope.js";
import { get_token_transfers } from "./blockchain/get_token_transfers.js";
import { get_transaction_by_id } from "./blockchain/get_transaction_by_id.js";

export const blockchain_query_field: GraphQLFieldConfig<any, any> = {
  type: new GraphQLObjectType({
    name: "blockchain_type",
    description: `Retrieve infomation about the blockchain, cryptocurrency and accounts.`,
    fields: {
      get_account,
      get_abi,
      get_accounts_by_authorizers,
      get_block,
      get_transaction_by_id,
      get_token_transfers,
      get_currency_balance,
      get_currency_stats,
      get_required_keys,
      get_smart_contract,
      get_info,
      get_producers,
      get_table,
      abi_bin_to_json
    }
  }),
  resolve() {
    return {};
  }
};
