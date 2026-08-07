import serializeName from "eosio-wasm-js/name.js";
import {
  GraphQLEnumType,
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from "graphql";

import { name_type } from "../relocke_types/name_type.js";

function convertNameToSymbol(scope: string): string {
  return (serializeName(scope).match(/[0-9A-Fa-f]{2}/g) || [])
    .map((hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .filter((x: string) => !!x.charCodeAt(0))
    .join("");
}

interface TableRow {
  scope: string;
  table: string;
  payer: string;
  count: string;
}

interface TableData {
  rows: TableRow[];
  more: string;
}

const table_rows_type = new GraphQLObjectType<TableRow>({
  name: "table_rows_type",
  fields: {
    scope: { type: name_type },
    table_name: {
      type: name_type,
      resolve: (parent) => parent.table
    },
    ram_payer: {
      type: name_type,
      description: "The account that pays for the data entries.",
      resolve: (parent) => parent.payer
    },
    count: {
      type: GraphQLString,
      description: "No. of entries in the table."
    }
  }
});

const table_type = new GraphQLObjectType<TableData>({
  name: "table_type",
  fields: {
    rows: { type: new GraphQLList(table_rows_type) },
    more: { type: name_type }
  }
});

const scopeTypeEnum = new GraphQLEnumType({
  name: "scope_type",
  values: {
    name: { value: 0 },
    symbol_code: { value: 1 }
  }
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

export const get_table: GraphQLFieldConfig<
  unknown,
  any,
  {
    account_name: string;
    table_name?: string;
    limit?: number;
    lower_bound?: string;
    upper_bound?: string;
    scope_type?: number;
  }
> = {
  description: "Retrieve a table from the blockchain.",
  type: table_type,
  args: {
    account_name: {
      description: "The account name of the `smart contract`.",
      type: new GraphQLNonNull(name_type)
    },
    table_name: {
      description: "The table name on the smart contract.",
      type: name_type
    },
    limit: {
      description:
        "Limit number of results returned (how many items to return).",
      type: GraphQLInt,
      defaultValue: 10
    },
    lower_bound: {
      description:
        "Filters results to return the first element that is not less than provided value in the table.",
      type: GraphQLString
    },
    upper_bound: {
      description:
        "Filters results to return the first element that is greater than provided value in the table.",
      type: GraphQLString
    },
    scope_type: {
      defaultValue: 0,
      type: scopeTypeEnum
    }
  },
  async resolve(
    root,
    {
      account_name,
      table_name,
      limit = 10,
      lower_bound,
      upper_bound,
      scope_type = 0
    },
    context: Context,
    info
  ): Promise<TableData> {
    const { rpc_url, fetchOptions } = context.network(
      root,
      {
        account_name,
        table_name,
        limit,
        lower_bound,
        upper_bound,
        scope_type
      },
      info
    );

    const uri = `${rpc_url}/v1/chain/get_table_by_scope`;

    const res = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        code: account_name,
        table: table_name,
        limit,
        lower_bound,
        upper_bound,
        json: true,
        show_payer: true
      })
    });

    const data = (await res.json()) as TableData & {
      error?: any;
      message?: string;
    };

    if (data.error)
      throw new GraphQLError(data.message || "Unknown error", {
        extensions: data as Record<string, any>
      });

    if (scope_type === 1) {
      return {
        ...data,
        rows: data.rows.map((x) => ({
          ...x,
          scope: convertNameToSymbol(x.scope)
        }))
      };
    }

    return data;
  }
};
