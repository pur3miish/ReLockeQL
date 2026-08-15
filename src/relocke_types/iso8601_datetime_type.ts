import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

const ISO_8601_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:Z|([+-])(\d{2}):(\d{2}))?$/u;

function validateIso8601DateTime(value: unknown): string {
  if (typeof value !== "string") {
    throw new GraphQLError("ISO-8601 date-time values must be strings.");
  }

  const match = ISO_8601_DATETIME.exec(value);

  if (!match) {
    throw new GraphQLError(
      "Date-time must use YYYY-MM-DDTHH:mm:ss with an optional fractional second and Z or ±HH:mm offset."
    );
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
    ,
    ,
    offsetHour,
    offsetMinute
  ] = match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const leapYear =
    numericYear % 4 === 0 &&
    (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ][numericMonth - 1];

  if (
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1 ||
    numericDay > (daysInMonth ?? 0) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (offsetHour !== undefined && Number(offsetHour) > 23) ||
    (offsetMinute !== undefined && Number(offsetMinute) > 59)
  ) {
    throw new GraphQLError("Date-time contains an invalid calendar value.");
  }

  return value;
}

export const iso8601_datetime_type = new GraphQLScalarType({
  name: "iso8601_datetime",
  description:
    "An ISO-8601 date and time in YYYY-MM-DDTHH:mm:ss format, with optional fractional seconds and an optional Z or ±HH:mm UTC offset. Hyperion timestamps without an offset are treated as UTC by the provider.",
  parseLiteral(node) {
    if (node.kind !== Kind.STRING) {
      throw new GraphQLError("ISO-8601 date-time literals must be strings.");
    }

    return validateIso8601DateTime(node.value);
  },
  parseValue: validateIso8601DateTime,
  serialize: validateIso8601DateTime
});
