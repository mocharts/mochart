type Predicate = (v?: any) => boolean;

export type CustomValidator = Predicate & { message?: string };

export interface RangeValues {
  min?: number;
  max?: number;
}

export interface ConditionalRule {
  condition: (object: any) => boolean;
  validator: Validator;
  suffix?: string;
}

export interface Validator {
  (v?: any): boolean;
  validatorName: string;
  customName: string | null;
  extensionNames: string[] | null;
  allowedValues: any[] | null;
  nestedValues: Record<string, Validator> | null;
  itemValidator: Validator | null;
  alternativeValidators: Validator[] | null;
  rangeValues: RangeValues | null;
  isEnum: boolean;
  errorMessage: string;
  errorMessages: string[];
  getErrorMessage(v?: any): string;
  orEqual(value: any): Validator;
  orOneOf(valueArray: any[]): Validator;
  or(validator: Validator): Validator;
  withMessage(message: string): Validator;
  appendMessage(message: string): Validator;
  prependMessage(message: string): Validator;
  withCustomName(customName: string): Validator;
}

interface ValidatorDefinition {
  validator: (...args: any[]) => Predicate;
  message: (...args: any[]) => string;
}

const typeValidatorDefinitions = {
  boolean: {
    validator: () => v => v === true || v === false,
    message: () => "should be a boolean"
  },
  number: {
    validator: () => v => v !== undefined && (typeof v === "number" || v instanceof Number) && isFinite(v as number),
    message: () => "should be a number"
  },
  string: {
    validator: () => v => v !== undefined && (typeof v === "string" || v instanceof String),
    message: () => "should be a string"
  },
  array: {
    validator: () => v => Array.isArray(v),
    message: () => "should be an array"
  },
  object: {
    validator: () => v => v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v),
    message: () => "should be an object"
  },
  any: {
    validator: () => _v => true,
    message: () => "should be any value"
  }
} satisfies Record<string, ValidatorDefinition>;

const typeValidators = {} as Record<keyof typeof typeValidatorDefinitions, Predicate>; // convenience for use in other validators...
const typeValidatorKeys = Object.keys(typeValidatorDefinitions) as Array<keyof typeof typeValidatorDefinitions>;
typeValidatorKeys.forEach(typeValidatorKey => {
  typeValidators[typeValidatorKey] = typeValidatorDefinitions[typeValidatorKey].validator();
});

export { typeValidators };

// SameValueZero, the equality Array.prototype.includes uses: NaN equals NaN (a strict === never matches it), and 0 still equals -0
const sameValue = (a: any, b: any): boolean => a === b || (a !== a && b !== b);

// seen: the objects on the current path, so a self-referencing value prints [Circular] instead of overflowing the stack
const printAny = (value: any, recurse?: boolean, seen: Set<object> = new Set()): string => {
  if (recurse === false) {
    return value;
  } else if (typeof value === "object" && value !== null && seen.has(value)) {
    return "[Circular]";
  } else if (typeof value === "number") {
    // JSON.stringify prints NaN and the infinities as null
    return String(value);
  } else if (value === undefined) {
    return "undefined";
  } else if (value === null) {
    return "null";
  } else if (Array.isArray(value)) {
    return printArray(value, recurse, seen);
  } else if (typeof value === "object") {
    return printNonPlainObject(value) ?? printObject(value, recurse, seen);
  } else if (typeof value === "function") {
    // the name only, since string-coercing a function inlines its whole source
    return value.name ? "function " + value.name : "an anonymous function";
  } else if (typeof value === "symbol") {
    // JSON.stringify drops symbols entirely
    return String(value);
  } else if (typeof value === "bigint") {
    // the literal form, since JSON.stringify throws on a bigint and 1n must not read as 1
    return String(value) + "n";
  } else {
    return JSON.stringify(value);
  }
};
// Objects whose identity is not in their own keys would print as {  }: dates, regexps, boxed primitives and
// collections print by value, and any other keyless exotic by its constructor name. Null for a plain object.
const printNonPlainObject = (value: object): string | null => {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  } else if (value instanceof RegExp) {
    return String(value);
  } else if (value instanceof Number || value instanceof String || value instanceof Boolean) {
    return printAny(value.valueOf());
  } else if (value instanceof Map) {
    return "Map " + printArray(Array.from(value.entries()));
  } else if (value instanceof Set) {
    return "Set " + printArray(Array.from(value.values()));
  } else if (Object.keys(value).length === 0) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype && typeof proto.constructor === "function" && proto.constructor.name) {
      return proto.constructor.name + " {  }";
    }
  }
  return null;
};
const withSeen = (seen: Set<object>, value: object): Set<object> => new Set(seen).add(value);
// a getter that throws must not turn a validation message into an exception
const readMember = (object: Record<string, any>, key: string): { value?: any; unreadable?: boolean } => {
  try {
    return { value: object[key] };
  } catch {
    return { unreadable: true };
  }
};
const printArray = (array: any[], recurse?: boolean, seen: Set<object> = new Set()): string => {
  const path = withSeen(seen, array);
  return "[ " + array.map(value => printAny(value, recurse, path)).join(", ") + " ]";
};
const printObject = (object: Record<string, any>, recurse?: boolean, seen: Set<object> = new Set()): string => {
  const path = withSeen(seen, object);
  return "{ " +
    Object.keys(object)
      .map(key => {
        const member = readMember(object, key);
        return key + ": " + (member.unreadable ? "[Unreadable]" : printAny(member.value, recurse, path));
      })
      .join(", ") +
    " }";
};

const colorHexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const colorRGBARegex = /^(rgba\()(.*)(\))$/;
const colorRGBRegex = /^(rgb\()(.*)(\))$/;
const colorThreeDigitRegex = /^[0-9]{1,3}$/;
const colorAlphaRegex = /^(0(\.\d+)?|\.\d+|1(\.0+)?)$/; // CSS allows the leading-zero-less ".5" form

// The canonical ISO-8601 pattern, kept byte-identical to its upstream form. Its
// redundant escapes are harmless, and rewriting a regex this dense for cosmetics
// is pure downside.
// eslint-disable-next-line no-useless-escape
const dateISORegex = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

// standalone so dateInstance and dateAny can share it without a circular reference to customTypeValidators
const isValidDate: Predicate = v => v instanceof Date && isFinite(v.getTime());
// the regex admits ISO forms (week and ordinal dates) that Date cannot parse, so require both
const isDateString: Predicate = v => typeValidators.string(v) && dateISORegex.test(v) && isFinite(new Date(v).getTime());

const customTypeValidatorDefinitions = {
  numeric: {
    // scalar gate first: the global isFinite coerces, so arrays like [5] used to pass
    validator: () => v =>
      (typeValidators.number(v) || (typeValidators.string(v) && v.trim() !== "")) && Number.isFinite(Number(v)),
    message: () => "should be numeric"
  },
  integer: {
    validator: () => v => typeValidators.number(v) && v % 1 === 0,
    message: () => "should be an integer"
  },
  color: {
    validator: () => v => {
      if (!typeValidators.string(v)) {
        return false;
      }
      if (colorHexRegex.test(v)) {
        return true;
      }
      let matches = v.match(colorRGBARegex);
      if (matches !== null) {
        const parts = matches[2].split(",");
        if (parts.length === 4) {
          for (let i = 0; i < 3; i++) {
            const part = parts[i].trim();
            if (colorThreeDigitRegex.test(part) === false) {
              return false;
            }
            const rgb = parseInt(part, 10);
            if (rgb < 0 || rgb > 255) {
              return false;
            }
          }
          const alpha = parts[3].trim();
          if (colorAlphaRegex.test(alpha) === false) {
            return false;
          }
          return true;
        }
      }
      matches = v.match(colorRGBRegex);
      if (matches !== null) {
        const parts = matches[2].split(",");
        if (parts.length === 3) {
          for (let i = 0; i < 3; i++) {
            const part = parts[i].trim();
            if (colorThreeDigitRegex.test(part) === false) {
              return false;
            }
            const rgb = parseInt(part, 10);
            if (rgb < 0 || rgb > 255) {
              return false;
            }
          }
          return true;
        }
      }
      return false;
    },
    message: () => "should be a valid color"
  },
  dateInstance: {
    validator: () => isValidDate,
    message: () => "should be a valid Date instance"
  },
  dateISO: {
    validator: () => isDateString,
    message: () => "should be an iso date string"
  },
  datePrimitive: {
    validator: () => v => typeValidators.number(v) || isDateString(v),
    message: () => "should be an iso date string or epoch number"
  },
  dateAny: {
    validator: () => v => typeValidators.number(v) || isValidDate(v) || isDateString(v),
    message: () => "should be a Date instance, iso date string, or epoch number"
  }
} satisfies Record<string, ValidatorDefinition>;

