![relockeql logo](https://raw.githubusercontent.com/pur3miish/RelockeQL/main/static/relockeql.svg)

# RelockeQL

[![NPM Package](https://img.shields.io/npm/v/relockeql.svg)](https://www.npmjs.org/package/relockeql) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/pur3miish/RelockeQL/blob/main/LICENSE) [![CI](https://github.com/pur3miish/ReLockeQL/actions/workflows/node.js.yml/badge.svg)](https://github.com/pur3miish/ReLockeQL/actions/workflows/node.js.yml)

RelockeQL.

RelockeQL is a GraphQL client and server library that allows developers to interact with Relocke-based blockchains using GraphQL. It provides a unified interface to communicate with different chains in the ecosystem, enabling developers to leverage the unique features and capabilities of each blockchain while still benefiting from a consistent development experience.

As a GraphQL client library, RelockeQL simplifies the process of building and executing GraphQL queries and mutations, handling errors, and signing transactions. As a server library, it provides a framework for building GraphQL APIs that can interact with Relocke-based blockchains and other data sources.

With RelockeQL, developers can focus on building the frontend and business logic of their DApps, while relying on the library to handle the complexities of interacting with multiple blockchains in the ecosystem.

**Live working example can be found [here](https://relocke.io/api/playground).**

![relockeql screenshot](https://raw.githubusercontent.com/pur3miish/RelockeQL/main/static/relockeql-screen.png)

## Installation

For [Node.js](https://nodejs.org), to install [`RelockeQL`](https://npm.im/relockeql) and the peer dependency [`graphql`](https://npm.im/graphql) run:

```sh
npm install relockeql graphql
```

## Examples

See the examples folder on how to run RelockeQL as a [Node.js](https://nodejs.org) endpoint.

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

const { data } = await RelockeQL({ query });

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

const { data } = await RelockeQL({
  query,
  contracts: {
    vaulta: ["eosio"]
  }
});

const page = data.vaulta.eosio.powup_order;

if (page.more) {
  console.log("Next lower bound:", page.next_key);
}
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

const { data } = await RelockeQL({
  query,
  contracts: {
    // List of your smart contracts accounts for each chains.
    jungle: ["eosio.token"]
  },
  signTransaction: async (hash) => {
    const wif_private_key = "PVT_K1_…"; // your private key
    const signature = await sign_transaction({ hash, wif_private_key });
    return [signature]; // signatures must return array
  }
});

console.log(data);
```

> Logged output includes transaction_id and block_num

## Requirements

Supported runtime environments:

- [Node.js](https://nodejs.org) versions `>=22.0.0`.
