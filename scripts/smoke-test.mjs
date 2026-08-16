import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

let tempDir;
let tarball;

try {
  const packOutput = execFileSync(npm, ["pack", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });

  const [packed] = JSON.parse(packOutput);

  tarball = resolve(packed.filename);

  console.log(`Packed: ${packed.filename}`);
  console.log(`Package size: ${packed.size} bytes`);
  console.log(`Unpacked size: ${packed.unpackedSize} bytes`);

  const publishedFiles = packed.files.map(({ path }) => path);

  if (
    publishedFiles.some(
      (path) => path.startsWith("src/") || path.startsWith("test/")
    )
  ) {
    throw new Error("Source or test files were included in the npm package.");
  }

  for (const required of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/relockeql.js",
    "dist/relockeql.d.ts",
    ".env.example",
    "examples/server.js"
  ]) {
    if (!publishedFiles.includes(required)) {
      throw new Error(`${required} is missing from the npm package.`);
    }
  }

  tempDir = mkdtempSync(join(tmpdir(), "relockeql-smoke-"));

  writeFileSync(
    join(tempDir, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module"
      },
      null,
      2
    )
  );

  execFileSync(
    npm,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarball,
      "graphql@^16.11.0"
    ],
    {
      cwd: tempDir,
      stdio: "inherit"
    }
  );

  writeFileSync(
    join(tempDir, "test.mjs"),
    `
import {
  json_type,
  public_key_type,
  serialize_abi,
} from "relockeql";

import {
  RelockeQL,
} from "relockeql/relockeql.js";

if (typeof serialize_abi !== "function") {
  throw new Error(
    "Root export serialize_abi is unavailable"
  );
}

if (typeof RelockeQL !== "function") {
  throw new Error(
    "Deep export RelockeQL is unavailable"
  );
}

if (json_type.name !== "relocke_json") {
  throw new Error(
    "JSON scalar export is unavailable"
  );
}

const schemaResult = await RelockeQL(
  {
    query: "{ vaulta { __typename } }",
  },
  {
    chains: {
      vaulta: "https://rpc.example",
    },
  },
);

if (schemaResult.errors?.length) {
  throw new Error(
    "Required endpoint configuration failed"
  );
}

const contractTypeResult = await RelockeQL(
  {
    query: '{ __type(name: "smart_contract_type") { fields { name type { name } } } }',
  },
  {
    chains: {
      vaulta: "https://rpc.example",
    },
  },
);

const contractFields = Object.fromEntries(
  contractTypeResult.data.__type.fields.map(
    ({ name, type }) => [name, type.name],
  ),
);

if (
  contractFields.abi_hash !== "checksum256" ||
  contractFields.wasm_hash !== "checksum256"
) {
  throw new Error(
    "Smart contract hash fields are unavailable"
  );
}

const abi = {
  version: "eosio::abi/1.2",
  types: [],
  structs: [],
  actions: [],
  tables: [],
  ricardian_clauses: [],
  error_messages: [],
  abi_extensions: [],
};

const serialized = serialize_abi(abi);

if (
  serialized &&
  typeof serialized.then === "function"
) {
  throw new Error(
    "serialize_abi unexpectedly returned a Promise"
  );
}

if (
  typeof serialized !== "string" ||
  !serialized.startsWith(
    "0e656f73696f3a3a6162692f312e32"
  )
) {
  throw new Error(
    "serialize_abi returned unexpected bytes"
  );
}

const legacy =
  "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";

const modern =
  public_key_type.serialize(legacy);

if (
  modern &&
  typeof modern.then === "function"
) {
  throw new Error(
    "public_key_type.serialize unexpectedly returned a Promise"
  );
}

if (
  modern !==
  "PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63"
) {
  throw new Error(
    "Legacy public key conversion failed"
  );
}

console.log("✓ root package import works");
console.log("✓ deep package import works");
console.log("✓ explicit endpoint configuration works");
console.log("✓ smart contract hash fields are packaged");
console.log("✓ JSON scalar export works");
console.log("✓ serialize_abi is synchronous");
console.log("✓ RIPEMD-160 v4 key conversion works");
console.log("✓ npm package smoke test passed");
`
  );

  execFileSync(process.execPath, ["test.mjs"], {
    cwd: tempDir,
    stdio: "inherit"
  });

  const packagedServer = await import(
    pathToFileURL(
      join(tempDir, "node_modules", "relockeql", "examples", "server.js")
    ).href
  );
  const serverConfiguration = packagedServer.readServerConfiguration({
    RELOCKEQL_CHAINS: JSON.stringify({
      vaulta: "https://rpc.example",
      hyperion_vaulta: "https://history.example"
    })
  });

  if (
    serverConfiguration.options.chains.vaulta !== "https://rpc.example" ||
    serverConfiguration.options.chains.hyperion_vaulta !==
      "https://history.example"
  ) {
    throw new Error("Packaged example server configuration failed");
  }

  console.log("✓ packaged example server works");
} finally {
  if (tempDir) {
    rmSync(tempDir, {
      recursive: true,
      force: true
    });
  }

  if (tarball) {
    try {
      unlinkSync(tarball);
    } catch {
      // Ignore cleanup errors.
    }
  }
}