const customTypeValidators = {} as Record<keyof typeof customTypeValidatorDefinitions, Predicate>; // convenience for use in other validators...
const customTypeValidatorKeys = Object.keys(customTypeValidatorDefinitions) as Array<
  keyof typeof customTypeValidatorDefinitions
>;
customTypeValidatorKeys.forEach(customTypeValidatorKey => {
  customTypeValidators[customTypeValidatorKey] = customTypeValidatorDefinitions[customTypeValidatorKey].validator();
});

export { customTypeValidators };

// clone, and reset lastIndex per test: /g and /y regexes are stateful and would alternate results
const regexpTester = (regex: RegExp): ((v: string) => boolean) => {
  const testRegex = new RegExp(regex.source, regex.flags);
  return v => {
    testRegex.lastIndex = 0;
    return testRegex.test(v);
  };
};

const argumentTypeValidatorDefinitions = {
  instanceOf: {
    validator: (type: new (...args: any[]) => any) => v => v instanceof type,
    // the name only, since string-coercing a constructor inlines its whole source
    message: (type: new (...args: any[]) => any) => "should be an instanceof " + (type.name || "the given class")
  },
  typeOf: {
    validator: (type: string) => v => typeof v === type,
    message: (type: string) => "should have typeof " + type
  },
  custom: {
    validator: (validator: CustomValidator) => v => validator(v),
    message: (validator: CustomValidator) =>
      validator.message ? validator.message : "should be valid with the custom validator"
  },
  numberMin: {
    validator: (min: number) => v => typeValidators.number(v) && v >= min,
    message: (min: number) => "should be a number >= to " + min
  },
  numberMax: {
    validator: (max: number) => v => typeValidators.number(v) && v <= max,
    message: (max: number) => "should be a number <= to " + max
  },
  numberMinMax: {
    validator: (min: number, max: number) => v => typeValidators.number(v) && v >= min && v <= max,
    message: (min: number, max: number) => "should be a number >= to " + min + " and <= " + max
  },
  numericMin: {
    validator: (min: number) => v => customTypeValidators.numeric(v) && v >= min,
    message: (min: number) => "should be numeric and >= to " + min
  },
  numericMax: {
    validator: (max: number) => v => customTypeValidators.numeric(v) && v <= max,
    message: (max: number) => "should be numeric and <= to " + max
  },
  numericMinMax: {
    validator: (min: number, max: number) => v => customTypeValidators.numeric(v) && v >= min && v <= max,
    message: (min: number, max: number) => "should be numeric and >= to " + min + " and <= " + max
  },
  integerMin: {
    validator: (min: number) => v => customTypeValidators.integer(v) && v >= min,
    message: (min: number) => "should be an integer and >= to " + min
  },
  integerMax: {
    validator: (max: number) => v => customTypeValidators.integer(v) && v <= max,
    message: (max: number) => "should be an integer and <= to " + max
  },
  integerMinMax: {
    validator: (min: number, max: number) => v => customTypeValidators.integer(v) && v >= min && v <= max,
    message: (min: number, max: number) => "should be an integer and >= to " + min + " and <= " + max
  },
  regexp: {
    validator: (regex: RegExp) => {
      const test = regexpTester(regex);
      return v => (typeValidators.string(v) || typeValidators.number(v)) && test(String(v));
    },
    message: (regex: RegExp) => "should match regex " + regex
  },
  stringRegexp: {
    validator: (regex: RegExp) => {
      const test = regexpTester(regex);
      return v => typeValidators.string(v) && test(v);
    },
    message: (regex: RegExp) => "should be a string matching regex " + regex
  },
  stringWithLength: {
    validator: (length: number) => v => typeValidators.string(v) && v.length === length,
    message: (length: number) => "should be a string with length " + length
  },
  stringWithLengthMin: {
    validator: (minLength: number) => v => typeValidators.string(v) && v.length >= minLength,
    message: (minLength: number) => "should be a string with length >= to " + minLength
  },
  stringWithLengthMax: {
    validator: (maxLength: number) => v => typeValidators.string(v) && v.length <= maxLength,
    message: (maxLength: number) => "should be a string with length <= to " + maxLength
  },
  stringWithLengthMinMax: {
    validator: (minLength: number, maxLength: number) => v =>
      typeValidators.string(v) && v.length >= minLength && v.length <= maxLength,
    message: (minLength: number, maxLength: number) =>
      "should be a string with length >= to " + minLength + " and <= to " + maxLength
  },
  equal: {
    validator: (value: any) => v => sameValue(v, value),
    message: (value: any) => "should be equal to " + printAny(value)
  },
  oneOf: {
    validator: (valueArray: any[]) => v => valueArray.includes(v),
    message: (valueArray: any[]) => "should be one of " + printArray(valueArray)
  },
  oneIn: {
    // own-key check: prototype members (constructor, toString, ...) must not count as map entries
    validator: (valueMap: Record<string, any>) => v => Object.prototype.hasOwnProperty.call(valueMap, v) && valueMap[v] !== undefined,
    message: (valueMap: Record<string, any>) => "should be in " + printObject(valueMap)
  },
  notEqual: {
    validator: (value: any) => v => !sameValue(v, value),
    message: (value: any) => "should not be equal to " + printAny(value)
  },
  notOneOf: {
    validator: (valueArray: any[]) => v => !valueArray.includes(v),
    message: (valueArray: any[]) => "should not be one of " + printArray(valueArray)
  },
  notOneIn: {
    validator: (valueMap: Record<string, any>) => v => !Object.prototype.hasOwnProperty.call(valueMap, v) || valueMap[v] === undefined,
    message: (valueMap: Record<string, any>) => "should not be in " + printObject(valueMap)
  },
  arrayWithLength: {
    validator: (length: number) => v => typeValidators.array(v) && v.length === length,
    message: (length: number) => "should be an array with length " + length
  },
  arrayWithLengthMin: {
    validator: (minLength: number) => v => typeValidators.array(v) && v.length >= minLength,
    message: (minLength: number) => "should be an array with length >= to " + minLength
  },
  arrayWithLengthMax: {
    validator: (maxLength: number) => v => typeValidators.array(v) && v.length <= maxLength,
    message: (maxLength: number) => "should be an array with length <= to " + maxLength
  },
  arrayWithLengthMinMax: {
    validator: (minLength: number, maxLength: number) => v =>
      typeValidators.array(v) && v.length >= minLength && v.length <= maxLength,
    message: (minLength: number, maxLength: number) =>
      "should be an array with length >= to " + minLength + " and <= to " + maxLength
  }
} satisfies Record<string, ValidatorDefinition>;

