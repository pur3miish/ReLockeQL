# RelockeQL changelog

## 3.0.1

### Fixed

- Remove the `eosjs` runtime dependency and replace its ABI serialization path with a self-contained Antelope `abi_def` encoder.
- Preserve canonical ABI bytes for UTF-8 Ricardian text, ABI extensions, variants, action results, and key-value tables.

### Tests

- Add dependency-free canonical byte fixtures covering required ABI fields and the ABI 1.1/1.2 binary extensions.

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
