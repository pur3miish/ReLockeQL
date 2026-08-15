# RelockeQL changelog

## 5.0.0 - 2026-08-15

### Breaking

- Removed every built-in RPC endpoint and the `default_rpc_urls` export.
- Made the `RelockeQL` `options` argument and its `chains` map required.
- Only explicitly configured RPC chain keys now create top-level GraphQL chain fields.
- Changed `get_block` transaction action `data` from `String` containing stringified JSON to the `relocke_json` scalar containing decoded JSON.

### Added

- Added separate Hyperion provider configuration through `hyperion_<chain>` keys, such as `hyperion_vaulta`.
- Added `get_blockchain.get_transaction_by_id`, backed by `/v2/history/get_transaction` on the configured Hyperion provider.
- Added `get_blockchain.get_token_transfers`, backed by bounded `/v2/history/get_actions` queries filtered by notified account and `contract:transfer`.
- Added normalized Hyperion transactions, actions, authorization actors, receivers, and decoded JSON action data.
- Added introspectable descriptions for the chain entry points, Hyperion queries and result types, and nested `get_block` transaction and action fields.
- Added provider timeout, unavailable (including HTTP 404), malformed-response, missing-endpoint, transaction-ID mismatch, and confirmed not-found-envelope handling.
- Added endpoint-configuration, Hyperion history, query-shape, limit, not-found, and JSON action-data tests.
- Replaced live RPC calls in the unit suite with deterministic provider mocks.

### Security and provider usage

- Hyperion calls use one explicitly configured provider with no fallback.
- Hyperion calls time out after eight seconds unless the caller supplies a request signal.
- Token-transfer searches default to 25 results and reject limits above 100.
- Token-transfer searches are always descending, `hot_only`, and `noBinary`; offset and ascending scans are not exposed.
- Hyperion endpoint keys are excluded from the GraphQL chain catalog and cannot be mistaken for RPC chains.

### Migration

```js
await RelockeQL(
  { query },
  {
    chains: {
      vaulta: "https://your-vaulta-rpc.example",
      hyperion_vaulta: "https://your-vaulta-hyperion.example"
    }
  }
);
```

Applications selecting `get_block` action `data` should remove `JSON.parse`; the field now returns the decoded value directly.

## 4.0.0 - 2026-08-07

### Breaking

- Raised the minimum supported Node.js version from Node.js 18 to Node.js 22.
- Updated `eosio-wasm-js` from v5 to v6.
- Updated `ripemd160-js` from v3 to v4.
- `serialize_abi()` is now synchronous and returns a hexadecimal string directly instead of `Promise<string>`.
- GraphQL public-key serialization no longer introduces unnecessary Promise wrappers.
- Existing callers using `await serialize_abi(...)` remain compatible, but callers relying on `.then()`, `.catch()`, or explicit Promise typings must update.

### Removed

- Removed the `eosjs` runtime dependency.
- Removed `ts-node`.
- Removed the legacy `jsconfig.json`.
- Removed the legacy ESLint configuration.

### Changed

- Replaced EOSJS ABI serialization with ReLockeQL's own Antelope `abi_def` binary encoder.
- Preserved UTF-8 byte lengths for Ricardian contracts and clauses.
- - Preserved ordered trailing ABI binary extensions for `variants` and `action_results`.
- Explicitly reject `kv_tables`, which is not part of the current Antelope Spring `abi_def` binary layout.
- Migrated RIPEMD-160 usage to the synchronous `ripemd160-js` v4 API.
- Migrated local `eosio-wasm-js` transaction serialization to its synchronous v6 APIs.
- Updated TypeScript to v6.
- Updated ESLint to v10 with flat configuration.
- Updated Prettier to v3.
- Standardized package compilation under `dist/`.

### Added

- Added a committed npm lockfile.
- Added npm tarball smoke testing.
- Added CI across Node.js 22, 24, and 26 on Linux and macOS.

### ABI validation

