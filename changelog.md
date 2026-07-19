# RelockeQL changelog

## 2.0.2

### Fixed

- Replace the custom ABI encoder with EOSJS `SerialBuffer` and its canonical `abi_def` type graph.
- Preserve newline characters and complete UTF-8 byte sequences in Ricardian contracts and `ricardian_clauses` bodies. The previous string encoder counted newline characters in the length prefix but omitted their bytes, which shifted subsequent ABI fields and could make nodeos fail while unpacking `error_messages`.
- Encode `ricardian_clauses` as canonical `clause_pair[]` values without altering Markdown content.
- Enforce the ordered ABI binary-extension sequence for `variants`, `action_results`, and `kv_tables`.
- Preserve omitted trailing binary extensions instead of materializing extra zero-length vectors.

### Added

- Decode every generated ABI with EOSJS before returning it and reject unread trailing bytes.
- Verify that Ricardian clauses round-trip exactly through EOSJS before deployment.
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
