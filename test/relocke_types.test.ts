import { deepStrictEqual, ok, strictEqual, throws } from "assert";

import { asset_type } from "../src/relocke_types/asset_type.js";
import { block_timestamp_type as block_time_stamp } from "../src/relocke_types/block_timestamp_type.js";
import { boolean_type as bool } from "../src/relocke_types/boolean_type.js";
import { bytes_type as bytes } from "../src/relocke_types/bytes_type.js";
import { extended_asset_type as extended_asset } from "../src/relocke_types/extended_asset_type.js";
import { generate_checksum } from "../src/relocke_types/generate_checksum_type.js";
import { generate_float_type } from "../src/relocke_types/generate_float_type.js";
import { generate_int_type } from "../src/relocke_types/generate_int_type.js";
import { generate_uint_type } from "../src/relocke_types/generate_uint_type.js";
import { name_type as name } from "../src/relocke_types/name_type.js";
import { public_key_type as public_key } from "../src/relocke_types/public_key_type.js";
import { signature_type as signature } from "../src/relocke_types/signature_type.js";
import { symbol_code_type as symbol_code } from "../src/relocke_types/symbol_code_type.js";
import { symbol_type as symbol } from "../src/relocke_types/symbol_type.js";
import { time_point_sec_type as time_point_sec } from "../src/relocke_types/time_point_sec_type.js";
import { time_point_type as time_point } from "../src/relocke_types/time_point_type.js";
import { varint32_type as varint32 } from "../src/relocke_types/varint32_type.js";
import { varuint32_type as varuint32 } from "../src/relocke_types/varuint32_type.js";

describe("Relocke types - validating parse values", () => {
  it("Validate parsed values", () => {
    deepStrictEqual(varint32.parseValue(""), "");
    deepStrictEqual(varuint32.parseValue(""), "");
    strictEqual(time_point.parseValue("1616667468"), "1616667468");
    strictEqual(time_point_sec.parseValue("1616667453647"), "1616667453647");
    deepStrictEqual(symbol.parseValue("3,EOS"), "3,EOS");
    deepStrictEqual(symbol_code.parseValue("EOS"), "EOS");
    deepStrictEqual(
      signature.parseValue(
        "SIG_K1_K4jhCs4S3hVfXNhX4t6QSSGgdYTYNk6LhKTphcYoLH6EYatq3zvU38CNEj7VDtMmHWq24KhmR6CLBqyT5tFiFmXndthr7X"
      ),
      "SIG_K1_K4jhCs4S3hVfXNhX4t6QSSGgdYTYNk6LhKTphcYoLH6EYatq3zvU38CNEj7VDtMmHWq24KhmR6CLBqyT5tFiFmXndthr7X"
    );
    ok(signature.parseValue("") == "");
    throws(() => signature.parseValue(1848));
    ok(asset_type.parseValue("") == "");
    strictEqual(asset_type.parseValue("1.000 EOS"), "1.000 EOS");
    deepStrictEqual(block_time_stamp.parseValue(""), "");
    throws(() => block_time_stamp.parseValue("not a time"));
    deepStrictEqual(
      block_time_stamp.parseValue("2021-03-01T12:26:42.147"),
      "2021-03-01T12:26:42.147"
    );
    deepStrictEqual(bool.parseValue(true), true);
    ok(bytes.parseValue("ff") == "ff");
    throws(() => bytes.parseValue("kl"));
    ok(bytes.parseValue("") == "");
    deepStrictEqual(
      extended_asset.parseValue("1.000 EOS@eosio"),
      "1.000 EOS@eosio"
    );
    deepStrictEqual(
      generate_checksum(20).parseValue(
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      ),
      "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
    );
    ok(generate_float_type(32).parseValue("1.0"), "1.0");
    deepStrictEqual(generate_int_type(8).parseValue(127), "127");
    deepStrictEqual(generate_int_type(8).parseValue(-128), "-128");
    throws(() => generate_int_type(8).parseValue(-129));
    throws(() => generate_int_type(8).parseValue(128));
    ok(generate_int_type(8).parseValue("") == "");
    deepStrictEqual(generate_uint_type(8).parseValue(0), "0");
    deepStrictEqual(generate_uint_type(8).parseValue(255), "255");
    deepStrictEqual(generate_uint_type(16).parseValue(0xffff), "65535");
    throws(() => generate_uint_type(16).parseValue(0x10000));
    throws(() => generate_uint_type(8).parseValue(-1));
    ok(generate_uint_type(8).parseValue("") == "");
    deepStrictEqual(name.parseValue("eosio"), "eosio");
    deepStrictEqual(name.parseValue(""), "");
    throws(() => name.parseValue("NOT A NAME"));

    deepStrictEqual(
      public_key.parseValue(
        "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
      ),
      "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
    );

    deepStrictEqual(
      public_key.parseValue(
        "SYS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
      ),
      "SYS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
    );

    deepStrictEqual(
      public_key.serialize(
        "SYS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
      ),
      "PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63"
    );

    throws(() =>
      public_key.parseValue(
        "NOT_EOS_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW533"
      )
    );
  });
});
