import { deepStrictEqual, equal, rejects } from "assert";

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

    equal(serialize_abi(abi), serialized_abi);
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
      serialize_abi(withEmptyVariants).length,
      serialize_abi(withoutActionResults).length + 2
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

    const serialized = serialize_abi(abi);
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
      serialize_abi({ ...base, abi_extensions: [[7, "aabb"]] }),
      serialize_abi({
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

    const serialized = serialize_abi(abi);
    const bodyBytes = Buffer.from(body, "utf8");
    const encodedBody = `${bodyBytes.length
      .toString(16)
      .padStart(2, "0")}${bodyBytes.toString("hex")}`;

    equal(serialized.includes(encodedBody), true);
  });

  it("matches canonical bytes for every required abi_def field", async () => {
    const abi = {
      version: "eosio::abi/1.0",
      types: [{ new_type_name: "account", type: "name" }],
      structs: [
        {
          name: "transfer",
          base: "",
          fields: [
            { name: "from", type: "name" },
            { name: "memo", type: "string" }
          ]
        }
      ],
      actions: [
        {
          name: "transfer",
          type: "transfer",
          ricardian_contract: "ไทย 🌴\ncontract"
        }
      ],
      tables: [
        {
          name: "accounts",
          index_type: "i64",
          key_names: ["owner"],
          key_types: ["name"],
          type: "account"
        }
      ],
      ricardian_clauses: [{ id: "clause", body: "line 1\nline 2" }],
      error_messages: [
        { error_code: "18446744073709551615", error_msg: "maximum" }
      ],
      abi_extensions: [[7, "aabb"]] as [number, string][]
    };

    equal(
      serialize_abi(abi),
      "0e656f73696f3a3a6162692f312e3001076163636f756e74046e616d6501087472616e7366657200020466726f6d046e616d65046d656d6f06737472696e6701000000572d3ccdcd087472616e7366657217e0b984e0b897e0b8a220f09f8cb40a636f6e747261637401000000384f4d11320369363401056f776e657201046e616d65076163636f756e740106636c617573650d6c696e6520310a6c696e65203201ffffffffffffffff076d6178696d756d01070002aabb"
    );
  });

  it("matches canonical ABI 1.2 variant, result, and KV table bytes", async () => {
    const abi = {
      version: "eosio::abi/1.2",
      types: [],
      structs: [],
      actions: [],
      tables: [],
      ricardian_clauses: [],
      error_messages: [],
      abi_extensions: [],
      variants: [{ name: "result", types: ["uint64", "string"] }],
      action_results: [{ name: "calculate", result_type: "uint64" }],
      kv_tables: {
        people: {
          type: "person",
          primary_index: { name: "id", type: "uint64" },
          secondary_indices: {
            byname: { type: "name" },
            byage: { type: "uint32" }
          }
        }
      }
    };

    equal(
      serialize_abi(abi),
      "0e656f73696f3a3a6162692f312e32000000000000000106726573756c74020675696e74363406737472696e6701000050d9448da2410675696e7436340100000000a858a9aa06706572736f6e00000000000040720675696e74363402000000002869a63f046e616d650000000000c58c3f0675696e743332"
    );
  });

  it("serializes the ui.contract clause with its newline bytes", async () => {
    const serialized = serialize_abi({
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
