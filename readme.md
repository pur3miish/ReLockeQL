![relockeql logo](https://raw.githubusercontent.com/pur3miish/RelockeQL/main/static/relockeql.svg)

# RelockeQL

[![NPM Package](https://img.shields.io/npm/v/relockeql.svg)](https://www.npmjs.org/package/relockeql) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/pur3miish/RelockeQL/blob/main/LICENSE) [![CI](https://github.com/pur3miish/ReLockeQL/actions/workflows/node.js.yml/badge.svg)](https://github.com/pur3miish/ReLockeQL/actions/workflows/node.js.yml)

RelockeQL is a GraphQL client and server library that allows developers to interact with Relocke-based blockchains (Antelope, EOSIO, WAX, TELOS, XPR, VAULTA) using GraphQL. It provides a unified interface to communicate with different chains in the ecosystem, enabling developers and agentic tools to leverage the unique features and capabilities of each blockchain while still benefiting from a consistent development experience.

As a GraphQL client library, RelockeQL simplifies the process of building and executing GraphQL queries and mutations, handling errors, and signing transactions. As a server library, it provides a framework for building GraphQL APIs that can interact with Relocke-based blockchains and other data sources.

With RelockeQL, developers can focus on building the frontend and business logic of their DApps, while relying on the library to handle the complexities of interacting with multiple blockchains in the ecosystem.

**Live working example can be found [here](https://relocke.io/api/playground).**

![relockeql screenshot](https://raw.githubusercontent.com/pur3miish/RelockeQL/main/static/relockeql-screen.png)

## Tested chains

RelockeQL is tested with the following chains:

- Jungle (`jungle`)
- WAX (`wax`)
- Vaulta (EOS) (`vaulta`)
- Telos (`telos`)
- XPR Network (`xpr`)

This list records test coverage; it is not an allowlist. Applications may configure any other Antelope-based chain using their own GraphQL-safe chain name and explicit RPC and, where required, Hyperion endpoints. Those custom chains are accepted by RelockeQL but have not been tested by this project.

## Installation

For [Node.js](https://nodejs.org), to install [`RelockeQL`](https://npm.im/relockeql) and the peer dependency [`graphql`](https://npm.im/graphql) run:

```sh
npm install relockeql graphql
```

## Examples

See the examples folder on how to run RelockeQL as a [Node.js](https://nodejs.org) endpoint.

### Configure endpoints

RelockeQL does not choose network providers. Every RPC endpoint must be supplied by the application in the required `chains` option:

```js
const endpoints = {
  vaulta: "https://your-vaulta-rpc.example",
  wax: "https://your-wax-rpc.example"
};
```

Hyperion history endpoints are configured separately by prefixing the chain name with `hyperion_`. They do not create additional top-level GraphQL fields:

```js
const endpoints = {
  vaulta: "https://your-vaulta-rpc.example",
  hyperion_vaulta: "https://your-vaulta-hyperion.example"
};
```

This explicit configuration prevents the package from silently sending requests to infrastructure that the application owner did not select.

### Run the example HTTP server

The example server also requires an explicit chain and RPC endpoint. It does not contain fallback providers:

```sh
RELOCKEQL_CHAIN=vaulta \
RELOCKEQL_RPC_URL=https://your-vaulta-rpc.example \
RELOCKEQL_HYPERION_URL=https://your-vaulta-hyperion.example \
RELOCKEQL_CONTRACTS=eosio.token,eosio \
npm run server
```

`RELOCKEQL_HYPERION_URL` and `RELOCKEQL_CONTRACTS` are optional. `PORT` defaults to `3002`. Send GraphQL requests as JSON over HTTP `POST`; browser `GET` requests return `405` without stopping the server.

### Serialize a contract ABI

`serialize_abi` converts an Antelope ABI JSON document into the hexadecimal bytes required by `eosio::setabi`. Its self-contained encoder supports UTF-8 Ricardian text and ordered ABI 1.1/1.2 binary extensions without requiring an ABI serialization dependency.

```js
import { serialize_abi } from "relockeql";

const rawAbi = serialize_abi({
  version: "eosio::abi/1.2",
  types: [],
  structs: [],
  actions: [],
  tables: [],
  ricardian_clauses: [
    { id: "ui.contract", body: "---\nschema: relocke.ui/1\n---\nPurpose" }
  ],
  error_messages: [],
  abi_extensions: []
});
```

Trailing binary-extension fields remain absent unless supplied. If `action_results` is present, `variants` must also be present because Antelope binary extensions cannot skip an earlier field and then encode a later one.

### Query a Blockchain Account Info

```js
import { RelockeQL } from "relockeql";
import { sign_transaction } from "your-signing-library";

const query = /* GraphQL */ `
  {
    vaulta {
      get_blockchain {
        get_account(account_name: "relockeblock") {
          core_liquid_balance
          ram_quota
          net_weight
          cpu_weight
          ram_usage
        }
      }
    }
  }
`;

const { data } = await RelockeQL(
  { query },
  { chains: { vaulta: "https://your-vaulta-rpc.example" } }
);

console.log(data);
```

> Logged output included an account infomation.

### Query a Contract Table

Contract table fields return the table rows together with the blockchain pagination metadata.

```js
const query = /* GraphQL */ `
  {
    vaulta {
      eosio {
        powup_order(arg: { scope: "" }) {
          rows {
            id
            owner
            cpu_weight
            net_weight
          }
          more
          next_key
        }
      }
    }
  }
`;

const { data } = await RelockeQL(
  { query },
  {
    chains: { vaulta: "https://your-vaulta-rpc.example" },
    contracts: {
      vaulta: ["eosio"]
    }
  }
);

const page = data.vaulta.eosio.powup_order;

if (page.more) {
  console.log("Next lower bound:", page.next_key);
}
```

### Query a transaction through Hyperion

`get_transaction_by_id` returns a normalized transaction and all of its actions. The action `data` field is decoded JSON, so callers do not need to parse a JSON string.

```js
const query = /* GraphQL */ `
  {
    vaulta {
      get_blockchain {
        get_transaction_by_id(
          id: "690878b888dd70c339df268ae68019c097b1d4ded649a50c9b5723f734d84837"
        ) {
          transaction_id
          block_num
          timestamp
          executed
          actions {
            contract
            action
            actors
            receivers
            data
          }
        }
      }
    }
  }
`;

const result = await RelockeQL(
  { query },
  {
    chains: {
      vaulta: "https://your-vaulta-rpc.example",
      hyperion_vaulta: "https://your-vaulta-hyperion.example"
    }
  }
);
```

A Hyperion `executed: false` not-found response resolves to `null`. Missing, unavailable, timed-out, or malformed providers return GraphQL errors with specific `extensions.code` values.

### Search recent token transfers

`get_token_transfers` uses Hyperion's indexed notified-account and `contract:transfer` filters. It always requests newest-first results, omits large binary data, searches hot history partitions, and limits results to at most 100. Offset and ascending scans are intentionally unavailable.

```js
const query = /* GraphQL */ `
  {
    vaulta {
      get_blockchain {
        get_token_transfers(
          account: "alice"
          contract: "eosio.token"
          before: "2026-08-15T10:00:00Z"
          limit: 25
        ) {
          query_time_ms
          actions {
            transaction_id
            block_num
            timestamp
            data
          }
        }
      }
    }
  }
`;

const result = await RelockeQL(
  { query },
  {
    chains: {
      vaulta: "https://your-vaulta-rpc.example",
      hyperion_vaulta: "https://your-vaulta-hyperion.example"
    }
  }
);
```

### Transfer Tokens

```js
import { RelockeQL } from "relockeql";

const query = /* GraphQL */ `
  mutation {
    jungle {
      send_transaction(
        actions: [
          {
            eosio_token: {
              transfer: {
                authorization: { actor: "relockeblock" }
                to: "relockechain"
                from: "relockeblock"
                memo: ""
                quantity: "0.0002 EOS"
              }
            }
          }
        ]
      ) {
        transaction_id
        block_num
      }
    }
  }
`;

const { data } = await RelockeQL(
  { query },
  {
    chains: { jungle: "https://your-jungle-rpc.example" },
    contracts: {
      // List your smart contract accounts for each chain.
      jungle: ["eosio.token"]
    },
    signTransaction: async (hash) => {
      const wif_private_key = "PVT_K1_…"; // your private key
      const signature = await sign_transaction({ hash, wif_private_key });
      return [signature]; // signatures must return array
    }
  }
);

console.log(data);
```

> Logged output includes transaction_id and block_num

## Requirements

Supported runtime environments:

- [Node.js](https://nodejs.org) versions `>=22.0.0`.