const compoundValidatorDefinitions = {
  arrayOf: {
    validator: (elementValidator: Validator, allowEmpty: boolean = false) => v => {
      if (!typeValidators.array(v) || (v.length === 0 && allowEmpty === false)) {
        return false;
      }
      // by index, not some(): holes in a sparse array are skipped by some() yet read as undefined
      for (let i = 0; i < v.length; i++) {
        if (!elementValidator(v[i])) {
          return false;
        }
      }
      return true;
    },
    message: (elementValidator: Validator, allowEmpty: boolean = false) =>
      "should be " + (allowEmpty ? "an" : "a non-empty") + " array with elements that " + elementValidator.errorMessage
  },
  objectWith: {
    validator: (properties: string[], propertyValidator: Validator) => v => {
      if (!typeValidators.object(v) || Object.keys(v).length !== properties.length) {
        return false;
      }
      const propertyMap: Record<string, string> = Object.create(null); // null proto: probed with user keys (__proto__, constructor, ...)
      properties.forEach(property => {
        propertyMap[property] = property;
      });
      // membership check too: same-sized objects with wrong keys must not pass
      const someInvalid = Object.keys(v).some(valueKey => {
        if (propertyMap[valueKey] === undefined || !propertyValidator(v[valueKey])) {
          return true;
        }
        return false;
      });
      return !someInvalid;
    },
    message: (properties: string[], propertyValidator: Validator) =>
      "should be an object with properties " +
      printArray(properties) +
      " all of which " +
      propertyValidator.errorMessage
  },
  objectWithSome: {
    validator: (properties: string[], propertyValidator: Validator) => v => {
      if (!typeValidators.object(v)) {
        return false;
      }
      const valueKeys = Object.keys(v);
      if (valueKeys.length === 0 || valueKeys.length > properties.length) {
        return false;
      }
      const propertyMap: Record<string, string> = Object.create(null); // null proto: probed with user keys (__proto__, constructor, ...)
      properties.forEach(property => {
        propertyMap[property] = property;
      });
      const someInvalid = valueKeys.some(valueKey => {
        // present but undefined counts as "not specified", like partialObjectWithShape and this validator's own nestedValues
        if (propertyMap[valueKey] === undefined || (v[valueKey] !== undefined && !propertyValidator(v[valueKey]))) {
          return true;
        }
        return false;
      });
      return !someInvalid;
    },
    message: (properties: string[], propertyValidator: Validator) =>
      "should be an object with some properties " +
      printArray(properties) +
      " all of which " +
      propertyValidator.errorMessage
  },
  objectWithShape: {
    validator: (propertyToValidatorMap: Record<string, Validator>, allowExtraProperties: boolean = false) => v => {
      if (!typeValidators.object(v)) {
        return false;
      }
      const shapeKeys = Object.keys(propertyToValidatorMap);
      let someInvalid = shapeKeys.some(shapeKey => {
        if (!propertyToValidatorMap[shapeKey](v[shapeKey])) {
          return true;
        }
        return false;
      });
      if (!someInvalid && !allowExtraProperties) {
        const valueKeys = Object.keys(v);
        someInvalid = valueKeys.some(valueKey => {
          // own-key check: prototype member names (constructor, ...) are not part of the shape
          if (!Object.prototype.hasOwnProperty.call(propertyToValidatorMap, valueKey)) {
            return true;
          }
          return false;
        });
      }
      return !someInvalid;
    },
    message: (propertyToValidatorMap: Record<string, Validator>, allowExtraProperties: boolean = false) => {
      const validatorMessageMap: Record<string, string> = {};
      const shapePropertyKeys = Object.keys(propertyToValidatorMap);
      shapePropertyKeys.forEach(shapePropertyKey => {
        validatorMessageMap[shapePropertyKey] = propertyToValidatorMap[shapePropertyKey].errorMessage;
      });
      return (
        "should be an object with" +
        (allowExtraProperties ? "" : " exact") +
        " properties " +
        printObject(validatorMessageMap, false)
      );
    }
  },
  partialObjectWithShape: {
    validator: (propertyToValidatorMap: Record<string, Validator>, allowExtraProperties: boolean = false) => v => {
      if (!typeValidators.object(v) || Array.isArray(v)) {
        return false;
      }
      const valueKeys = Object.keys(v);
      const someInvalid = valueKeys.some(valueKey => {
        // own-key check: prototype member names (constructor, ...) must count as unknown, not resolve to functions
        const propertyValidator = Object.prototype.hasOwnProperty.call(propertyToValidatorMap, valueKey) ? propertyToValidatorMap[valueKey] : undefined;
        if (propertyValidator === undefined) {
          // an unknown property is invalid unless extras were opted into
          return !allowExtraProperties;
        }
        // present but undefined counts as "not specified", so only a real value has to validate
        return v[valueKey] !== undefined && !propertyValidator(v[valueKey]);
      });
      return !someInvalid;
    },
    message: (propertyToValidatorMap: Record<string, Validator>, allowExtraProperties: boolean = false) => {
      const validatorMessageMap: Record<string, string> = {};
      const shapePropertyKeys = Object.keys(propertyToValidatorMap);
      shapePropertyKeys.forEach(shapePropertyKey => {
        validatorMessageMap[shapePropertyKey] = propertyToValidatorMap[shapePropertyKey].errorMessage;
      });
      return (
        "should be an object with any of the" +
        (allowExtraProperties ? "" : " exact") +
        " properties " +
        printObject(validatorMessageMap, false)
      );
    }
  },
  or: {
    validator: (validators: Validator[]) => v => validators.some(validator => validator(v)),
    message: (validators: Validator[]) =>
      "should be true for one of " + printArray(validators.map(validator => validator.errorMessage))
  },
  and: {
    validator: (validators: Validator[]) => v => !validators.some(validator => !validator(v)),
    message: (validators: Validator[]) =>
      "should be true for all of " + printArray(validators.map(validator => validator.errorMessage))
  },
  not: {
    validator: (validator: Validator) => v => !validator(v),
    message: (validator: Validator) => "should be false for " + validator.errorMessage
  }
} satisfies Record<string, ValidatorDefinition>;

