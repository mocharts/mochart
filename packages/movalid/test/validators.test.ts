import { describe, it, expect } from "vitest";

import baseValidators from "../src/validators";
import type { CustomValidator, Validator, ConditionalRule } from "../src/validators";

// Deep equality that treats structurally identical functions as equal —
// vitest's toEqual compares functions by reference, which would fail the
// nestedValues comparisons against freshly created validators.
const isEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a === "function" && typeof b === "function") {
    return a.name === b.name && String(a) === String(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((value, i) => isEqual(value, b[i]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every(key => isEqual(a[key], b[key]));
  }
  return false;
};

declare module "vitest" {
  interface Matchers<T = any> {
    toIsEqual(expected: any, context?: string): T;
  }
}

expect.extend({
  toIsEqual(received: any, expected: any, context?: string) {
    const pass = isEqual(received, expected);
    return {
      pass,
      message: () =>
        "Expected " +
        received +
        (pass ? " not" : "") +
        " to be isEqual to " +
        expected +
        (context !== undefined ? " (" + context + ")" : "")
    };
  }
});

// Dynamic-lookup views for the table-driven tests: validator names and
// extension names arrive as plain strings, so the mapped types cannot apply.
const anyValidators = baseValidators as unknown as Record<string, (...args: any[]) => Validator>;
const extensionsOf = (validatorFunction: Validator) => validatorFunction as unknown as Record<string, (...args: any[]) => Validator>;

class AClass {}

const customValidator: CustomValidator = v => v === 123;
customValidator.message = "should be the magic number 123!";

describe("validators", () => {
  const validatorInputs: Record<string, { args: any[]; valid?: any; invalid?: any }> = {
    boolean: { args: [], valid: true, invalid: "true" },
    number: { args: [], valid: 123.45, invalid: "123.45" },
    string: { args: [], valid: "hello", invalid: true },
    array: { args: [], valid: [], invalid: {} },
    object: { args: [], valid: {}, invalid: "" },
    any: { args: [], valid: undefined, invalid: undefined },
    numeric: { args: [], valid: "123.45", invalid: "a" },
    integer: { args: [], valid: 123, invalid: 123.45 },
    color: { args: [], valid: "#FFF", invalid: "#FFFF" },
    dateInstance: { args: [], valid: new Date(0), invalid: new Date(NaN) },
    dateISO: { args: [], valid: "2016-09-01T00:00:00Z", invalid: "1234567" },
    datePrimitive: { args: [], valid: 1, invalid: new Date(0) },
    dateAny: { args: [], valid: 1, invalid: "1234567" },
    instanceOf: { args: [AClass], valid: new AClass(), invalid: "abc" },
    typeOf: { args: ["object"], valid: {}, invalid: 123 },
    custom: { args: [customValidator], valid: 123, invalid: 1234 },
    numberMin: { args: [0], valid: 0, invalid: -1 },
    numberMax: { args: [100], valid: 0, invalid: 101 },
    numberMinMax: { args: [0, 50], valid: 0, invalid: 51 },
    numericMin: { args: [0], valid: "0", invalid: "-1" },
    numericMax: { args: [100], valid: "0", invalid: "101" },
    numericMinMax: { args: [0, 50], valid: "0", invalid: "51" },
    integerMin: { args: [0], valid: 0, invalid: -1 },
    integerMax: { args: [100], valid: 0, invalid: 101 },
    integerMinMax: { args: [0, 50], valid: 0, invalid: 51 },
    regexp: { args: [/(match)/], valid: "match", invalid: "march" },
    stringRegexp: { args: [/(match)/], valid: "match", invalid: "march" },
    stringWithLength: { args: [3], valid: "abc", invalid: "ab" },
    stringWithLengthMin: { args: [5], valid: "abcde", invalid: "abcd" },
    stringWithLengthMax: { args: [4], valid: "abcd", invalid: "abcde" },
    stringWithLengthMinMax: { args: [2, 4], valid: "abc", invalid: "" },
    equal: { args: ["equal"], valid: "equal", invalid: "not" },
    oneOf: { args: [["one", "two"]], valid: "one", invalid: "three" },
    oneIn: { args: [{ in: true, there: "yes" }], valid: "in", invalid: "absent" },
    notEqual: { args: ["equal"], valid: "not", invalid: "equal" },
    notOneOf: { args: [["one", "two"]], valid: "three", invalid: "one" },
    notOneIn: { args: [{ in: true, there: "yes" }], valid: "absent", invalid: "in" },
    arrayWithLength: { args: [3], valid: [1, 6, 11], invalid: [1, 6] },
    arrayWithLengthMin: { args: [5], valid: [1, 6, 11, 16, 21], invalid: [1, 6, 11, 16] },
    arrayWithLengthMax: { args: [4], valid: [1, 6, 11, 16], invalid: [1, 6, 11, 16, 21] },
    arrayWithLengthMinMax: { args: [2, 4], valid: [1, 6, 11, 16], invalid: [1, 6, 11, 16, 21] },
    arrayOf: { args: [baseValidators.string()], valid: ["", ""], invalid: [1, 2] },
    objectWith: {
      args: [["a", "b", "c"], baseValidators.string()],
      valid: { a: "", b: "", c: "" },
      invalid: { a: "", c: "" }
    },
    objectWithSome: {
      args: [["a", "b", "c"], baseValidators.string()],
      valid: { a: "", c: "" },
      invalid: { a: "", d: "" }
    },
    objectWithShape: {
      args: [{ a: baseValidators.numberMin(5), b: baseValidators.numberMin(10) }],
      valid: { a: 10, b: 15 },
      invalid: { a: 4, b: 15 }
    },
    partialObjectWithShape: {
      args: [{ a: baseValidators.numberMin(5), b: baseValidators.numberMin(10) }],
      valid: { a: 10 },
      invalid: { a: 4 }
    },
    or: { args: [[baseValidators.equal("one"), baseValidators.equal("two")]], valid: "one", invalid: "three" },
    and: { args: [[baseValidators.numberMin(5), baseValidators.numberMax(15)]], valid: 10, invalid: 16 },
    not: { args: [baseValidators.equal("equal")], valid: "not", invalid: "equal" },
    conditional: {
      args: [[{ condition: () => true, validator: baseValidators.notEqual(null) }], {}],
      valid: 123,
      invalid: null
    }
  };
  const irregularValidatorKeys = ["conditional", "any"];
  const extensionInputs: Record<string, { args: any[]; valid: any }> = {
    orEqual: { args: ["good"], valid: "good" },
    orOneOf: { args: [["good", "great"]], valid: "great" },
    or: { args: [baseValidators.equal("amazing")], valid: "amazing" }
  };

  const validatorKeys = Object.keys(baseValidators);
  const regularValidatorKeys = validatorKeys.filter(key => irregularValidatorKeys.indexOf(key) === -1);

  const extensionKeys = Object.keys(extensionInputs);
  const isEnumValidatorNames: Record<string, boolean> = {
    equal: true,
    oneOf: true,
    oneIn: true,
    or: true
  };
  const isRangedValidatorNames: Record<string, boolean> = {
    numberMin: true,
    numberMax: true,
    numberMinMax: true,
    numericMin: true,
    numericMax: true,
    numericMinMax: true,
    integerMin: true,
    integerMax: true,
    integerMinMax: true
  };

  describe("type validators", () => {
    describe("boolean", () => {
      it("should allow true", () => {
        expect(baseValidators.boolean()(true)).toBe(true);
      });

      it("should allow false", () => {
        expect(baseValidators.boolean()(false)).toBe(true);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.boolean()([])).toBe(false);
      });

      it('should not allow "false"', () => {
        expect(baseValidators.boolean()("false")).toBe(false);
      });

      it('should not allow "true"', () => {
        expect(baseValidators.boolean()("true")).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.boolean()(null)).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.boolean()(undefined)).toBe(false);
      });

      it("should not allow 0", () => {
        expect(baseValidators.boolean()(0)).toBe(false);
      });
    });

    describe("number", () => {
      it("should allow negative numbers", () => {
        expect(baseValidators.number()(-1)).toBe(true);
      });

      it("should allow positive numbers", () => {
        expect(baseValidators.number()(1)).toBe(true);
      });

      it("should allow 0", () => {
        expect(baseValidators.number()(0)).toBe(true);
      });

      it("should allow decimals", () => {
        expect(baseValidators.number()(123.4567)).toBe(true);
      });

      it("should allow exponential number notation", () => {
        expect(baseValidators.number()(1e3)).toBe(true);
      });

      it("should not allow numbers provided as strings", () => {
        expect(baseValidators.number()("123.456789")).toBe(false);
      });

      it("should not allow numbers provided as strings that end with text", () => {
        expect(baseValidators.number()("123.456789aba")).toBe(false);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.number()([])).toBe(false);
      });

      it("should not allow NaN", () => {
        expect(baseValidators.number()(NaN)).toBe(false);
      });

      it("should not allow Infinity", () => {
        expect(baseValidators.number()(Infinity)).toBe(false);
      });

      it("should not allow -Infinity", () => {
        expect(baseValidators.number()(-Infinity)).toBe(false);
      });

      it("should not allow a boolean", () => {
        expect(baseValidators.number()(false)).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.number()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.number()(null)).toBe(false);
      });

      it("should not allow a string", () => {
        expect(baseValidators.number()("abc")).toBe(false);
      });
    });

    describe("string", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.string()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.string()(null)).toBe(false);
      });

      it("should allow empty string", () => {
        expect(baseValidators.string()("")).toBe(true);
      });

      it("should allow a random string", () => {
        expect(baseValidators.string()("_# !@#$^&%^$%^ ajd")).toBe(true);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.string()([])).toBe(false);
      });

      it("should not allow a boolean", () => {
        expect(baseValidators.string()(true)).toBe(false);
      });

      it("should not allow a number", () => {
        expect(baseValidators.string()(345345)).toBe(false);
      });
    });

    describe("array", () => {
      it("should not allow empty objects", () => {
        expect(baseValidators.array()({})).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.array()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.array()(null)).toBe(false);
      });

      it("should not allow strings", () => {
        expect(baseValidators.array()("")).toBe(false);
      });

      it("should not allow strings that look like arrays", () => {
        expect(baseValidators.array()("[]")).toBe(false);
      });

      it("should not allow booleans", () => {
        expect(baseValidators.array()(false)).toBe(false);
      });

      it("should not allow numbers", () => {
        expect(baseValidators.array()(1)).toBe(false);
      });

      it("should allow arrays", () => {
        expect(baseValidators.array()([])).toBe(true);
      });
    });

    describe("object", () => {
      it("should allow empty objects", () => {
        expect(baseValidators.object()({})).toBe(true);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.object()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.object()(null)).toBe(false);
      });

      it("should not allow strings", () => {
        expect(baseValidators.object()("")).toBe(false);
      });

      it("should not allow strings that look like objects", () => {
        expect(baseValidators.object()("{}")).toBe(false);
      });

      it("should not allow booleans", () => {
        expect(baseValidators.object()(false)).toBe(false);
      });

      it("should not allow numbers", () => {
        expect(baseValidators.object()(1)).toBe(false);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.object()([])).toBe(false);
      });
    });

    describe("any", () => {
      it("should allow any value", () => {
        expect(baseValidators.any()(undefined)).toBe(true);
        expect(baseValidators.any()(null)).toBe(true);
        expect(baseValidators.any()(123)).toBe(true);
        expect(baseValidators.any()({})).toBe(true);
        expect(baseValidators.any()([])).toBe(true);
        expect(baseValidators.any()("")).toBe(true);
        expect(baseValidators.any()(/aregex/)).toBe(true);
      });
    });
  });

  describe("custom type validators", () => {
    describe("numeric", () => {
      it("should allow negative numbers", () => {
        expect(baseValidators.numeric()(-1)).toBe(true);
      });

      it("should allow positive numbers", () => {
        expect(baseValidators.numeric()(1)).toBe(true);
      });

      it("should allow 0", () => {
        expect(baseValidators.numeric()(0)).toBe(true);
      });

      it("should allow decimals", () => {
        expect(baseValidators.numeric()(123.4567)).toBe(true);
      });

      it("should allow exponential number notation", () => {
        expect(baseValidators.numeric()(1e3)).toBe(true);
      });

      it("should allow numbers provided as strings", () => {
        expect(baseValidators.numeric()("123.456789")).toBe(true);
      });

      it("show allow negative numbers provided as string", () => {
        expect(baseValidators.numeric()("-1")).toBe(true);
      });

      it("should allow numbers in exponential notation provided as strings", () => {
        expect(baseValidators.numeric()("5.56789e+0")).toBe(true);
      });

      it("should allow negative numbers in exponential notation provided as strings", () => {
        expect(baseValidators.numeric()("-5.56789e+0")).toBe(true);
      });

      it("should allow trailing decimal points", () => {
        expect(baseValidators.numeric()("123.")).toBe(true);
      });

      it("should allow leading decimal points", () => {
        expect(baseValidators.numeric()(".123")).toBe(true);
      });

      it("should not allow two decimal points", () => {
        expect(baseValidators.numeric()(".123.")).toBe(false);
      });

      it("should not allow two trailing decimal points", () => {
        expect(baseValidators.numeric()("123..")).toBe(false);
      });

      it("should not allow two leading decimal points", () => {
        expect(baseValidators.numeric()("..123")).toBe(false);
      });

      it("should not allow numbers provided as strings that end with text", () => {
        expect(baseValidators.numeric()("123.456789aba")).toBe(false);
      });

      it("should not allow numbers provided as strings that begin with text", () => {
        expect(baseValidators.numeric()("aba123.456789")).toBe(false);
      });

      it("should not allow numbers in exponential notation provided as strings that end with text", () => {
        expect(baseValidators.numeric()("5.56789e+0ee")).toBe(false);
      });

      it("should not allow numbers in exponential notation provided as strings that begin with text", () => {
        expect(baseValidators.numeric()("ee5.56789e+0")).toBe(false);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.numeric()([])).toBe(false);
      });

      it("should not allow single-element arrays that coerce to a number", () => {
        expect(baseValidators.numeric()([5])).toBe(false);
      });

      it("should not allow objects", () => {
        expect(baseValidators.numeric()({})).toBe(false);
      });

      it("should not allow an empty string", () => {
        expect(baseValidators.numeric()("")).toBe(false);
      });

      it("should not allow a whitespace only string", () => {
        expect(baseValidators.numeric()("   ")).toBe(false);
      });

      it("should not allow NaN", () => {
        expect(baseValidators.numeric()(NaN)).toBe(false);
      });

      it("should not allow Infinity", () => {
        expect(baseValidators.numeric()(Infinity)).toBe(false);
      });

      it("should not allow -Infinity", () => {
        expect(baseValidators.numeric()(-Infinity)).toBe(false);
      });

      it("should not allow a boolean", () => {
        expect(baseValidators.numeric()(false)).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.numeric()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.numeric()(null)).toBe(false);
      });

      it("should not allow a string", () => {
        expect(baseValidators.numeric()("abc")).toBe(false);
      });
    });

    describe("integer", () => {
      it("should allow integers", () => {
        expect(baseValidators.integer()(1)).toBe(true);
      });

      it("should allow zero", () => {
        expect(baseValidators.integer()(0)).toBe(true);
      });

      it("should not allow decimals", () => {
        expect(baseValidators.integer()(1.3)).toBe(false);
      });

      it("should not allow exponential number notation if it is not an integer", () => {
        expect(baseValidators.integer()((0.07).toExponential())).toBe(false);
      });

      it("should allow exponential number notation if it is an integer", () => {
        expect(baseValidators.integer()(1e3)).toBe(true);
      });
    });

    describe("color", () => {
      it("should not allow a boolean", () => {
        expect(baseValidators.color()(false)).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.color()(undefined)).toBe(false);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.color()([])).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.color()(null)).toBe(false);
      });

      it("should not allow a random string", () => {
        expect(baseValidators.color()("0a")).toBe(false);
      });

      it("should not allow a number", () => {
        expect(baseValidators.color()(345345)).toBe(false);
      });

      it("should allow 3 digit hex strings", () => {
        expect(baseValidators.color()("#123")).toBe(true);
      });

      it("should allow 6 digit hex strings", () => {
        expect(baseValidators.color()("#123456")).toBe(true);
      });

      it("should not allow 5 digit hex strings", () => {
        expect(baseValidators.color()("#12345")).toBe(false);
      });

      it("should not allow 7 digit hex strings", () => {
        expect(baseValidators.color()("#1234567")).toBe(false);
      });

      it("should not allow 2 digit hex strings", () => {
        expect(baseValidators.color()("#12")).toBe(false);
      });

      it("should not allow 0 digit hex strings", () => {
        expect(baseValidators.color()("#")).toBe(false);
      });

      it("should not allow a number", () => {
        expect(baseValidators.color()(345345)).toBe(false);
      });

      it("should allow rgb notation strings", () => {
        expect(baseValidators.color()("rgb(123,123,123)")).toBe(true);
      });

      it("should not allow rgb notation strings when a color value is greater than 255", () => {
        expect(baseValidators.color()("rgb(123,256,123)")).toBe(false);
      });

      it("should not allow rgb notation strings when a color value is less than 0", () => {
        expect(baseValidators.color()("rgb(123,-123,123)")).toBe(false);
      });

      it("should not allow rgb notation strings when a color value is not numeric", () => {
        expect(baseValidators.color()("rgb(a123,123,123)")).toBe(false);
      });

      it("should allow rgba notation strings", () => {
        expect(baseValidators.color()("rgba(123,123,123, 1)")).toBe(true);
      });

      // Regression: the alpha regex required a leading digit, rejecting ".5"
      it("should allow rgba notation strings with a leading-zero-less alpha", () => {
        expect(baseValidators.color()("rgba(0, 0, 0, .5)")).toBe(true);
        expect(baseValidators.color()("rgba(123,123,123,0.5)")).toBe(true);
      });

      it("should not allow rgba notation strings with a bare-dot or trailing-dot alpha", () => {
        expect(baseValidators.color()("rgba(123,123,123,.)")).toBe(false);
        expect(baseValidators.color()("rgba(123,123,123,1.)")).toBe(false);
      });

      it("should not allow rgba notation strings when the alpha value is greater than 1", () => {
        expect(baseValidators.color()("rgba(123,256,123,1.1)")).toBe(false);
      });

      it("should not allow rgba notation strings when the alpha value is less than 0", () => {
        expect(baseValidators.color()("rgba(123,123,123,-1)")).toBe(false);
      });

      it("should not allow rgba notation strings when the alpha value is not numeric", () => {
        expect(baseValidators.color()("rgba(123,123,123,a)")).toBe(false);
      });
    });

    describe("dateISO", () => {
      it("should not allow a boolean", () => {
        expect(baseValidators.dateISO()(false)).toBe(false);
      });

      // Regression: the regex was tested against the stringified value, so a number or a one-element
      // array that read as an iso date passed, and an unstringifiable object threw
      it("should only match strings, and never coerce or throw", () => {
        expect(baseValidators.dateISO()(2016)).toBe(false);
        expect(baseValidators.dateISO()(["2016-09-01"])).toBe(false);
        expect(baseValidators.dateISO()(Object.create(null))).toBe(false);
        expect(baseValidators.dateISO()(Symbol())).toBe(false);
        expect(baseValidators.dateISO()("2016-09-01")).toBe(true);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.dateISO()(undefined)).toBe(false);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.dateISO()([])).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.dateISO()(null)).toBe(false);
      });

      it("should not allow a random string", () => {
        expect(baseValidators.dateISO()("0a")).toBe(false);
      });

      it("should not allow a number", () => {
        expect(baseValidators.dateISO()(345345)).toBe(false);
      });

      it("should not allow a number", () => {
        expect(baseValidators.dateISO()(345345)).toBe(false);
      });

      it("should not allow a date string when the month is 13", () => {
        expect(baseValidators.dateISO()("2015-13-05T12:35:45Z")).toBe(false);
      });

      it("should not allow a date string with slashes instead of dashes", () => {
        expect(baseValidators.dateISO()("2016/09/01T00:00:00Z")).toBe(false);
      });

      it("should allow a date string with only the year", () => {
        expect(baseValidators.dateISO()("2016")).toBe(true);
      });

      it("should allow a date string with only the date", () => {
        expect(baseValidators.dateISO()("2016-09-01")).toBe(true);
      });

      it("should allow a date string with only the date and time", () => {
        expect(baseValidators.dateISO()("2016-09-01T00:00")).toBe(true);
      });

      it("should allow a full date string", () => {
        expect(baseValidators.dateISO()("2016-09-01T00:00:00Z")).toBe(true);
      });

      it("should not allow ISO week or ordinal date strings, which Date cannot parse", () => {
        expect(baseValidators.dateISO()("2024-W05")).toBe(false);
        expect(baseValidators.dateISO()("2024-W05-3")).toBe(false);
        expect(baseValidators.dateISO()("2024-045")).toBe(false);
        expect(baseValidators.datePrimitive()("2024-W05")).toBe(false);
        expect(baseValidators.dateAny()("2024-W05")).toBe(false);
      });
    });

    describe("dateInstance", () => {
      it("should allow a Date instance", () => {
        expect(baseValidators.dateInstance()(new Date("2016-09-01T00:00:00Z"))).toBe(true);
      });

      it("should not allow an invalid Date instance", () => {
        expect(baseValidators.dateInstance()(new Date(NaN))).toBe(false);
      });

      it("should allow a pre-1970 Date instance", () => {
        expect(baseValidators.dateInstance()(new Date(-86400000))).toBe(true);
      });

      it("should not allow an epoch number", () => {
        expect(baseValidators.dateInstance()(123)).toBe(false);
      });

      it("should not allow an iso date string", () => {
        expect(baseValidators.dateInstance()("2016-09-01T00:00:00Z")).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.dateInstance()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.dateInstance()(null)).toBe(false);
      });
    });

    describe("datePrimitive", () => {
      it("should allow a number", () => {
        expect(baseValidators.datePrimitive()(123)).toBe(true);
      });

      it("should not coerce arrays or throw on unstringifiable objects", () => {
        expect(baseValidators.datePrimitive()(["2016-09-01"])).toBe(false);
        expect(baseValidators.datePrimitive()(Object.create(null))).toBe(false);
      });

      it("should allow a negative epoch number", () => {
        expect(baseValidators.datePrimitive()(-86400000)).toBe(true);
      });

      it("should allow a full date string", () => {
        expect(baseValidators.datePrimitive()("2016-09-01T00:00:00Z")).toBe(true);
      });

      it("should not allow a Date instance", () => {
        expect(baseValidators.datePrimitive()(new Date(0))).toBe(false);
      });

      it("should not allow a non-iso date string", () => {
        expect(baseValidators.datePrimitive()("1234567")).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.datePrimitive()(undefined)).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.datePrimitive()(null)).toBe(false);
      });
    });

    describe("dateAny", () => {
      it("should not allow a boolean", () => {
        expect(baseValidators.dateAny()(false)).toBe(false);
      });

      it("should not coerce arrays or throw on unstringifiable objects", () => {
        expect(baseValidators.dateAny()(["2016-09-01"])).toBe(false);
        expect(baseValidators.dateAny()(Object.create(null))).toBe(false);
      });

      it("should not allow undefined", () => {
        expect(baseValidators.dateAny()(undefined)).toBe(false);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.dateAny()([])).toBe(false);
      });

      it("should not allow null", () => {
        expect(baseValidators.dateAny()(null)).toBe(false);
      });

      it("should allow a number", () => {
        expect(baseValidators.dateAny()(123)).toBe(true);
      });

      it("should allow a negative epoch number", () => {
        expect(baseValidators.dateAny()(-86400000)).toBe(true);
      });

      it("should allow epoch zero", () => {
        expect(baseValidators.dateAny()(0)).toBe(true);
      });

      it("should not allow a non-finite number", () => {
        expect(baseValidators.dateAny()(Infinity)).toBe(false);
        expect(baseValidators.dateAny()(NaN)).toBe(false);
      });

      it("should allow a Date instance", () => {
        expect(baseValidators.dateAny()(new Date("2016-09-01T00:00:00Z"))).toBe(true);
      });

      it("should not allow an invalid Date instance", () => {
        expect(baseValidators.dateAny()(new Date(NaN))).toBe(false);
      });

      it("should allow a full date string", () => {
        expect(baseValidators.dateAny()("2016-09-01T00:00:00Z")).toBe(true);
      });

      it("should not allow a date string with slashes instead of dashes", () => {
        expect(baseValidators.dateAny()("2016/09/01T00:00:00Z")).toBe(false);
      });
    });
  });

  describe("argument type validators", () => {
    describe("instance of", () => {
      it("should allow values that are an instance of the specified type", () => {
        class AClass {}
        expect(baseValidators.instanceOf(AClass)(new AClass())).toBe(true);
      });

      it("should not allow values that are not an instance of the specified type", () => {
        class AClass {}
        class BClass {}
        expect(baseValidators.instanceOf(AClass)(new BClass())).toBe(false);
      });

      it("should name the class in its error message", () => {
        class AClass {}
        expect(baseValidators.instanceOf(AClass).errorMessage).toBe("should be an instanceof AClass");
      });

      it("should name a built in constructor in its error message", () => {
        expect(baseValidators.instanceOf(Date).errorMessage).toBe("should be an instanceof Date");
      });

      it("should fall back to a generic name for an anonymous class", () => {
        const anonymousClass = (() => class {})();
        expect(baseValidators.instanceOf(anonymousClass).errorMessage).toBe("should be an instanceof the given class");
      });
    });

    describe("type of", () => {
      it("should allow values whose type is the specified type", () => {
        expect(baseValidators.typeOf("object")({})).toBe(true);
      });

      it("should not allow values whose type is not the specified type", () => {
        expect(baseValidators.typeOf("object")(123)).toBe(false);
      });
    });

    describe("custom validator", () => {
      it("should allow values for which the custom validator function returns true", () => {
        expect(baseValidators.custom(v => v === 123)(123)).toBe(true);
      });

      it("should not allow values for which the custom validator function returns false", () => {
        expect(baseValidators.custom(v => v === 123)(124)).toBe(false);
      });
    });

    describe("number min", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.numberMin(0)(undefined)).toBe(false);
      });

      it("should not allow numbers less than the argument", () => {
        expect(baseValidators.numberMin(0)(-2)).toBe(false);
      });

      it("should allow numbers greater than the argument", () => {
        expect(baseValidators.numberMin(4)(5)).toBe(true);
      });

      it("should allow numbers equal to the argument", () => {
        expect(baseValidators.numberMin(4)(4)).toBe(true);
      });
    });

    describe("number max", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.numberMax(0)(undefined)).toBe(false);
      });

      it("should not allow numbers greater than the argument", () => {
        expect(baseValidators.numberMax(0)(2)).toBe(false);
      });

      it("should allow numbers less than the argument", () => {
        expect(baseValidators.numberMax(4)(3)).toBe(true);
      });

      it("should allow numbers equal to the argument", () => {
        expect(baseValidators.numberMax(4)(4)).toBe(true);
      });
    });

    describe("number min max", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.numberMinMax(0, 0)(undefined)).toBe(false);
      });

      it("should not allow numbers greater than the max argument", () => {
        expect(baseValidators.numberMinMax(0, 1)(2)).toBe(false);
      });

      it("should not allow numbers less than the min argument", () => {
        expect(baseValidators.numberMinMax(0, 1)(-1)).toBe(false);
      });

      it("should allow numbers between the min and maxargument", () => {
        expect(baseValidators.numberMinMax(3, 4)(3.5)).toBe(true);
      });

      it("should allow numbers equal to the min argument", () => {
        expect(baseValidators.numberMinMax(0, 4)(0)).toBe(true);
      });

      it("should allow numbers equal to the max argument", () => {
        expect(baseValidators.numberMinMax(0, 4)(4)).toBe(true);
      });

      it("should allow numbers equal to both arguments", () => {
        expect(baseValidators.numberMinMax(2, 2)(2)).toBe(true);
      });
    });

    describe("numeric min", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.numericMin(0)(undefined)).toBe(false);
      });

      it("should not allow numbers less than the argument", () => {
        expect(baseValidators.numericMin(0)("-2")).toBe(false);
      });

      it("should allow numbers greater than the argument", () => {
        expect(baseValidators.numericMin(4)("5")).toBe(true);
      });

      it("should allow numbers equal to the argument", () => {
        expect(baseValidators.numericMin(4)("4")).toBe(true);
      });

      it("should not allow single-element arrays that coerce to a number", () => {
        expect(baseValidators.numericMin(0)([5])).toBe(false);
      });
    });

    describe("numeric max", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.numericMax(0)(undefined)).toBe(false);
      });

      it("should not allow numbers greater than the argument", () => {
        expect(baseValidators.numericMax(0)("2")).toBe(false);
      });

      it("should allow numbers less than the argument", () => {
        expect(baseValidators.numericMax(4)("3")).toBe(true);
      });

      it("should allow numbers equal to the argument", () => {
        expect(baseValidators.numericMax(4)("4")).toBe(true);
      });

      it("should not allow single-element arrays that coerce to a number", () => {
        expect(baseValidators.numericMax(100)([5])).toBe(false);
      });
    });

    describe("numeric min max", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.numericMinMax(0, 0)(undefined)).toBe(false);
      });

      it("should not allow numbers greater than the max argument", () => {
        expect(baseValidators.numericMinMax(0, 1)("2")).toBe(false);
      });

      it("should not allow numbers less than the min argument", () => {
        expect(baseValidators.numericMinMax(0, 1)("-1")).toBe(false);
      });

      it("should allow numbers between the min and maxargument", () => {
        expect(baseValidators.numericMinMax(3, 4)("3.5")).toBe(true);
      });

      it("should allow numbers equal to the min argument", () => {
        expect(baseValidators.numericMinMax(0, 4)("0")).toBe(true);
      });

      it("should allow numbers equal to the max argument", () => {
        expect(baseValidators.numericMinMax(0, 4)("4")).toBe(true);
      });

      it("should allow numbers equal to both arguments", () => {
        expect(baseValidators.numericMinMax(2, 2)("2")).toBe(true);
      });

      it("should not allow single-element arrays that coerce to a number", () => {
        expect(baseValidators.numericMinMax(0, 100)([5])).toBe(false);
      });
    });

    describe("integer min", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.integerMin(0)(undefined)).toBe(false);
      });

      it("should not allow decimals", () => {
        expect(baseValidators.integerMin(0)(1.2)).toBe(false);
      });

      it("should not allow numbers less than the argument", () => {
        expect(baseValidators.integerMin(0)(-2)).toBe(false);
      });

      it("should allow numbers greater than the argument", () => {
        expect(baseValidators.integerMin(4)(5)).toBe(true);
      });

      it("should allow numbers equal to the argument", () => {
        expect(baseValidators.integerMin(4)(4)).toBe(true);
      });
    });

    describe("integer max", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.integerMax(0)(undefined)).toBe(false);
      });

      it("should not allow decimals", () => {
        expect(baseValidators.integerMax(2)(1.2)).toBe(false);
      });

      it("should not allow numbers greater than the argument", () => {
        expect(baseValidators.integerMax(0)(2)).toBe(false);
      });

      it("should allow numbers less than the argument", () => {
        expect(baseValidators.integerMax(4)(3)).toBe(true);
      });

      it("should allow numbers equal to the argument", () => {
        expect(baseValidators.integerMax(4)(4)).toBe(true);
      });
    });

    describe("integer min max", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.integerMinMax(0, 0)(undefined)).toBe(false);
      });

      it("should not allow decimals", () => {
        expect(baseValidators.integerMinMax(0, 2)(1.2)).toBe(false);
      });

      it("should not allow numbers greater than the max argument", () => {
        expect(baseValidators.integerMinMax(0, 1)(2)).toBe(false);
      });

      it("should not allow numbers less than the min argument", () => {
        expect(baseValidators.integerMinMax(0, 1)(-1)).toBe(false);
      });

      it("should allow numbers between the min and maxargument", () => {
        expect(baseValidators.integerMinMax(2, 4)(3)).toBe(true);
      });

      it("should allow numbers equal to the min argument", () => {
        expect(baseValidators.integerMinMax(0, 4)(0)).toBe(true);
      });

      it("should allow numbers equal to the max argument", () => {
        expect(baseValidators.integerMinMax(0, 4)(4)).toBe(true);
      });

      it("should allow numbers equal to both arguments", () => {
        expect(baseValidators.integerMinMax(2, 2)(2)).toBe(true);
      });
    });

    describe("regexp", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.regexp(/[.]/)(undefined)).toBe(false);
      });

      // Regression: RegExp.test stringified the value, so "undefined"/"null" matched and an
      // unstringifiable object threw
      it("should never match the stringified form of a non-string, non-number value", () => {
        expect(baseValidators.regexp(/^[a-z]+$/)(undefined)).toBe(false);
        expect(baseValidators.regexp(/^[a-z]+$/)(null)).toBe(false);
        expect(baseValidators.regexp(/^\d+$/)(Object.create(null))).toBe(false);
        expect(baseValidators.regexp(/^\d+$/)(true)).toBe(false);
      });

      it("show allow numbers", () => {
        expect(baseValidators.regexp(/[0-9]+/)(92234)).toBe(true);
      });

      it("should allow empty strings if the regex allow it", () => {
        expect(baseValidators.regexp(/[.]*/)("")).toBe(true);
      });

      it("should allow strings that match the regex", () => {
        expect(baseValidators.regexp(/[abc]+/)("ababacca")).toBe(true);
      });

      it("should not allow strings that do not match the regex", () => {
        expect(baseValidators.regexp(/^[abc]+$/)("ababadcca")).toBe(false);
      });

      it("should return the same result for repeated calls with a global regex", () => {
        const validator = baseValidators.regexp(/a/g);
        expect([validator("a"), validator("a"), validator("a")]).toEqual([true, true, true]);
      });

      it("should return the same result for repeated calls with a sticky regex", () => {
        const validator = baseValidators.regexp(/a/y);
        expect([validator("ab"), validator("ab"), validator("ab")]).toEqual([true, true, true]);
      });

      it("should keep sticky matching anchored at the start of the value", () => {
        expect(baseValidators.regexp(/a/y)("ba")).toBe(false);
      });

      it("should not modify the lastIndex of the regex it was given", () => {
        const regex = /a/g;
        baseValidators.regexp(regex)("a");
        expect(regex.lastIndex).toBe(0);
      });

      it("should ignore a lastIndex already set on the regex it was given", () => {
        const regex = /a/g;
        regex.lastIndex = 5;
        expect(baseValidators.regexp(regex)("a")).toBe(true);
      });
    });

    describe("stringRegexp", () => {
      it("should not allow undefined", () => {
        expect(baseValidators.stringRegexp(/[.]/)(undefined)).toBe(false);
      });

      it("should never match the stringified form of a non-string value", () => {
        expect(baseValidators.stringRegexp(/^[a-z]+$/)(null)).toBe(false);
        expect(baseValidators.stringRegexp(/^\d+$/)(Object.create(null))).toBe(false);
        expect(baseValidators.stringRegexp(/^\d+$/)(true)).toBe(false);
      });

      it("should not allow numbers", () => {
        expect(baseValidators.stringRegexp(/[0-9]+/)(92234)).toBe(false);
        expect(baseValidators.regexp(/[0-9]+/)(92234)).toBe(true);
      });

      it("should allow empty strings if the regex allows it", () => {
        expect(baseValidators.stringRegexp(/[.]*/)("")).toBe(true);
      });

      it("should allow strings that match the regex", () => {
        expect(baseValidators.stringRegexp(/[abc]+/)("ababacca")).toBe(true);
      });

      it("should not allow strings that do not match the regex", () => {
        expect(baseValidators.stringRegexp(/^[abc]+$/)("ababadcca")).toBe(false);
      });

      it("should return the same result for repeated calls with a global regex", () => {
        const validator = baseValidators.stringRegexp(/a/g);
        expect([validator("a"), validator("a"), validator("a")]).toEqual([true, true, true]);
      });

      it("should not modify the lastIndex of the regex it was given", () => {
        const regex = /a/g;
        baseValidators.stringRegexp(regex)("a");
        expect(regex.lastIndex).toBe(0);
      });
    });

    describe("string with length", () => {
      it("should not allow values that are not a string", () => {
        expect(baseValidators.stringWithLength(0)(null)).toBe(false);
      });

      it("should not allow values that are a string with invalid length", () => {
        expect(baseValidators.stringWithLength(1)("")).toBe(false);
      });

      it("should allow values that are a string with the specified length", () => {
        expect(baseValidators.stringWithLength(1)("a")).toBe(true);
      });
    });

    describe("string with length min", () => {
      it("should not allow values that are not a string", () => {
        expect(baseValidators.stringWithLengthMin(0)(null)).toBe(false);
      });

      it("should not allow values that are a string with invalid length", () => {
        expect(baseValidators.stringWithLengthMin(1)("")).toBe(false);
      });

      it("should allow values that are a string with the specified length", () => {
        expect(baseValidators.stringWithLengthMin(0)("")).toBe(true);
      });

      it("should allow values that are a string with length greater than the specified length", () => {
        expect(baseValidators.stringWithLengthMin(1)("ab")).toBe(true);
      });
    });

    describe("string with length max", () => {
      it("should not allow values that are not a string", () => {
        expect(baseValidators.stringWithLengthMax(0)(null)).toBe(false);
      });

      it("should not allow values that are a string with invalid length", () => {
        expect(baseValidators.stringWithLengthMax(1)("ab")).toBe(false);
      });

      it("should allow values that are a string with the specified length", () => {
        expect(baseValidators.stringWithLengthMax(0)("")).toBe(true);
      });

      it("should allow values that are a string with length less than the specified length", () => {
        expect(baseValidators.stringWithLengthMax(3)("ab")).toBe(true);
      });
    });

    describe("string with length min max", () => {
      it("should not allow values that are not a string", () => {
        expect(baseValidators.stringWithLengthMinMax(0, 1)(null)).toBe(false);
      });

      it("should not allow values that are a string with length greater than max", () => {
        expect(baseValidators.stringWithLengthMinMax(0, 1)("ab")).toBe(false);
      });

      it("should not allow values that are a string with length less than min", () => {
        expect(baseValidators.stringWithLengthMinMax(3, 5)("ab")).toBe(false);
      });

      it("should allow values that are a string with the max length", () => {
        expect(baseValidators.stringWithLengthMinMax(0, 2)("ab")).toBe(true);
      });

      it("should allow values that are a string with the min length", () => {
        expect(baseValidators.stringWithLengthMinMax(0, 2)("")).toBe(true);
      });

      it("should allow values that are an array with length between the specified min and max", () => {
        expect(baseValidators.stringWithLengthMinMax(1, 3)("ab")).toBe(true);
      });
    });

    describe("equal", () => {
      it("should allow values that are equal to the argument", () => {
        expect(baseValidators.equal(undefined)(undefined)).toBe(true);
      });

      it("should not allow values that are not equal to the argument", () => {
        expect(baseValidators.equal(undefined)(1)).toBe(false);
      });

      // strict === never matches NaN, so an equal(NaN) used to reject every value
      it("should treat NaN as equal to NaN", () => {
        expect(baseValidators.equal(NaN)(NaN)).toBe(true);
        expect(baseValidators.equal(NaN)(1)).toBe(false);
        expect(baseValidators.equal(1)(NaN)).toBe(false);
      });

      it("should keep 0 equal to -0", () => {
        expect(baseValidators.equal(0)(-0)).toBe(true);
      });

      it("should print NaN and the infinities by name in its error message", () => {
        expect(baseValidators.equal(NaN).errorMessage).toBe("should be equal to NaN");
        expect(baseValidators.equal(Infinity).errorMessage).toBe("should be equal to Infinity");
        expect(baseValidators.equal(-Infinity).errorMessage).toBe("should be equal to -Infinity");
      });

      it("should name a function argument in its error message", () => {
        const namedFunction = () => true;
        expect(baseValidators.equal(namedFunction).errorMessage).toBe("should be equal to function namedFunction");
      });

      it("should describe an anonymous function argument in its error message", () => {
        const anonymousFunction = (() => function () {})();
        expect(baseValidators.equal(anonymousFunction).errorMessage).toBe("should be equal to an anonymous function");
      });

      it("should print a symbol argument in its error message", () => {
        expect(baseValidators.equal(Symbol("aSymbol")).errorMessage).toBe("should be equal to Symbol(aSymbol)");
      });

      it("should print a bigint argument in its error message", () => {
        expect(baseValidators.equal(BigInt(1)).errorMessage).toBe("should be equal to 1n");
      });

      it("should print function and symbol members of an object argument", () => {
        const object = { fn: function aFunction() {}, sym: Symbol("aSymbol") };
        expect(baseValidators.equal(object).errorMessage).toBe(
          "should be equal to { fn: function aFunction, sym: Symbol(aSymbol) }"
        );
      });
    });

    describe("one of", () => {
      it("should allow values that are equal to one of the array of arguments", () => {
        expect(baseValidators.oneOf([undefined, 1, null])(1)).toBe(true);
      });

      it("should allow values that are equal to the first value in the array of arguments", () => {
        expect(baseValidators.oneOf([undefined, 1, null])(undefined)).toBe(true);
      });

      it("should allow values that are equal to the last value in the array of arguments", () => {
        expect(baseValidators.oneOf([undefined, 1, null])(null)).toBe(true);
      });

      it("should not allow values that are not equal to one of the array of arguments", () => {
        expect(baseValidators.oneOf([undefined, 1, null])(2)).toBe(false);
      });

      it("should not allow values that are not equal to the first value in the array of arguments", () => {
        expect(baseValidators.oneOf([1, undefined, null])(2)).toBe(false);
      });

      it("should not allow values that are not equal to the last value in the array of arguments", () => {
        expect(baseValidators.oneOf([undefined, null, 1])(2)).toBe(false);
      });

      it("should match a NaN member", () => {
        expect(baseValidators.oneOf([undefined, null, NaN])(NaN)).toBe(true);
        expect(baseValidators.oneOf([undefined, null, 1])(NaN)).toBe(false);
      });

      it("should print a NaN member by name in its error message", () => {
        expect(baseValidators.oneOf([null, NaN]).errorMessage).toBe("should be one of [ null, NaN ]");
      });
    });

    describe("one in", () => {
      it("should allow values that are equal to one of the map of arguments", () => {
        expect(baseValidators.oneIn({ a: true, b: 2 })("a")).toBe(true);
      });

      it("should allow values that are numbers whose string value is equal to one of the map of arguments", () => {
        expect(baseValidators.oneIn({ "1": true, b: 2 })(1)).toBe(true);
      });

      it("should not allow values that are not equal to one of the map of arguments", () => {
        expect(baseValidators.oneIn({ a: true, b: 2 })(4)).toBe(false);
      });

      it("should not allow Object.prototype member names absent from the map", () => {
        expect(baseValidators.oneIn({ a: true, b: 2 })("constructor")).toBe(false);
        expect(baseValidators.oneIn({ a: true, b: 2 })("toString")).toBe(false);
      });

      // Regression: allowedValues listed keys with undefined values that the predicate rejects
      it("should publish only the keys with defined values as allowedValues", () => {
        const validator = baseValidators.oneIn({ a: undefined, b: 1 });
        expect(validator("a")).toBe(false);
        expect(validator.allowedValues).toEqual(["b"]);
      });
    });

    describe("not equal", () => {
      it("should allow values that are not equal to the argument", () => {
        expect(baseValidators.notEqual(undefined)(1)).toBe(true);
      });

      it("should not allow values that are equal to the argument", () => {
        expect(baseValidators.notEqual(undefined)(undefined)).toBe(false);
      });

      it("should treat NaN as equal to NaN", () => {
        expect(baseValidators.notEqual(NaN)(NaN)).toBe(false);
        expect(baseValidators.notEqual(NaN)(1)).toBe(true);
      });
    });

    describe("not one of", () => {
      it("should not allow values that are equal to one of the array of arguments", () => {
        expect(baseValidators.notOneOf([undefined, 1, null])(1)).toBe(false);
      });

      it("should not allow values that are equal to the first value in the array of arguments", () => {
        expect(baseValidators.notOneOf([undefined, 1, null])(undefined)).toBe(false);
      });

      it("should not allow values that are equal to the last value in the array of arguments", () => {
        expect(baseValidators.notOneOf([undefined, 1, null])(null)).toBe(false);
      });

      it("should allow values that are not equal to one of the array of arguments", () => {
        expect(baseValidators.notOneOf([undefined, 1, null])(2)).toBe(true);
      });

      it("should allow values that are not equal to the first value in the array of arguments", () => {
        expect(baseValidators.notOneOf([1, undefined, null])(2)).toBe(true);
      });

      it("should allow values that are not equal to the last value in the array of arguments", () => {
        expect(baseValidators.notOneOf([undefined, null, 1])(2)).toBe(true);
      });

      it("should match a NaN member", () => {
        expect(baseValidators.notOneOf([undefined, null, NaN])(NaN)).toBe(false);
        expect(baseValidators.notOneOf([undefined, null, 1])(NaN)).toBe(true);
      });
    });

    describe("not one in", () => {
      it("should not allow values that are equal to one of the map of arguments", () => {
        expect(baseValidators.notOneIn({ a: true, b: 2 })("a")).toBe(false);
      });

      it("should not allow values that are numbers whose string value is equal to one of the map of arguments", () => {
        expect(baseValidators.notOneIn({ "1": true, b: 2 })(1)).toBe(false);
      });

      it("should allow values that are not equal to one of the map of arguments", () => {
        expect(baseValidators.notOneIn({ a: true, b: 2 })(4)).toBe(true);
      });

      it("should allow Object.prototype member names absent from the map", () => {
        expect(baseValidators.notOneIn({ a: true, b: 2 })("constructor")).toBe(true);
      });
    });

    describe("array with length", () => {
      it("should not allow values that are not an array", () => {
        expect(baseValidators.arrayWithLength(0)(null)).toBe(false);
      });

      it("should not allow values that are an array with invalid length", () => {
        expect(baseValidators.arrayWithLength(1)([])).toBe(false);
      });

      it("should allow values that are an array with the specified length", () => {
        expect(baseValidators.arrayWithLength(0)([])).toBe(true);
      });
    });

    describe("array with length min", () => {
      it("should not allow values that are not an array", () => {
        expect(baseValidators.arrayWithLengthMin(0)(null)).toBe(false);
      });

      it("should not allow values that are an array with invalid length", () => {
        expect(baseValidators.arrayWithLengthMin(1)([])).toBe(false);
      });

      it("should allow values that are an array with the specified length", () => {
        expect(baseValidators.arrayWithLengthMin(0)([])).toBe(true);
      });

      it("should allow values that are an array with length greater than the specified length", () => {
        expect(baseValidators.arrayWithLengthMin(1)([1, 2])).toBe(true);
      });
    });

    describe("array with length max", () => {
      it("should not allow values that are not an array", () => {
        expect(baseValidators.arrayWithLengthMax(0)(null)).toBe(false);
      });

      it("should not allow values that are an array with invalid length", () => {
        expect(baseValidators.arrayWithLengthMax(1)(["a", "b"])).toBe(false);
      });

      it("should allow values that are an array with the specified length", () => {
        expect(baseValidators.arrayWithLengthMax(0)([])).toBe(true);
      });

      it("should allow values that are an array with length less than the specified length", () => {
        expect(baseValidators.arrayWithLengthMax(3)(["a", "b"])).toBe(true);
      });
    });

    describe("array with length min max", () => {
      it("should not allow values that are not an array", () => {
        expect(baseValidators.arrayWithLengthMinMax(0, 1)(null)).toBe(false);
      });

      it("should not allow values that are an array with length greater than max", () => {
        expect(baseValidators.arrayWithLengthMinMax(0, 1)(["a", "b"])).toBe(false);
      });

      it("should not allow values that are an array with length less than min", () => {
        expect(baseValidators.arrayWithLengthMinMax(3, 5)(["a", "b"])).toBe(false);
      });

      it("should allow values that are an array with the max length", () => {
        expect(baseValidators.arrayWithLengthMinMax(0, 2)(["a"])).toBe(true);
      });

      it("should allow values that are an array with the min length", () => {
        expect(baseValidators.arrayWithLengthMinMax(0, 2)([])).toBe(true);
      });

      it("should allow values that are an array with length between the specified min and max", () => {
        expect(baseValidators.arrayWithLengthMinMax(1, 3)(["a", "b"])).toBe(true);
      });
    });
  });

  describe("compound validators", () => {
    describe("array of", () => {
      // Regression: elements were checked with some(), which never visits holes, so a sparse array validated
      it("should validate the holes of a sparse array as undefined", () => {
        expect(baseValidators.arrayOf(baseValidators.number())(new Array(3))).toBe(false);
        const holeThenNumber: number[] = [];
        holeThenNumber[1] = 1;
        expect(baseValidators.arrayOf(baseValidators.number())(holeThenNumber)).toBe(false);
        expect(baseValidators.arrayOf(baseValidators.object(), false)(new Array(2))).toBe(false);
        expect(baseValidators.arrayOf(baseValidators.number())([0, 1])).toBe(true);
      });

      it("exposes the item validator as metadata", () => {
        const itemValidator = baseValidators.string();
        expect(baseValidators.arrayOf(itemValidator).itemValidator).toBe(itemValidator);
      });

      it("should allow an array of undefined values if they are permitted", () => {
        expect(baseValidators.arrayOf(baseValidators.notEqual(null))([undefined, undefined])).toBe(true);
      });

      it("should allow empty arrays if they are permitted", () => {
        expect(baseValidators.arrayOf(baseValidators.notEqual(null), true)([])).toBe(true);
      });

      it("should not allow empty arrays if they are forbidden", () => {
        expect(baseValidators.arrayOf(baseValidators.notEqual(null), false)([])).toBe(false);
      });

      it("should allow arrays when all elements match the element validator", () => {
        expect(baseValidators.arrayOf(baseValidators.notEqual(null))([1, 2, 3])).toBe(true);
      });

      it("should not allow arrays when some element does not match the element validator", () => {
        expect(baseValidators.arrayOf(baseValidators.notEqual(null))([1, null, 3])).toBe(false);
      });
    });

    describe("object with", () => {
      it("should not allow empty ojects", () => {
        expect(baseValidators.objectWith(["a", "b"], baseValidators.equal(undefined))({})).toBe(false);
      });

      it("should allow an object with exact properties and values that match the property validator", () => {
        expect(baseValidators.objectWith(["a", "b"], baseValidators.numberMin(5))({ a: 6, b: 7 })).toBe(true);
      });

      it("should not allow an object when some properties and values do not match the property validator", () => {
        expect(baseValidators.objectWith(["a", "b"], baseValidators.numberMin(5))({ a: 6, b: 4 })).toBe(false);
      });

      it("should not allow an object if any of the properties are missing", () => {
        expect(baseValidators.objectWith(["a", "b", "c"], baseValidators.notEqual(null))({ a: 6, c: 4 })).toBe(false);
      });

      it("should not allow an object if extra properties are present", () => {
        expect(
          baseValidators.objectWith(["a", "b", "c"], baseValidators.notEqual(null))({ a: 6, b: 2, c: 4, d: 5 })
        ).toBe(false);
      });

      it("should not allow an object if extra properties are present and some are missing", () => {
        expect(
          baseValidators.objectWith(["a", "b", "c"], baseValidators.notEqual(null))({ a: 6, bbb: 2, c: 4, d: 5 })
        ).toBe(false);
      });

      // Regression: only the key count was checked, so a same-sized object with
      // entirely wrong keys passed whenever the validator accepted undefined
      it("should not allow an object with the right key count but wrong keys", () => {
        expect(baseValidators.objectWith(["a", "b"], baseValidators.notEqual(null))({ x: 1, y: 2 })).toBe(false);
      });

      it("should not treat prototype member names as listed properties", () => {
        expect(baseValidators.objectWith(["a"], baseValidators.notEqual(null))(JSON.parse('{"__proto__": 1}'))).toBe(false);
      });
    });

    describe("object with some", () => {
      it("should not allow empty ojects", () => {
        expect(baseValidators.objectWithSome(["a", "b"], baseValidators.equal(undefined))({})).toBe(false);
      });

      it("should allow an object with exact properties and values that match the property validator", () => {
        expect(baseValidators.objectWithSome(["a", "b"], baseValidators.numberMin(5))({ a: 6, b: 7 })).toBe(true);
      });

      it("should not allow an object when some properties and values do not match the property validator", () => {
        expect(baseValidators.objectWithSome(["a", "b"], baseValidators.numberMin(5))({ a: 6, b: 4 })).toBe(false);
      });

      it("should allow an object if some of the properties are missing", () => {
        expect(baseValidators.objectWithSome(["a", "b", "c"], baseValidators.notEqual(null))({ a: 6, c: 4 })).toBe(
          true
        );
      });

      it("should not allow an object if extra properties are present", () => {
        expect(
          baseValidators.objectWithSome(["a", "b", "c"], baseValidators.notEqual(null))({ a: 6, b: 2, c: 4, d: 5 })
        ).toBe(false);
      });

      it("should not allow an object if extra properties are present and some are missing", () => {
        expect(
          baseValidators.objectWithSome(["a", "b", "c"], baseValidators.notEqual(null))({ a: 6, bbb: 2, c: 4, d: 5 })
        ).toBe(false);
      });

      // Regression: a present-but-undefined member failed the predicate while nestedValues said it was allowed
      it("should treat a present but undefined member as unspecified, like its nestedValues", () => {
        const validator = baseValidators.objectWithSome(["a", "b"], baseValidators.number());
        expect(validator({ a: undefined, b: 1 })).toBe(true);
        expect(validator.nestedValues!.a(undefined)).toBe(true);
        expect(validator({ a: null, b: 1 })).toBe(false);
      });
    });

    describe("object with shape", () => {
      it("should not allow empty objects", () => {
        expect(baseValidators.objectWithShape({ a: baseValidators.notEqual(undefined) })({})).toBe(false);
      });

      it("should allow empty objects if that matches all property validators", () => {
        expect(baseValidators.objectWithShape({ a: baseValidators.equal(undefined) })({})).toBe(true);
      });

      it("should allow an object with exact properties and values that match the property validator", () => {
        expect(
          baseValidators.objectWithShape({ a: baseValidators.numberMin(5), b: baseValidators.numberMin(5) })({
            a: 6,
            b: 7
          })
        ).toBe(true);
      });

      it("should not allow an object when some properties and values do not match the property validator", () => {
        expect(
          baseValidators.objectWithShape({ a: baseValidators.numberMin(5), b: baseValidators.numberMin(5) })({
            a: 6,
            b: 4
          })
        ).toBe(false);
      });

      it("should allow an object if some of the properties are missing", () => {
        expect(
          baseValidators.objectWithShape({
            a: baseValidators.notEqual(null),
            b: baseValidators.notEqual(null),
            c: baseValidators.notEqual(null)
          })({ a: 6, c: 4 })
        ).toBe(true);
      });

      it("should not allow an object if extra properties are present", () => {
        expect(
          baseValidators.objectWithShape({
            a: baseValidators.notEqual(null),
            b: baseValidators.notEqual(null),
            c: baseValidators.notEqual(null)
          })({ a: 6, b: 2, c: 4, d: 5 })
        ).toBe(false);
      });

      it("should not allow an object if extra properties are present and some are missing", () => {
        expect(
          baseValidators.objectWithShape({
            a: baseValidators.notEqual(null),
            b: baseValidators.notEqual(null),
            c: baseValidators.notEqual(null)
          })({ a: 6, bbb: 2, c: 4, d: 5 })
        ).toBe(false);
      });

      it("should allow an object if extra properties are present and they are permitted", () => {
        expect(
          baseValidators.objectWithShape(
            { a: baseValidators.notEqual(null), b: baseValidators.notEqual(null), c: baseValidators.notEqual(null) },
            true
          )({ a: 6, b: 2, c: 4, d: 5 })
        ).toBe(true);
      });
    });

    describe("partial object with shape", () => {
      const shape = () => ({
        a: baseValidators.numberMin(5),
        b: baseValidators.numberMin(5),
        c: baseValidators.numberMin(5)
      });

      it("should allow empty objects", () => {
        expect(baseValidators.partialObjectWithShape({ a: baseValidators.notEqual(undefined) })({})).toBe(true);
      });

      it("should allow an object with only some of the shape properties", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ b: 6 })).toBe(true);
      });

      it("should allow an object with all of the shape properties", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ a: 6, b: 7, c: 8 })).toBe(true);
      });

      it("should not allow a present property whose value fails its validator", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ b: 4 })).toBe(false);
      });

      it("should treat a present but undefined property as unspecified", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ b: undefined })).toBe(true);
      });

      it("should allow a null property when the property validator allows null", () => {
        expect(
          baseValidators.partialObjectWithShape({ a: baseValidators.numberMin(5).orEqual(null) })({ a: null })
        ).toBe(true);
      });

      it("should not allow a null property when the property validator does not allow null", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ a: null })).toBe(false);
      });

      it("should not allow an object with extra properties", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ a: 6, d: 7 })).toBe(false);
      });

      it("should allow an object with extra properties when they are permitted", () => {
        expect(baseValidators.partialObjectWithShape(shape(), true)({ a: 6, d: 7 })).toBe(true);
      });

      it("should not allow arrays", () => {
        expect(baseValidators.partialObjectWithShape(shape())([])).toBe(false);
      });

      it("should not allow non objects", () => {
        expect(baseValidators.partialObjectWithShape(shape())(undefined)).toBe(false);
        expect(baseValidators.partialObjectWithShape(shape())(null)).toBe(false);
        expect(baseValidators.partialObjectWithShape(shape())("a")).toBe(false);
      });

      it("should treat Object.prototype member names as unknown properties", () => {
        expect(baseValidators.partialObjectWithShape(shape())({ constructor: 1 })).toBe(false);
        expect(baseValidators.partialObjectWithShape(shape(), true)({ constructor: 1 })).toBe(true);
        expect(baseValidators.objectWithShape({}, false)({ constructor: 1 })).toBe(false);
      });
    });

    describe("or", () => {
      it("exposes its alternative validators as metadata", () => {
        const alternatives = [baseValidators.equal(1), baseValidators.equal(2)];
        expect(baseValidators.or(alternatives).alternativeValidators).toEqual(alternatives);
      });

      it("should not allow values when all validators return false", () => {
        expect(baseValidators.or([baseValidators.equal(1), baseValidators.equal(2)])(3)).toIsEqual(false);
      });

      it("should allow values when one validator returns true", () => {
        expect(baseValidators.or([baseValidators.equal(1), baseValidators.equal(2)])(2)).toIsEqual(true);
      });
    });

    describe("and", () => {
      it("does not expose intersections as alternatives", () => {
        const validators = [baseValidators.numberMin(1), baseValidators.numberMax(3)];
        expect(baseValidators.and(validators).alternativeValidators).toBeNull();
      });

      it("should not allow values when all validators return false", () => {
        expect(baseValidators.and([baseValidators.equal(1), baseValidators.equal(2)])(3)).toIsEqual(false);
      });

      it("should not allow values when only one validator returns true", () => {
        expect(baseValidators.and([baseValidators.equal(1), baseValidators.equal(2)])(2)).toIsEqual(false);
      });

      it("should allow values when all validators return true", () => {
        expect(baseValidators.and([baseValidators.numberMin(1), baseValidators.numberMax(3)])(2)).toIsEqual(true);
      });
    });

    describe("not", () => {
      it("does not expose a negated validator as an alternative", () => {
        expect(baseValidators.not(baseValidators.equal(1)).alternativeValidators).toBeNull();
      });

      it("should allow values that are invalid", () => {
        expect(baseValidators.not(baseValidators.equal(1))(2)).toIsEqual(true);
      });

      it("should not allow values that are valid", () => {
        expect(baseValidators.not(baseValidators.equal(1))(1)).toIsEqual(false);
      });
    });
  });

  describe("conditional validator", () => {
    it("exposes every possible rule validator as an alternative", () => {
      const alternatives = [baseValidators.string(), baseValidators.number()];
      const rules: ConditionalRule[] = [
        { condition: ({ type }) => type === "string", validator: alternatives[0] },
        { condition: () => true, validator: alternatives[1] }
      ];
      expect(baseValidators.conditional(rules, { type: "string" }).alternativeValidators).toEqual(alternatives);
    });

    it("should allow values that are allowed by the validator for the matched rule", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        }
      ];
      const object = { type: "string" };
      expect(baseValidators.conditional(rules, object)("a")).toIsEqual(true);
    });

    it("should not allow values that are not allowed by the validator for the matched rule", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        }
      ];
      const object = { type: "string" };
      expect(baseValidators.conditional(rules, object)(1)).toIsEqual(false);
    });

    it("should use the validator for the first matched rule", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        },
        { condition: () => true, validator: baseValidators.equal(123) }
      ];
      const object = { type: "string" };
      expect(baseValidators.conditional(rules, object)("a")).toIsEqual(true);
      expect(baseValidators.conditional(rules, object)(123)).toIsEqual(false);
    });

    it("should check the conditions for all rules until a match is found", () => {
      let count = 0;
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => {
            count++;
            return type === "string";
          },
          suffix: "when type is string",
          validator: baseValidators.string()
        },
        {
          condition: ({ type }) => {
            count++;
            return type === "number";
          },
          suffix: "when type is number",
          validator: baseValidators.number()
        },
        {
          condition: () => {
            count++;
            return true;
          },
          validator: baseValidators.equal(123)
        }
      ];
      const object = { type: "abc" };
      expect(baseValidators.conditional(rules, object)(123)).toIsEqual(true);
      expect(count).toIsEqual(rules.length);
    });

    it("should have an errorMessages array with one message per rule", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        },
        {
          condition: ({ type }) => type === "number",
          suffix: "when type is number",
          validator: baseValidators.number()
        },
        { condition: () => true, validator: baseValidators.equal(123) }
      ];
      const object = {};
      const validator = baseValidators.conditional(rules, object);
      expect(validator.errorMessages.length).toIsEqual(3);
      expect(validator.errorMessages).toIsEqual([
        "should be a string when type is string",
        "should be a number when type is number",
        "should be equal to 123"
      ]);
    });

    it("should fail validation with every rule's message when no rule matches", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        },
        {
          condition: ({ type }) => type === "number",
          suffix: "when type is number",
          validator: baseValidators.number()
        }
      ];
      const validator = baseValidators.conditional(rules, { type: "boolean" });
      expect(validator("a")).toIsEqual(false);
      expect(validator(1)).toIsEqual(false);
      expect(validator.errorMessage).toIsEqual(
        "should be a string when type is string or should be a number when type is number"
      );
    });

    it("should fail validation with a fixed message for an empty rules array", () => {
      const validator = baseValidators.conditional([], {});
      expect(validator("a")).toIsEqual(false);
      expect(validator.errorMessage).toIsEqual("no conditional rule matched");
    });

    it("should set the error message to the message of the validator for the matched rule", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        },
        {
          condition: ({ type }) => type === "number",
          suffix: "when type is number",
          validator: baseValidators.number()
        },
        { condition: () => true, validator: baseValidators.equal(123) }
      ];
      const object = {};
      const validator = baseValidators.conditional(rules, object);
      expect(validator.errorMessage).toIsEqual("should be equal to 123");
    });

    it("should carry the orEqual, orOneOf and or extensions like every other validator", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        }
      ];
      const object = { type: "string" };
      expect(baseValidators.conditional(rules, object).orEqual(undefined)(undefined)).toIsEqual(true);
      expect(baseValidators.conditional(rules, object).orEqual(undefined)("a")).toIsEqual(true);
      expect(baseValidators.conditional(rules, object).orEqual(undefined)(1)).toIsEqual(false);
      expect(baseValidators.conditional(rules, object).orOneOf([1, 2])(2)).toIsEqual(true);
      expect(baseValidators.conditional(rules, object).or(baseValidators.number())(1)).toIsEqual(true);
      expect(baseValidators.conditional(rules, object).withMessage("nope").orEqual(undefined)(undefined)).toIsEqual(true);
    });

    it("should append the extension message to the message of the validator for the matched rule", () => {
      const rules: ConditionalRule[] = [
        {
          condition: ({ type }) => type === "string",
          suffix: "when type is string",
          validator: baseValidators.string()
        }
      ];
      const validator = baseValidators.conditional(rules, { type: "string" }).orEqual(undefined);
      expect(validator.validatorName).toIsEqual("conditional");
      expect(validator.extensionNames).toIsEqual(["orEqual"]);
      expect(validator.errorMessage).toIsEqual("should be a string when type is string or be equal to undefined");
      expect(validator.errorMessages).toIsEqual([validator.errorMessage]);
    });
  });

  describe("messages", () => {
    it("should output validator messages for all validators", () => {
      let validator: Validator;
      validatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        expect(validator).toBeInstanceOf(Function);
        expect(validator.errorMessage).toBeTruthy();
        expect(validator.errorMessages).toBeInstanceOf(Array);
        expect(validator.getErrorMessage).toBeInstanceOf(Function);
        expect(validator.getErrorMessage()).toBeTruthy();
      });
    });

    it("should have an errorMessages array with one error message for regular validators", () => {
      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        expect(validator).toBeInstanceOf(Function);
        expect(validator.errorMessage).toBeTruthy();
        expect(validator.errorMessages).toBeInstanceOf(Array);
        expect([validator.errorMessage]).toIsEqual(validator.errorMessages);
      });
    });

    // Regression: printing walked a circular value until the stack overflowed, and rethrew a throwing getter
    it("should print a circular value as [Circular] and a throwing getter as [Unreadable]", () => {
      const circular: Record<string, any> = { a: 1 };
      circular.self = circular;
      circular.list = [circular];
      expect(baseValidators.number().getErrorMessage(circular)).toBe("should be a number: { a: 1, self: [Circular], list: [ [Circular] ] }");
      expect(baseValidators.equal(circular).errorMessage).toBe("should be equal to { a: 1, self: [Circular], list: [ [Circular] ] }");
      const throwing = { get x(): number { throw new Error("getter boom"); }, y: 2 };
      expect(baseValidators.number().getErrorMessage(throwing)).toBe("should be a number: { x: [Unreadable], y: 2 }");
      // a repeated but non-circular reference still prints in full
      const shared = { s: 1 };
      expect(baseValidators.number().getErrorMessage({ a: shared, b: shared })).toBe("should be a number: { a: { s: 1 }, b: { s: 1 } }");
    });

    // Regression: any non-array object printed only its own keys, so a Date, RegExp, Map, Set or boxed primitive read as {  }
    it("should print non-plain objects by value or constructor name", () => {
      const message = (value: unknown) => baseValidators.number().getErrorMessage(value).replace("should be a number: ", "");
      expect(message(new Date("2016-09-01T00:00:00Z"))).toBe("2016-09-01T00:00:00.000Z");
      expect(message(new Date("nope"))).toBe("Invalid Date");
      expect(message(/re/g)).toBe("/re/g");
      expect(message(new Number(5))).toBe("5");
      expect(message(new String("s"))).toBe("\"s\"");
      expect(message(new Map([[1, 2]]))).toBe("Map [ [ 1, 2 ] ]");
      expect(message(new Set(["a"]))).toBe("Set [ \"a\" ]");
      class Thing {}
      expect(message(new Thing())).toBe("Thing {  }");
      expect(message({ a: 1 })).toBe("{ a: 1 }");
      expect(message({})).toBe("{  }");
    });

    it("should allow a custom message via a message property on a custom validator function", () => {
      const validator = baseValidators.custom(customValidator);
      expect(validator.errorMessage).toBe(customValidator.message);
      expect(validator.errorMessages).toBeInstanceOf(Array);
      expect([validator.errorMessage]).toIsEqual(validator.errorMessages);
      expect(validator.getErrorMessage).toBeInstanceOf(Function);
      expect(validator.getErrorMessage()).toBe(customValidator.message + ": undefined");
    });

    it("should allow appending to a custom message on a custom validator function", () => {
      const appendToMessage = "and more";
      const validator = baseValidators.custom(customValidator).appendMessage(appendToMessage);
      expect(validator.errorMessage).toBe(customValidator.message + appendToMessage);
      expect(validator.errorMessages).toBeInstanceOf(Array);
      expect([validator.errorMessage]).toIsEqual(validator.errorMessages);
      expect(validator.getErrorMessage).toBeInstanceOf(Function);
      expect(validator.getErrorMessage()).toBe(customValidator.message + appendToMessage + ": undefined");
    });
  });

  describe("allowedValues", () => {
    it("should return the value for equal", () => {
      expect(baseValidators.equal("hello").allowedValues).toIsEqual(["hello"]);
    });

    it("should return all allowed values for oneOf", () => {
      expect(baseValidators.oneOf(["hello", "there"]).allowedValues).toIsEqual(["hello", "there"]);
    });

    it("should return all allowed values for or when all argument validators are isEnum", () => {
      expect(
        baseValidators.or([baseValidators.equal("why"), baseValidators.oneOf(["hello", "there"])]).allowedValues
      ).toIsEqual(["why", "hello", "there"]);
    });

    it("should not return some null allowed values for or when some argument validators are isEnum but others are not", () => {
      expect(
        baseValidators.or([baseValidators.number(), baseValidators.oneOf(["hello", "there"])]).allowedValues
      ).toIsEqual(["hello", "there"]);
    });

    it("should only return a single null value for or when no argument validators are isEnum", () => {
      expect(baseValidators.or([baseValidators.number(), baseValidators.string()]).allowedValues).toIsEqual(null);
    });

    it("should return null for all validators that do not have allowed values", () => {
      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        if (
          validator.validatorName !== "equal" &&
          validator.validatorName !== "oneOf" &&
          validator.validatorName !== "oneIn" &&
          validator.validatorName !== "or"
        ) {
          expect(validator.allowedValues).toIsEqual(null);
        }
      });
    });
  });

  describe("isEnum", () => {
    it("should return true for equal", () => {
      expect(baseValidators.equal("hello").isEnum).toIsEqual(true);
    });

    it("should return true for oneOf", () => {
      expect(baseValidators.oneOf(["hello", "there"]).isEnum).toIsEqual(true);
    });

    it("should return true for or when all argument validators are isEnum", () => {
      expect(
        baseValidators.or([baseValidators.equal("why"), baseValidators.oneOf(["hello", "there"])]).isEnum
      ).toIsEqual(true);
    });

    it("should return false for or when some argument validators are isEnum but others are not", () => {
      expect(baseValidators.or([baseValidators.number(), baseValidators.oneOf(["hello", "there"])]).isEnum).toIsEqual(
        false
      );
    });

    it("should return false for or when no argument validators are isEnum", () => {
      expect(baseValidators.or([baseValidators.number(), baseValidators.string()]).isEnum).toIsEqual(false);
    });

    it("should return false for all validators that do not have allowed values", () => {
      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        if (isEnumValidatorNames[validatorKey] !== true) {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          expect(validator.isEnum).toIsEqual(false);
        }
      });
    });
  });

  describe("nestedValues", () => {
    it("should return the nested value map for objectWith", () => {
      expect(baseValidators.objectWith(["a", "b", "c"], baseValidators.number()).nestedValues).toIsEqual({
        a: baseValidators.number(),
        b: baseValidators.number(),
        c: baseValidators.number()
      });
    });

    it("should return the nested value map for objectWithSome", () => {
      expect(baseValidators.objectWithSome(["a", "b", "c"], baseValidators.number()).nestedValues).toIsEqual({
        a: baseValidators.number().orEqual(undefined),
        b: baseValidators.number().orEqual(undefined),
        c: baseValidators.number().orEqual(undefined)
      });
    });

    it("should return the nested value map for objectWithSome", () => {
      expect(
        baseValidators.objectWithShape({
          a: baseValidators.number(),
          b: baseValidators.number(),
          c: baseValidators.number()
        }).nestedValues
      ).toIsEqual({
        a: baseValidators.number(),
        b: baseValidators.number(),
        c: baseValidators.number()
      });
    });

    it("should return null for all validators that do not have nestedValues", () => {
      const nestedValidatorNames: Record<string, boolean> = { objectWith: true, objectWithSome: true, objectWithShape: true, partialObjectWithShape: true };
      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        if (nestedValidatorNames[validatorKey] !== true) {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          expect(validator.nestedValues).toIsEqual(null);
        }
      });
    });
  });

  describe("extensions", () => {
    const getErrorMessageEnd = ": undefined";

    it("should output validator extensions for all validators", () => {
      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        expect(validator).toBeInstanceOf(Function);
        extensionKeys.forEach(extensionKey => {
          const extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
          expect(extension).toBeInstanceOf(Function);
          expect(extension.errorMessage).toBeTruthy();
          expect(extension.getErrorMessage).toBeInstanceOf(Function);
          expect(extension.getErrorMessage()).toBeTruthy();
        });
      });
    });

    it("should change the validation result when the extension warrants it", () => {
      const validator = baseValidators.number();
      expect(validator("abc")).toBe(false);
      expect(validator.orEqual("abc")("abc")).toBe(true);
      expect(validator.orOneOf(["ab", "abcd"])("abcd")).toBe(true);
      expect(validator.or(baseValidators.equal("abcd"))("abcd")).toBe(true);
    });

    it("should let orEqual and orOneOf admit NaN by name while number() itself stays finite-only", () => {
      const validator = baseValidators.number();
      expect(validator(NaN)).toBe(false);
      expect(validator.orEqual(NaN)(NaN)).toBe(true);
      expect(validator.orOneOf([undefined, null, NaN])(NaN)).toBe(true);
      expect(validator.orOneOf([undefined, null, NaN])(null)).toBe(true);
      expect(validator.orOneOf([undefined, null, NaN])("x")).toBe(false);
      expect(validator.orOneOf([undefined, null, NaN]).errorMessage).toBe("should be a number or be one of [ undefined, null, NaN ]");
    });

    it("should expose validators added with or as alternatives", () => {
      const base = baseValidators.string();
      const alternative = baseValidators.number();
      expect(base.or(alternative).alternativeValidators).toEqual([base, alternative]);
    });

    it("should not change the validation result when the extension does not warrant it", () => {
      const validator = baseValidators.number();
      expect(validator("abc")).toBe(false);
      expect(validator.orEqual(5)("abc")).toBe(false);
      expect(validator.orOneOf(["ab", "abc"])("abcd")).toBe(false);
      expect(validator.or(baseValidators.equal("abc"))("abcd")).toBe(false);
    });

    it("should append the extension error message to the validator error message", () => {
      const validator = baseValidators.number();
      expect(validator.errorMessage).toBeTruthy();
      const extension = validator.orEqual(1);
      expect(extension.errorMessage).toBeTruthy();
      expect(extension.errorMessage.startsWith(validator.errorMessage)).toBe(true);
    });

    it("should support changing all validator messages", () => {
      const customMessage = "hello";

      let validator: Validator;
      validatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        validator = validator.withMessage(customMessage);

        expect(validator).toBeInstanceOf(Function);
        expect(validator(validatorInputs[validatorKey].valid)).toIsEqual(true, validatorKey);
        if (validatorKey !== "any") {
          expect(validator(validatorInputs[validatorKey].invalid)).toIsEqual(false, validatorKey);
        }
        expect(validator.errorMessage).toIsEqual(customMessage);
        expect(validator.getErrorMessage).toBeInstanceOf(Function);
        expect(validator.getErrorMessage()).toIsEqual(customMessage + getErrorMessageEnd);
      });
    });

    it("should support changing all validator extension messages", () => {
      const customMessage = "hello";

      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        expect(validator).toBeInstanceOf(Function);
        extensionKeys.forEach(extensionKey => {
          let extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
          extension = extension.withMessage(customMessage);

          expect(extension).toBeInstanceOf(Function);
          expect(extension(extensionInputs[extensionKey].valid)).toIsEqual(true, validatorKey + " - " + extensionKey);
          if (validatorKey !== "any") {
            expect(extension(validatorInputs[validatorKey].invalid)).toIsEqual(
              false,
              validatorKey + " - " + extensionKey
            );
          }
          expect(extension.errorMessage).toIsEqual(customMessage);
          expect(extension.getErrorMessage).toBeInstanceOf(Function);
          expect(extension.getErrorMessage()).toIsEqual(customMessage + ": undefined");
        });
      });
    });

    it("should support prepending to all validator messages", () => {
      const customMessage = "hello";

      let validator: Validator;
      validatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        validator = validator.prependMessage(customMessage);

        expect(validator).toBeInstanceOf(Function);
        expect(validator(validatorInputs[validatorKey].valid)).toIsEqual(true, validatorKey);
        if (validatorKey !== "any") {
          expect(validator(validatorInputs[validatorKey].invalid)).toIsEqual(false, validatorKey);
        }
        expect(validator.errorMessage.substring(0, customMessage.length)).toIsEqual(customMessage);
        expect(validator.getErrorMessage).toBeInstanceOf(Function);
        expect(validator.getErrorMessage().substring(0, customMessage.length)).toIsEqual(customMessage);
      });
    });

    it("should support prepending to all validator extension messages", () => {
      const customMessage = "hello";

      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        expect(validator).toBeInstanceOf(Function);
        extensionKeys.forEach(extensionKey => {
          let extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
          extension = extension.prependMessage(customMessage);

          expect(extension).toBeInstanceOf(Function);
          expect(extension(extensionInputs[extensionKey].valid)).toIsEqual(true);
          expect(extension(validatorInputs[validatorKey].invalid)).toIsEqual(false);
          expect(extension.errorMessage.substring(0, customMessage.length)).toIsEqual(customMessage);
          expect(extension.getErrorMessage).toBeInstanceOf(Function);
          expect(extension.getErrorMessage().substring(0, customMessage.length)).toIsEqual(customMessage);
        });
      });
    });

    it("should support appending to all validator messages", () => {
      const customMessage = "hello";

      let validator: Validator;
      validatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        validator = validator.appendMessage(customMessage);

        expect(validator).toBeInstanceOf(Function);
        expect(validator(validatorInputs[validatorKey].valid)).toIsEqual(true, validatorKey);
        if (validatorKey !== "any") {
          expect(validator(validatorInputs[validatorKey].invalid)).toIsEqual(false, validatorKey);
        }
        expect(
          validator.errorMessage.substring(
            validator.errorMessage.length - customMessage.length,
            validator.errorMessage.length
          )
        ).toIsEqual(customMessage);
        expect(validator.getErrorMessage).toBeInstanceOf(Function);
        const fullErrorMessage = validator.getErrorMessage();
        const expectedCustomMessageStart = fullErrorMessage.length - getErrorMessageEnd.length - customMessage.length;
        expect(
          fullErrorMessage.substring(expectedCustomMessageStart, expectedCustomMessageStart + customMessage.length)
        ).toIsEqual(customMessage);
      });
    });

    it("should support appending to all validator extension messages", () => {
      const customMessage = "hello";

      let validator: Validator;
      regularValidatorKeys.forEach(validatorKey => {
        validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
        expect(validator).toBeInstanceOf(Function);
        extensionKeys.forEach(extensionKey => {
          let extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
          extension = extension.appendMessage(customMessage);

          expect(extension).toBeInstanceOf(Function);
          expect(extension(extensionInputs[extensionKey].valid)).toIsEqual(true, validatorKey + " - " + extensionKey);
          expect(extension(validatorInputs[validatorKey].valid)).toIsEqual(true, validatorKey + " - " + extensionKey);
          expect(
            extension.errorMessage.substring(
              extension.errorMessage.length - customMessage.length,
              extension.errorMessage.length
            )
          ).toIsEqual(customMessage);
          expect(extension.getErrorMessage).toBeInstanceOf(Function);
          const fullErrorMessage = extension.getErrorMessage();
          const expectedCustomMessageStart = fullErrorMessage.length - getErrorMessageEnd.length - customMessage.length;
          expect(
            extension
              .getErrorMessage()
              .substring(expectedCustomMessageStart, expectedCustomMessageStart + customMessage.length)
          ).toIsEqual(customMessage);
        });
      });
    });

    describe("allowedValues", () => {
      it("should return the value for orEqual on a validator with no allowedValues", () => {
        expect(baseValidators.string().orEqual("hello").allowedValues).toIsEqual(["hello"]);
      });

      it("should append the value for orEqual on a validator with allowedValues", () => {
        expect(baseValidators.equal("hello").orEqual("there").allowedValues).toIsEqual(["hello", "there"]);
      });

      it("should return all allowed values for orOneOf on a validator with no allowedValues", () => {
        expect(baseValidators.string().orOneOf(["hello", "there"]).allowedValues).toIsEqual(["hello", "there"]);
      });

      it("should append all allowed values for orOneOf on a validator with allowedValues", () => {
        expect(baseValidators.oneOf(["why", "yes"]).orOneOf(["hello", "there"]).allowedValues).toIsEqual([
          "why",
          "yes",
          "hello",
          "there"
        ]);
      });

      it("should return all allowed values for .or with allowedValues on a validator with no allowedValues", () => {
        expect(baseValidators.string().or(baseValidators.oneOf(["hello", "there"])).allowedValues).toIsEqual([
          "hello",
          "there"
        ]);
      });

      it("should append all allowed values for .or with allowedValues on a validator with no allowedValues", () => {
        expect(baseValidators.equal("why").or(baseValidators.oneOf(["hello", "there"])).allowedValues).toIsEqual([
          "why",
          "hello",
          "there"
        ]);
      });

      it("should not append any values for .or with no allowedValues on a validator with allowedValues", () => {
        expect(baseValidators.equal("hey").or(baseValidators.string()).allowedValues).toIsEqual(["hey"]);
      });

      it("should return null for a .or with no allowedValues on a validator with no allowedValues", () => {
        expect(baseValidators.string().or(baseValidators.number()).allowedValues).toIsEqual(null);
      });

      it("should not modify the original validator", () => {
        let validator: Validator, extension: Validator;
        let validatorAllowedValues: any[] | null, extensionAllowedValues: any[] | null;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          validatorAllowedValues = validator.allowedValues;
          extensionKeys.forEach(extensionKey => {
            extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            extensionAllowedValues = extension.allowedValues;
            extensionKeys.forEach(extraExtensionKey => {
              extensionsOf(extension)[extraExtensionKey](...extensionInputs[extraExtensionKey].args);
              expect(validator.allowedValues).toIsEqual(validatorAllowedValues);
              expect(extension.allowedValues).toIsEqual(extensionAllowedValues);
            });
          });
        });
      });
    });

    describe("rangeValues", () => {
      it("should return null for all validators that do not have ranged values", () => {
        validatorKeys.forEach(validatorKey => {
          if (isRangedValidatorNames[validatorKey] !== true) {
            expect(anyValidators[validatorKey](...validatorInputs[validatorKey].args).rangeValues).toIsEqual(null);
          }
        });
      });

      it("should return the range values for all validators that have them", () => {
        validatorKeys.forEach(validatorKey => {
          if (isRangedValidatorNames[validatorKey] === true) {
            const args = validatorInputs[validatorKey].args;
            const rangeValues = anyValidators[validatorKey](...args).rangeValues;
            expect(rangeValues).not.toIsEqual(null);
            if (validatorKey.indexOf("MinMax") !== -1) {
              expect(rangeValues!.min).toIsEqual(args[0]);
              expect(rangeValues!.max).toIsEqual(args[1]);
            } else if (validatorKey.indexOf("Min") !== -1) {
              expect(rangeValues!.min).toIsEqual(args[0]);
            } else if (validatorKey.indexOf("Max") !== -1) {
              expect(rangeValues!.max).toIsEqual(args[0]);
            } else {
              throw new Error("The tests expect all range validators to have Min or Max in their validatorName");
            }
          }
        });
      });
    });

    describe("isEnum", () => {
      it("should false for orEqual on a validator with no allowedValues", () => {
        expect(baseValidators.string().orEqual("hello").isEnum).toIsEqual(false);
      });

      it("should return true for orEqual on a validator with allowedValues", () => {
        expect(baseValidators.equal("hello").orEqual("there").isEnum).toIsEqual(true);
      });

      it("should return false for orOneOf on a validator with no allowedValues", () => {
        expect(baseValidators.string().orOneOf(["hello", "there"]).isEnum).toIsEqual(false);
      });

      it("should return true for orOneOf on a validator with allowedValues", () => {
        expect(baseValidators.oneOf(["why", "yes"]).orOneOf(["hello", "there"]).isEnum).toIsEqual(true);
      });

      it("should return false for .or with allowedValues on a validator with no allowedValues", () => {
        expect(baseValidators.string().or(baseValidators.oneOf(["hello", "there"])).isEnum).toIsEqual(false);
      });

      it("should return true for .or with allowedValues on a validator with no allowedValues", () => {
        expect(baseValidators.equal("why").or(baseValidators.oneOf(["hello", "there"])).isEnum).toIsEqual(true);
      });

      it("should return false for .or with no allowedValues on a validator with allowedValues", () => {
        expect(baseValidators.equal("hey").or(baseValidators.string()).isEnum).toIsEqual(false);
      });

      it("should return false for a .or with no allowedValues on a validator with no allowedValues", () => {
        expect(baseValidators.string().or(baseValidators.number()).isEnum).toIsEqual(false);
      });

      it("should not modify the original validator", () => {
        let validator: Validator, extension: Validator;
        let validatorWasEnum: boolean, extensionWasEnum: boolean;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          validatorWasEnum = validator.isEnum;
          extensionKeys.forEach(extensionKey => {
            extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            extensionWasEnum = extension.isEnum;
            extensionKeys.forEach(extraExtensionKey => {
              extensionsOf(extension)[extraExtensionKey](...extensionInputs[extraExtensionKey].args);
              expect(validator.isEnum).toIsEqual(validatorWasEnum);
              expect(extension.isEnum).toIsEqual(extensionWasEnum);
            });
          });
        });
      });
    });

    it("should support nested extensions", () => {
      const validator = baseValidators
        .equal("a")
        .appendMessage(" <a>")
        .orEqual("b")
        .appendMessage(" <b>")
        .orEqual("c")
        .appendMessage(" <c>");

      expect(validator("a")).toIsEqual(true);
      expect(validator("b")).toIsEqual(true);
      expect(validator("c")).toIsEqual(true);
      expect(validator("d")).toIsEqual(false);
      expect(validator.errorMessage).toIsEqual(
        'should be equal to "a" <a> or be equal to "b" <b> or be equal to "c" <c>'
      );
      expect(validator.getErrorMessage("d")).toIsEqual(
        'should be equal to "a" <a> or be equal to "b" <b> or be equal to "c" <c>: "d"'
      );
    });
  });

  describe("names", () => {
    describe("validator names", () => {
      it("should match the validator key for all validators", () => {
        let validator: Validator;
        validatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          expect(validator.validatorName).toIsEqual(validatorKey);
        });
      });

      it("should not be modified when extensions are used", () => {
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          extensionKeys.forEach(extensionKey => {
            const extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            expect(extension.validatorName).toIsEqual(validatorKey);
          });
        });
      });

      it("should not modify the original validator", () => {
        let validator: Validator, extension: Validator, extraExtension: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          extensionKeys.forEach(extensionKey => {
            extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            extensionKeys.forEach(extraExtensionKey => {
              extraExtension = extensionsOf(extension)[extraExtensionKey](...extensionInputs[extraExtensionKey].args);
              expect(validator.validatorName).toIsEqual(validatorKey);
              expect(extension.validatorName).toIsEqual(validatorKey);
              expect(extraExtension.validatorName).toIsEqual(validatorKey);
            });
          });
        });
      });
    });

    describe("extension names", () => {
      it("should be null if no extension has been used", () => {
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          expect(validator.extensionNames).toIsEqual(null);
        });
      });

      it("should not modify the original validator", () => {
        let validator: Validator, extension: Validator, extraExtension: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          extensionKeys.forEach(extensionKey => {
            extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            extensionKeys.forEach(extraExtensionKey => {
              extraExtension = extensionsOf(extension)[extraExtensionKey](...extensionInputs[extraExtensionKey].args);
              expect(validator.extensionNames).toIsEqual(null);
              expect(extension.extensionNames).toIsEqual([extensionKey]);
              expect(extraExtension.extensionNames).toIsEqual([extensionKey, extraExtensionKey]);
            });
          });
        });
      });

      it("should contain the extension name if one extension is used", () => {
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          extensionKeys.forEach(extensionKey => {
            const extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            expect(extension.extensionNames).toIsEqual([extensionKey]);
          });
        });
      });

      it("should contain as many extension names as were used", () => {
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          extensionKeys.forEach(extensionKey => {
            let extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            extensionKeys.forEach(extraExtensionKey => {
              extension = extensionsOf(extension)[extraExtensionKey](...extensionInputs[extraExtensionKey].args);
            });
            expect(extension.extensionNames).toIsEqual([extensionKey].concat(extensionKeys));
          });
        });
      });
    });

    describe("custom names", () => {
      it("should be null if withCustomName has not been called", () => {
        let validator: Validator;
        validatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          expect(validator.customName).toIsEqual(null);
        });
      });

      it("should not modify the original validator", () => {
        let validatorA: Validator, validatorB: Validator, validatorC: Validator;
        validatorKeys.forEach(validatorKey => {
          validatorA = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          validatorB = validatorA.withCustomName("a");
          validatorC = validatorB.withCustomName("b");
          expect(validatorA.customName).toIsEqual(null);
          expect(validatorB.customName).toIsEqual("a");
          expect(validatorC.customName).toIsEqual("b");
        });
      });

      it("should be settable for all validators", () => {
        let validator: Validator;
        validatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          expect(validator.withCustomName("custom" + validatorKey).customName).toIsEqual("custom" + validatorKey);
        });
      });

      it("should be settable for all extended validators", () => {
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args);
          extensionKeys.forEach(extensionKey => {
            const extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            expect(extension.withCustomName("custom" + validatorKey).customName).toIsEqual("custom" + validatorKey);
          });
        });
      });

      it("should not be modified when other extensions are used", () => {
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args).withCustomName(
            "custom" + validatorKey
          );
          extensionKeys.forEach(extensionKey => {
            const extension = extensionsOf(validator)[extensionKey](...extensionInputs[extensionKey].args);
            expect(extension.customName).toIsEqual("custom" + validatorKey);
          });
        });
      });

      it("should allow the message to be changed after the custom name is set", () => {
        const theMessage = "a message";
        let validator: Validator;
        regularValidatorKeys.forEach(validatorKey => {
          validator = anyValidators[validatorKey](...validatorInputs[validatorKey].args)
            .withCustomName("custom" + validatorKey)
            .withMessage(theMessage);
          expect(validator.customName).toIsEqual("custom" + validatorKey);
          expect(validator.errorMessage).toIsEqual(theMessage);
          expect(validator.errorMessages).toIsEqual([theMessage]);
        });
      });
    });
  });
});

// Regression: objectWithSome read Object.keys(v) before its object guard, so
// undefined/null crashed instead of failing -- even composed with orEqual.
describe('objectWithSome with non-object input', () => {
  it('returns false instead of throwing', () => {
    const validator = baseValidators.objectWithSome(['a', 'b'], baseValidators.number());
    expect(validator(undefined)).toBe(false);
    expect(validator(null)).toBe(false);
    expect(validator({ a: 1 })).toBe(true);
  });

  it('composes with orEqual(undefined)', () => {
    const validator = baseValidators.objectWithSome(['a'], baseValidators.number()).orEqual(undefined);
    expect(validator(undefined)).toBe(true);
    expect(validator(null)).toBe(false);
  });
});
