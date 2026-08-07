import { throws } from "assert";

import { serialize_abi, type AbiDef } from "../src/serialize_abi.js";

function baseAbi(): AbiDef {
  return {
    version: "eosio::abi/1.2",
    types: [],
    structs: [],
    actions: [],
    tables: [],
    ricardian_clauses: [],
    error_messages: [],
    abi_extensions: [],
    variants: [],
    action_results: []
  };
}

describe("Spring ABI semantic conformance", () => {
  it("rejects unknown struct field types", () => {
    throws(() =>
      serialize_abi({
        ...baseAbi(),

        structs: [
          {
            name: "test",
            base: "",
            fields: [
              {
                name: "value",
                type: "this_type_does_not_exist"
              }
            ]
          }
        ]
      })
    );
  });

  it("rejects circular typedefs", () => {
    throws(() =>
      serialize_abi({
        ...baseAbi(),

        types: [
          {
            new_type_name: "a",
            type: "b"
          },
          {
            new_type_name: "b",
            type: "a"
          }
        ]
      })
    );
  });

  it("rejects circular struct inheritance", () => {
    throws(() =>
      serialize_abi({
        ...baseAbi(),

        structs: [
          {
            name: "a",
            base: "b",
            fields: []
          },
          {
            name: "b",
            base: "a",
            fields: []
          }
        ]
      })
    );
  });

  it("rejects duplicate action definitions", () => {
    throws(() =>
      serialize_abi({
        ...baseAbi(),

        structs: [
          {
            name: "test",
            base: "",
            fields: []
          }
        ],

        actions: [
          {
            name: "run",
            type: "test",
            ricardian_contract: ""
          },
          {
            name: "run",
            type: "test",
            ricardian_contract: ""
          }
        ]
      })
    );
  });

  it("rejects variants containing unknown types", () => {
    throws(() =>
      serialize_abi({
        ...baseAbi(),

        variants: [
          {
            name: "result",
            types: ["uint64", "not_a_type"]
          }
        ]
      })
    );
  });

  it("rejects actions referencing unknown types", () => {
    throws(() =>
      serialize_abi({
        ...baseAbi(),

        actions: [
          {
            name: "run",
            type: "unknown",
            ricardian_contract: ""
          }
        ]
      })
    );
  });
});