const validatorArgsToAllowedValues: Record<string, (...args: any[]) => any[] | null> = {
  equal: value => [value],
  oneOf: values => values,
  // only keys with a defined value: the predicate reads an undefined value as absent
  oneIn: valueMap => Object.keys(valueMap).filter(key => valueMap[key] !== undefined),
  or: validators => {
    let allowedValues: any[] | null = null;
    validators.forEach((validator: Validator) => {
      if (validator.allowedValues !== null) {
        if (allowedValues === null) {
          allowedValues = validator.allowedValues.slice();
        } else {
          allowedValues = allowedValues.concat(validator.allowedValues);
        }
      }
    });
    return allowedValues;
  }
};

const validatorArgsToNestedValues: Record<string, (...args: any[]) => Record<string, Validator>> = {
  objectWith: (properties: string[], propertyValidator: Validator) => {
    const propertyToValidatorMap: Record<string, Validator> = {};
    properties.forEach(property => {
      propertyToValidatorMap[property] = propertyValidator;
    });
    return propertyToValidatorMap;
  },
  objectWithSome: (properties: string[], propertyValidator: Validator) => {
    const propertyToValidatorMap: Record<string, Validator> = {};
    if (propertyValidator.allowedValues === null || propertyValidator.allowedValues.indexOf(undefined) === -1) {
      propertyValidator = propertyValidator.orEqual(undefined);
    }
    properties.forEach(property => {
      propertyToValidatorMap[property] = propertyValidator;
    });
    return propertyToValidatorMap;
  },
  objectWithShape: (propertyToValidatorMap: Record<string, Validator>) => propertyToValidatorMap,
  partialObjectWithShape: (propertyToValidatorMap: Record<string, Validator>) => propertyToValidatorMap
};

