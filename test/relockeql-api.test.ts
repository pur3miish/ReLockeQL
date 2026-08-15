import { strictEqual } from "assert";

import * as RootExports from "../src/index.js";
import { RelockeQL as ModuleRelockeQL } from "../src/relockeql.js";

const { RelockeQL: RootRelockeQL, json_type } = RootExports;

describe("RelockeQL public API", () => {
  it("exports RelockeQL from the root package and module path", () => {
    strictEqual(RootRelockeQL, ModuleRelockeQL);
  });

  it("exports JSON support without exporting provider defaults", () => {
    strictEqual(json_type.name, "relocke_json");
    strictEqual("default_rpc_urls" in RootExports, false);
  });
});
