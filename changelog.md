# RelockeQL changelog

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