const validatorArgsToItemValidator: Record<string, (...args: any[]) => Validator> = {
  arrayOf: (elementValidator: Validator) => elementValidator
};

const validatorArgsToAlternativeValidators: Record<string, (...args: any[]) => Validator[]> = {
  or: (theValidators: Validator[]) => theValidators
};

const minRangeValues = (min: number): RangeValues => ({ min });
const maxRangeValues = (max: number): RangeValues => ({ max });
const minMaxRangeValues = (min: number, max: number): RangeValues => ({ min, max });

const validatorArgsToRangeValues: Record<string, (...args: any[]) => RangeValues> = {
  numberMin: minRangeValues,
  numberMax: maxRangeValues,
  numberMinMax: minMaxRangeValues,
  numericMin: minRangeValues,
  numericMax: maxRangeValues,
  numericMinMax: minMaxRangeValues,
  integerMin: minRangeValues,
  integerMax: maxRangeValues,
  integerMinMax: minMaxRangeValues
};

const validatorArgsToIsEnum: Record<string, (...args: any[]) => boolean> = {
  equal: _value => true,
  oneOf: _values => true,
  oneIn: _valueMap => true,
  or: validators => !validators.some((validator: Validator) => !validator.isEnum)
};

// explicit: Object.assign with 4+ sources falls through to the any-returning overload
type ValidatorDefinitionMap = typeof typeValidatorDefinitions & typeof customTypeValidatorDefinitions &
  typeof argumentTypeValidatorDefinitions & typeof compoundValidatorDefinitions;

const validatorDefinitions: ValidatorDefinitionMap = Object.assign(
  {},
  typeValidatorDefinitions,
  customTypeValidatorDefinitions,
  argumentTypeValidatorDefinitions,
  compoundValidatorDefinitions
);

export type Validators = {
  [K in keyof ValidatorDefinitionMap]: (...args: Parameters<ValidatorDefinitionMap[K]["validator"]>) => Validator;
} & {
  conditional(rules: ConditionalRule[], object: any): Validator;
};

const validatorDefinitionKeys = Object.keys(validatorDefinitions);

const validatorExtensionDefinitions: Record<string, ValidatorDefinition> = {
  orEqual: {
    validator: (value: any) => v => sameValue(v, value),
    message: (value: any) => " or be equal to " + printAny(value)
  },
  orOneOf: {
    validator: (valueArray: any[]) => v => valueArray.includes(v),
    message: (valueArray: any[]) => " or be one of " + printArray(valueArray)
  },
  or: {
    validator: (validator: Validator) => v => validator(v),
    message: (validator: Validator) => " or " + validator.errorMessage
  }
};

const validatorExtensionArgsToAllowedValues: Record<string, (...args: any[]) => any[] | null> = {
  orEqual: value => [value],
  orOneOf: values => values,
  or: validator => validator.allowedValues
};

const validatorExtensionArgsToIsEnum: Record<string, (...args: any[]) => boolean> = {
  orEqual: _value => true,
  orOneOf: _values => true,
  or: validator => validator.isEnum
};

const validatorExtensionKeys = Object.keys(validatorExtensionDefinitions);

const appendValue = (message: string, v?: any): string => message + ": " + printAny(v);

