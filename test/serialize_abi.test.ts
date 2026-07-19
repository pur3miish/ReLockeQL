import { deepStrictEqual, equal, rejects } from "assert";
import { Serialize } from "eosjs";

import { serialize_abi } from "../src/serialize_abi.js";

describe("Serialize ABI test", () => {
  it("Validate parsed values", async () => {
    const abi = JSON.parse(
      Buffer.from(
        "7b0a20202020225f5f5f5f636f6d6d656e74223a2022546869732066696c65207761732067656e657261746564207769746820656f73696f2d61626967656e2e20444f204e4f54204544495420222c0a202020202276657273696f6e223a2022656f73696f3a3a6162692f312e32222c0a20202020227479706573223a205b5d2c0a202020202273747275637473223a205b0a20202020202020207b0a202020202020202020202020226e616d65223a20226175746f6277222c0a2020202020202020202020202262617365223a2022222c0a202020202020202020202020226669656c6473223a205b5d0a20202020202020207d2c0a20202020202020207b0a202020202020202020202020226e616d65223a20227573657273222c0a2020202020202020202020202262617365223a2022222c0a202020202020202020202020226669656c6473223a205b0a202020202020202020202020202020207b0a2020202020202020202020202020202020202020226e616d65223a20226163636f756e745f6e616d65222c0a20202020202020202020202020202020202020202274797065223a20226e616d65220a202020202020202020202020202020207d0a2020202020202020202020205d0a20202020202020207d0a202020205d2c0a2020202022616374696f6e73223a205b0a20202020202020207b0a202020202020202020202020226e616d65223a20226175746f6277222c0a2020202020202020202020202274797065223a20226175746f6277222c0a2020202020202020202020202272696361726469616e5f636f6e7472616374223a2022220a20202020202020207d0a202020205d2c0a20202020227461626c6573223a205b0a20202020202020207b0a202020202020202020202020226e616d65223a20227573657273222c0a2020202020202020202020202274797065223a20227573657273222c0a20202020202020202020202022696e6465785f74797065223a2022693634222c0a202020202020202020202020226b65795f6e616d6573223a205b5d2c0a202020202020202020202020226b65795f7479706573223a205b5d0a20202020202020207d0a202020205d2c0a202020202272696361726469616e5f636c6175736573223a205b5d2c0a202020202276617269616e7473223a205b5d2c0a2020202022616374696f6e5f726573756c7473223a205b5d0a7d",
        "hex"
      ).toString()
    );

    const serialized_abi =
      "0e656f73696f3a3a6162692f312e320002066175746f6277000005757365727300010c6163636f756e745f6e616d65046e616d650100000000f043b336066175746f6277000100000000007c15d60369363400000575736572730000000000";

    equal(await serialize_abi(abi), serialized_abi);
  });

  it("preserves absence of optional ABI 1.1 trailing fields", async () => {
    const withoutActionResults = {
      version: "eosio::abi/1.1",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [],
      error_messages: [],
      abi_extensions: []
    };

    const withEmptyVariants = {
      ...withoutActionResults,
      variants: []
    };

    equal(
      (await serialize_abi(withEmptyVariants)).length,
      (await serialize_abi(withoutActionResults)).length + 2
    );
  });

  it("serializes non-empty ABI 1.2 action results", async () => {
    const abi = {
      version: "eosio::abi/1.2",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [],
      error_messages: [],
      abi_extensions: [],
      variants: [],
      action_results: [{ name: "calculate", result_type: "uint64" }]
    };

    const serialized = await serialize_abi(abi);
    equal(serialized.slice(-32), "01000050d9448da2410675696e743634");
  });

  it("normalizes tuple-shaped ABI extensions returned by nodeos", async () => {
    const base = {
      version: "eosio::abi/1.2",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [],
      error_messages: [],
      variants: [],
      action_results: []
    };

    deepStrictEqual(
      await serialize_abi({ ...base, abi_extensions: [[7, "aabb"]] }),
      await serialize_abi({
        ...base,
        abi_extensions: [{ tag: 7, value: "aabb" }]
      })
    );
  });

  it("preserves Markdown newlines and UTF-8 in Ricardian clauses", async () => {
    const body = "---\nschema: relocke.ui/1\n---\nภาษาไทย 🌴";
    const abi = {
      version: "eosio::abi/1.2",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [{ id: "ui.contract", body }],
      error_messages: [],
      abi_extensions: [],
      variants: [],
      action_results: []
    };

    const serialized = await serialize_abi(abi);
    const buffer = new Serialize.SerialBuffer({
      textEncoder: new TextEncoder(),
      textDecoder: new TextDecoder(),
      array: Serialize.hexToUint8Array(serialized)
    });
    const abiType = Serialize.getTypesFromAbi(Serialize.createAbiTypes()).get(
      "abi_def"
    );
    if (!abiType) throw new Error("EOSJS did not provide abi_def.");
    const decoded = abiType.deserialize(buffer);

    deepStrictEqual(decoded.ricardian_clauses, abi.ricardian_clauses);
    equal(buffer.haveReadData(), false);
  });

  it("serializes the ui.contract clause with its newline bytes", async () => {
    const serialized = await serialize_abi({
      version: "eosio::abi/1.2",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [
        {
          id: "ui.contract",
          body: "---\nschema: relocke.ui/1\n---\nkool"
        }
      ],
      error_messages: [],
      abi_extensions: [],
      variants: [],
      action_results: []
    });

    equal(serialized.includes("2d2d2d0a736368656d61"), true);
    equal(serialized.includes("2f310a2d2d2d0a6b6f6f6c"), true);
  });

  it("rejects a later ABI extension after an earlier one is omitted", async () => {
    await rejects(
      serialize_abi({
        version: "eosio::abi/1.2",
        types: [],
        structs: [],
        actions: [],
        tables: [],
        ricardian_clauses: [],
        error_messages: [],
        abi_extensions: [],
        action_results: []
      }),
      /unexpected abi_def\.action_results/
    );
  });
});