- Added Spring-style semantic ABI validation before binary serialization.
- Added validation for unknown struct field types.
- Added detection of circular typedef references.
- Added detection of circular struct inheritance.
- Added duplicate definition checks for ABI types, structs, actions, tables, error messages, variants, and action results.
- Added validation that action, table, variant, typedef, and action-result types resolve to valid Antelope built-in types, structs, typedefs, or variants.
- Added validation for unknown struct base types.
- Added support for validating Antelope type modifiers including dynamic arrays (`[]`), fixed-size arrays (`[N]`), optionals (`?`), and binary-extension fields (`$`).
- Separated ABI semantic validation from ABI binary encoding through the new `validate_abi()` validation stage.

### Protocol conformance

- Expanded protocol conformance coverage using behavioral cases derived from Antelope Spring and eosjs test suites without adding eosjs as a dependency.
- Added boundary tests for signed and unsigned 64-bit and 128-bit integer scalar types.
- Corrected Antelope `name` validation to support valid 13-character names with the protocol-defined restricted 13th-character alphabet.
- Added tests for invalid 13th-character names, oversized names, invalid characters, and non-normalized trailing periods.
- Added asset symbol validation coverage for valid 1-7 character symbols and invalid lowercase, oversized, missing, and malformed symbols.
- Added boolean scalar coverage for protocol-supported `true`, `false`, `0`, and `1` values.
- Added Antelope block timestamp validation coverage.

### Transaction serialization

- Added deterministic transaction serialization conformance tests using known Antelope/eosjs-compatible transfer fixtures.
- Added exact action-data byte assertions for token transfer actions.
- Added deterministic TAPOS and transaction-header serialization coverage.
- Added multi-action ordering tests.
- Added coverage for separation of context-free actions and authorized actions.
- Added transaction configuration boundary tests for `max_cpu_usage_ms` and `max_net_usage_words`.
- Added UTF-8 action-string serialization regression coverage to ensure string length prefixes are based on UTF-8 byte length rather than JavaScript string length.

### Tests

- Added `protocol_conformance.test.ts`.
- Added `transaction_conformance.test.ts`.
- Added `abi_semantic_conformance.test.ts`.
- Added regression coverage for ABI graph validation and protocol serialization edge cases that were previously accepted without validation.

## 3.0.0

### Breaking

- Contract table fields now return an object containing `rows`, `more`, and `next_key`. For example, `powup_order { ... }` is now queried as `powup_order { rows { ... } more next_key }`.
- Remove the legacy contract table shape that returned rows directly and discarded the blockchain pagination metadata.

### Fixed

- Apply the contract table argument defaults when `arg` is omitted instead of failing while reading `key_type`.

## 2.0.2

### Fixed

- Replace the previous ABI encoder with the canonical `abi_def` field order and binary encodings.
- Preserve newline characters and complete UTF-8 byte sequences in Ricardian contracts and `ricardian_clauses` bodies. The previous string encoder counted newline characters in the length prefix but omitted their bytes, which shifted subsequent ABI fields and could make nodeos fail while unpacking `error_messages`.
- Encode `ricardian_clauses` as canonical `clause_pair[]` values without altering Markdown content.
- Enforce the ordered ABI binary-extension sequence for `variants`, `action_results`, and `kv_tables`.
- Preserve omitted trailing binary extensions instead of materializing extra zero-length vectors.

### Added

- Validate generated ABI field encodings before deployment.
- Verify that Ricardian clauses preserve their exact UTF-8 content.
- Add regression coverage for multiline Markdown, Unicode content, `ui.contract`, ABI extensions, and action results.

## 2.0.1

### Fixed

- Serialize the ABI 1.2 `action_results` binary-extension vector instead of silently dropping it.
- Preserve absent trailing ABI fields for older ABI versions while correctly encoding empty or populated binary-extension vectors when present.
- Serialize non-empty binary-extension arrays and normalize tuple-shaped `abi_extensions` returned by nodeos.
- Remove the serializer's brittle dependency on the numeric position of `abi_def` in its internal meta-ABI.

## 2.0.0

### Breaking

- Removed `get_blockchain.get_ram_price`. RAM pricing is not a standard ReLockeQL blockchain field and should be implemented by the consuming API layer when chain-specific pricing logic is needed.

## 1.0.0

- Initial release