const validatorMessageExtensions: Record<string, (messageValidatorFunction: Validator, message: string) => void> = {
  withMessage: (messageValidatorFunction, message) => {
    messageValidatorFunction.errorMessage = message;
    messageValidatorFunction.errorMessages = [messageValidatorFunction.errorMessage];
  },
  appendMessage: (messageValidatorFunction, message) => {
    messageValidatorFunction.errorMessage = messageValidatorFunction.errorMessage + message;
    messageValidatorFunction.errorMessages = [messageValidatorFunction.errorMessage];
  },
  prependMessage: (messageValidatorFunction, message) => {
    messageValidatorFunction.errorMessage = message + messageValidatorFunction.errorMessage;
    messageValidatorFunction.errorMessages = [messageValidatorFunction.errorMessage];
  }
};

const validatorMessageExtensionKeys = Object.keys(validatorMessageExtensions);

function addExtensions(validatorFunction: Validator): void {
  validatorMessageExtensionKeys.forEach(messageExtensionKey => {
    (validatorFunction as any)[messageExtensionKey] = (message: string): Validator => {
      const messageValidatorFunction = ((v?: any) => validatorFunction(v)) as Validator;
      messageValidatorFunction.validatorName = validatorFunction.validatorName;
      messageValidatorFunction.extensionNames = validatorFunction.extensionNames;
      messageValidatorFunction.customName = validatorFunction.customName;
      messageValidatorFunction.allowedValues = validatorFunction.allowedValues;
      messageValidatorFunction.isEnum = validatorFunction.isEnum;
      messageValidatorFunction.nestedValues = validatorFunction.nestedValues;
      messageValidatorFunction.itemValidator = validatorFunction.itemValidator;
      messageValidatorFunction.alternativeValidators = validatorFunction.alternativeValidators;
      messageValidatorFunction.rangeValues = validatorFunction.rangeValues;
      messageValidatorFunction.errorMessage = validatorFunction.errorMessage;
      messageValidatorFunction.errorMessages = validatorFunction.errorMessages;
      validatorMessageExtensions[messageExtensionKey](messageValidatorFunction, message);
      messageValidatorFunction.getErrorMessage = v => appendValue(messageValidatorFunction.errorMessage, v);
      addExtensions(messageValidatorFunction);
      return messageValidatorFunction;
    };
  });
  validatorExtensionKeys.forEach(extensionKey => {
    (validatorFunction as any)[extensionKey] = (...args: any[]): Validator => {
      const extensionFunction = ((v?: any) =>
        validatorFunction(v) || validatorExtensionDefinitions[extensionKey].validator(...args)(v)) as Validator;
      extensionFunction.validatorName = validatorFunction.validatorName;
      if (validatorFunction.extensionNames === null) {
        extensionFunction.extensionNames = [extensionKey];
      } else {
        extensionFunction.extensionNames = validatorFunction.extensionNames.concat(extensionKey);
      }
      extensionFunction.customName = validatorFunction.customName;
      extensionFunction.allowedValues = validatorFunction.allowedValues;
      extensionFunction.isEnum = false;
      extensionFunction.nestedValues = validatorFunction.nestedValues;
      extensionFunction.itemValidator = validatorFunction.itemValidator;
      extensionFunction.alternativeValidators = extensionKey === "or"
        ? (validatorFunction.alternativeValidators ?? [validatorFunction]).concat(args[0])
        : validatorFunction.alternativeValidators;
      extensionFunction.rangeValues = validatorFunction.rangeValues;
      if (validatorExtensionArgsToAllowedValues[extensionKey] !== undefined) {
        const extensionAllowedValues = validatorExtensionArgsToAllowedValues[extensionKey](...args);
        extensionFunction.isEnum = validatorFunction.isEnum && validatorExtensionArgsToIsEnum[extensionKey](...args);
        if (extensionAllowedValues !== null) {
          if (typeValidators.array(validatorFunction.allowedValues)) {
            extensionFunction.allowedValues = validatorFunction.allowedValues!.concat(extensionAllowedValues);
          } else {
            extensionFunction.allowedValues = extensionAllowedValues;
          }
        }
      }
      extensionFunction.errorMessage =
        validatorFunction.errorMessage + validatorExtensionDefinitions[extensionKey].message(...args);
      extensionFunction.errorMessages = [extensionFunction.errorMessage];
      extensionFunction.getErrorMessage = v => appendValue(extensionFunction.errorMessage, v);
      addExtensions(extensionFunction);
      return extensionFunction;
    };
  });

  validatorFunction.withCustomName = (customName: string): Validator => {
    const customNameFunction = ((v?: any) => validatorFunction(v)) as Validator;
    customNameFunction.validatorName = validatorFunction.validatorName;
    customNameFunction.extensionNames = validatorFunction.extensionNames;
    customNameFunction.customName = customName;
    customNameFunction.allowedValues = validatorFunction.allowedValues;
    customNameFunction.isEnum = validatorFunction.isEnum;
    customNameFunction.nestedValues = validatorFunction.nestedValues;
    customNameFunction.itemValidator = validatorFunction.itemValidator;
    customNameFunction.alternativeValidators = validatorFunction.alternativeValidators;
    customNameFunction.rangeValues = validatorFunction.rangeValues;
    customNameFunction.errorMessage = validatorFunction.errorMessage;
    customNameFunction.errorMessages = validatorFunction.errorMessages;
    customNameFunction.getErrorMessage = v => appendValue(customNameFunction.errorMessage, v);
    addExtensions(customNameFunction);
    return customNameFunction;
  };
}

