import { deepStrictEqual, equal, throws } from "assert";

import { asset_type } from "../src/relocke_types/asset_type.js";
import { block_timestamp_type } from "../src/relocke_types/block_timestamp_type.js";
import { boolean_type } from "../src/relocke_types/boolean_type.js";
import { generate_int_type } from "../src/relocke_types/generate_int_type.js";
import { generate_uint_type } from "../src/relocke_types/generate_uint_type.js";
import { iso8601_datetime_type } from "../src/relocke_types/iso8601_datetime_type.js";
import { name_type } from "../src/relocke_types/name_type.js";

describe("Antelope protocol conformance", () => {
  describe("name", () => {
    it("accepts a valid 13-character Antelope name", () => {
      /*
       * Antelope name supports up to 13 characters.
       * The 13th character has a restricted character set.
       *
       * This is based on the same canonical edge case used
       * by eosjs's SerialBuffer tests.
       *
       * This test currently exposes a ReLockeQL incompatibility:
       * name_type presently limits names to 12 characters.
       */
      const value = ".12345abcdefg";

      equal(name_type.parseValue(value), value);
    });

    it("rejects a name longer than 13 characters", () => {
      throws(() => name_type.parseValue("abcdabcdabcdab"));
    });

    it("rejects invalid name characters", () => {
      throws(() => name_type.parseValue("6789$/,"));
    });

    it("rejects an invalid 13th character", () => {
      /*
       * The first 12 characters are valid.
       * The 13th character 'z' is not allowed.
       */
      throws(() => name_type.parseValue("abcdefghijklz"));
    });
  });

  describe("asset", () => {
    it("accepts symbols from 1 through 7 characters", () => {
      for (let length = 1; length <= 7; length += 1) {
        const value = `10.000 ${"A".repeat(length)}`;

        equal(asset_type.parseValue(value), value);
      }
    });

    it("rejects an empty symbol", () => {
      throws(() => asset_type.parseValue("10.000 "));
    });

    it("rejects an 8-character symbol", () => {
      throws(() => asset_type.parseValue("10.000 AAAAAAAA"));
    });

    it("rejects lowercase symbols", () => {
      throws(() => asset_type.parseValue("10.000 eos"));
    });

    it("rejects additional trailing symbol text", () => {
      throws(() => asset_type.parseValue("10.000 EOS blah"));
    });
  });

  describe("bool", () => {
    it("accepts protocol boolean forms", () => {
      deepStrictEqual(boolean_type.parseValue(false), false);
      deepStrictEqual(boolean_type.parseValue(true), true);
      deepStrictEqual(boolean_type.parseValue(0), false);
      deepStrictEqual(boolean_type.parseValue(1), true);
    });

    it("rejects integers other than 0 and 1", () => {
      throws(() => boolean_type.parseValue(10));
    });

    it("rejects arbitrary strings", () => {
      throws(() => boolean_type.parseValue("true"));
    });
  });

  describe("integer boundaries", () => {
    it("accepts the complete uint64 range", () => {
      const uint64 = generate_uint_type(64);

      equal(uint64.parseValue("0"), "0");

      equal(uint64.parseValue("18446744073709551615"), "18446744073709551615");

      throws(() => uint64.parseValue("18446744073709551616"));

      throws(() => uint64.parseValue("-1"));
    });

    it("accepts the complete int64 range", () => {
      const int64 = generate_int_type(64);

      equal(int64.parseValue("-9223372036854775808"), "-9223372036854775808");

      equal(int64.parseValue("9223372036854775807"), "9223372036854775807");

      throws(() => int64.parseValue("-9223372036854775809"));

      throws(() => int64.parseValue("9223372036854775808"));
    });

    it("accepts the complete uint128 range", () => {
      const uint128 = generate_uint_type(128);

      equal(
        uint128.parseValue("340282366920938463463374607431768211455"),
        "340282366920938463463374607431768211455"
      );

      throws(() =>
        uint128.parseValue("340282366920938463463374607431768211456")
      );
    });

    it("accepts the complete int128 range", () => {
      const int128 = generate_int_type(128);

      equal(
        int128.parseValue("-170141183460469231731687303715884105728"),
        "-170141183460469231731687303715884105728"
      );

      equal(
        int128.parseValue("170141183460469231731687303715884105727"),
        "170141183460469231731687303715884105727"
      );

      throws(() =>
        int128.parseValue("170141183460469231731687303715884105728")
      );
    });
  });

  describe("block_timestamp_type", () => {
    it("accepts the Antelope epoch timestamp", () => {
      const value = "2000-01-01T00:00:00.000";

      equal(block_timestamp_type.parseValue(value), value);
    });

    it("rejects malformed timestamps", () => {
      throws(() => block_timestamp_type.parseValue("not-a-timestamp"));
    });
  });

  describe("iso8601_datetime", () => {
    it("accepts Hyperion timestamps and explicit UTC offsets", () => {
      [
        "2026-08-15T10:00:00",
        "2026-08-15T10:00:00.123",
        "2026-08-15T10:00:00Z",
        "2026-08-15T10:00:00.123456+07:00"
      ].forEach((value) =>
        equal(iso8601_datetime_type.parseValue(value), value)
      );
    });

    it("rejects malformed and impossible calendar values", () => {
      [
        "2026-08-15",
        "2026-02-29T10:00:00Z",
        "2026-13-01T10:00:00Z",
        "2026-08-15 10:00:00Z",
        "tomorrow"
      ].forEach((value) =>
        throws(() => iso8601_datetime_type.parseValue(value))
      );
    });
  });
});
