# RelockeQL changelog

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