const validators = {} as Validators;
validatorDefinitionKeys.forEach(validatorKey => {
  (validators as any)[validatorKey] = (...args: any[]): Validator => {
    const validatorFunction = (validatorDefinitions as Record<string, ValidatorDefinition>)[validatorKey].validator(
      ...args
    ) as Validator;
    validatorFunction.validatorName = validatorKey;
    validatorFunction.customName = null;
    validatorFunction.extensionNames = null;
    validatorFunction.allowedValues = null;
    validatorFunction.nestedValues = null;
    validatorFunction.itemValidator = null;
    validatorFunction.alternativeValidators = null;
    validatorFunction.rangeValues = null;
    validatorFunction.isEnum = false;
    if (validatorArgsToAllowedValues[validatorKey] !== undefined) {
      validatorFunction.allowedValues = validatorArgsToAllowedValues[validatorKey](...args);
      validatorFunction.isEnum = validatorArgsToIsEnum[validatorKey](...args);
    }
    if (validatorArgsToNestedValues[validatorKey] !== undefined) {
      validatorFunction.nestedValues = validatorArgsToNestedValues[validatorKey](...args);
    }
    if (validatorArgsToItemValidator[validatorKey] !== undefined) {
      validatorFunction.itemValidator = validatorArgsToItemValidator[validatorKey](...args);
    }
    if (validatorArgsToAlternativeValidators[validatorKey] !== undefined) {
      validatorFunction.alternativeValidators = validatorArgsToAlternativeValidators[validatorKey](...args);
    }
    if (validatorArgsToRangeValues[validatorKey] !== undefined) {
      validatorFunction.rangeValues = validatorArgsToRangeValues[validatorKey](...args);
    }
    validatorFunction.errorMessage = (validatorDefinitions as Record<string, ValidatorDefinition>)[
      validatorKey
    ].message(...args);
    validatorFunction.errorMessages = [validatorFunction.errorMessage];
    validatorFunction.getErrorMessage = v => appendValue(validatorFunction.errorMessage, v);
    addExtensions(validatorFunction);
    return validatorFunction;
  };
});
const appendSuffix = (message: string, suffix?: string): string =>
  suffix !== undefined ? message + " " + suffix : message;

validators.conditional = (rules: ConditionalRule[], object: any): Validator => {
  const matchedRule = rules.find(rule => rule.condition(object));
  // No matched rule fails validation with every rule's message rather than crashing at construction.
  const validatorFunction = ((v?: any) => matchedRule !== undefined && matchedRule.validator(v)) as Validator;
  validatorFunction.validatorName = "conditional";
  validatorFunction.customName = null;
  validatorFunction.extensionNames = null;
  validatorFunction.allowedValues = null;
  validatorFunction.nestedValues = null;
  validatorFunction.itemValidator = null;
  validatorFunction.alternativeValidators = rules.map(rule => rule.validator);
  validatorFunction.rangeValues = null;
  validatorFunction.isEnum = false;
  validatorFunction.errorMessages = rules.map(rule => appendSuffix(rule.validator.errorMessage, rule.suffix));
  validatorFunction.errorMessage = matchedRule !== undefined
    ? appendSuffix(matchedRule.validator.errorMessage, matchedRule.suffix)
    : (validatorFunction.errorMessages.join(" or ") || "no conditional rule matched");
  validatorFunction.getErrorMessage = v => appendValue(validatorFunction.errorMessage, v);
  addExtensions(validatorFunction);
  return validatorFunction;
};

export default validators;
