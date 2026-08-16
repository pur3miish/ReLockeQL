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

The example server accepts the complete multi-chain endpoint map as JSON. Every configured RPC chain is exposed by the same GraphQL server, while matching `hyperion_<chain>` entries enable that chain's history queries. It does not contain fallback providers:

Copy the environment template. It contains the tested ReLocke RPC providers and the EOSphere Vaulta Hyperion provider; you may replace or extend the map with providers you select:

```sh
cp .env.example .env
```

The `.env` file is ignored by Git. Once configured, start the server normally:

```sh
npm run server
```

You can alternatively provide the same configuration inline:

```sh
RELOCKEQL_CHAINS='{
  "vaulta": "https://eos.relocke.io",
  "hyperion_vaulta": "https://vaulta-hyperion.eosphere.io",
  "telos": "https://telos.relocke.io",
  "xpr": "https://proton.relocke.io",
  "wax": "https://wax.relocke.io",
  "jungle": "https://jungle.relocke.io"
}' \
RELOCKEQL_CONTRACTS='{
  "vaulta": ["eosio.token", "eosio"],
  "telos": ["eosio.token"],
  "xpr": ["eosio.token"],
  "wax": ["eosio.token"],
  "jungle": ["eosio.token"]
}' \
npm run server
```

`RELOCKEQL_CHAINS` is required and may contain any number of tested or custom GraphQL-safe chain names. The server loads `.env` automatically when it exists, but still refuses to start without an explicit chain map. `RELOCKEQL_CONTRACTS` is an optional JSON map of chain names to contract account arrays. `PORT` defaults to `3002`. Send GraphQL requests as JSON over HTTP `POST`; browser `GET` requests return `405` without stopping the server.

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

### Query smart contract code and hashes

`get_smart_contract` resolves only the selected contract fields. For example, this query retrieves both deployment hashes with one raw-ABI RPC request and does not download the contract WASM:

```js
const query = /* GraphQL */ `
  {
    vaulta {
      get_blockchain {
        get_smart_contract(account_name: "rloc") {
          abi_hash
          wasm_hash
        }
      }
    }
  }
`;

const { data } = await RelockeQL(
  { query },
  { chains: { vaulta: "https://your-vaulta-rpc.example" } }
);
```

The same field can select `wasm` and `abi` as base64-encoded content. A `wasm_hash`-only selection uses the dedicated code-hash endpoint, while compatible selections share in-flight RPC requests within the GraphQL operation.

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

### List specific contract actions

`get_actions` requires a notified account, contract, action name, and lower time boundary, which Hyperion combines as indexed account, `contract:action`, and time-range filters. Searches span at most seven days, request newest-first results, disable total-result counting, omit large binary data, default to 10 results, and return at most 25. It does not assume that a provider maintains Hyperion's optional hot-index alias. Offset, ascending scans, and arbitrary indexed-field filters are intentionally unavailable.

The required `after` and optional `before` boundaries use the `iso8601_datetime` GraphQL scalar rather than unrestricted strings. It accepts `YYYY-MM-DDTHH:mm:ss`, optional fractional seconds, and an optional `Z` or `±HH:mm` offset. Keep `after` fixed and pass the oldest returned action timestamp as `before` to retrieve the next older page inside the bounded window. Query an earlier explicit seven-day window when that window is exhausted.

```js
const query = /* GraphQL */ `
  {
    vaulta {
      get_blockchain {
        get_actions(
          account: "alice"
          contract: "eosio.token"
          action: "transfer"
          after: "2026-08-08T10:00:00Z"
          before: "2026-08-15T10:00:00Z"
          limit: 10
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

### Hyperion resource policy for block producers

ReLockeQL history queries are read-only HTTP requests. They do not submit blockchain transactions or consume on-chain CPU, NET, or RAM. They do consume the selected provider's API capacity, outbound bandwidth, and Hyperion/Elasticsearch CPU and I/O.

`get_actions` is intentionally narrower than the underlying Hyperion endpoint. A valid request produces one upstream request shaped like this:

```text
GET /v2/history/get_actions
  ?account=<notified-account>
  &filter=<contract>:<action>
  &after=<ISO-8601-lower-bound>
  &before=<optional-ISO-8601-upper-bound>
  &limit=<1-25>
  &sort=desc
  &track=false
  &noBinary=true
```

The library enforces the following provider protections before sending that request:

- Notified account, contract, action, and lower time boundary are all required.
- A request may cover no more than seven days.
- The default result limit is 10 and the hard maximum is 25.
- `track=false` prevents total-result counting.
- `noBinary=true` excludes large binary action payloads.
- Only newest-first ordering is available; ascending scans are not exposed.
- Offset pagination, arbitrary indexed-field filters, and unbounded searches are not exposed.
- The selected Hyperion provider receives one request with an eight-second timeout and no fallback request to another producer.
- Returned actions are rejected unless they still match the requested notified account, contract, and action.

`get_transaction_by_id` makes one exact transaction-ID lookup against the selected provider. It does not perform a broad action search or fall back to another endpoint.

These controls bound the cost of an individual query; they cannot limit how many queries a public deployment receives. API operators should additionally apply per-user or per-credential rate limits, concurrency limits, short-lived deduplication for identical reads, and provider monitoring. Hyperion operators remain free to enforce stricter reverse-proxy limits and Elasticsearch query timeouts.

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
