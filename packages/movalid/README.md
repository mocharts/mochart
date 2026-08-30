# @mochart/movalid

Simple yet powerful TypeScript validators with chainable extensions and
human-readable error messages.

Every validator is a factory: calling `validators.number()` returns a plain
predicate function `(value) => boolean` that also carries metadata —
`errorMessage`, `getErrorMessage(value)`, `allowedValues`, `rangeValues`,
`nestedValues`, and `isEnum` — so callers can both check values and report
readable errors. [@mochart/core](../mochart/README.md) uses it for config
validation.

## Usage

```js
import validators from '@mochart/movalid';

const isRenderer = validators.oneOf(['bar', 'line', 'area']).orEqual(undefined);

isRenderer('bar');        // true
isRenderer('pie');        // false
isRenderer.errorMessage;  // 'should be one of [ "bar", "line", "area" ] or be equal to undefined'
isRenderer.getErrorMessage('pie');
// 'should be one of [ "bar", "line", "area" ] or be equal to undefined: "pie"'
```

## Validators

All are called as `validators.name(...args)`:

- **Types** — `boolean`, `number`, `string`, `array`, `object`, `any`
- **Custom types** — `numeric`, `integer`, `color` (hex/rgb/rgba),
  `dateInstance` (a valid `Date` object), `dateISO` (iso date string),
  `datePrimitive` (iso date string or epoch number), `dateAny` (any of the three)
- **Instances** — `instanceOf(Class)`, `typeOf('object')`, `custom(fn)` (give
  `fn` a `message` property)
- **Ranges** — `numberMin/Max/MinMax`, `numericMin/Max/MinMax`,
  `integerMin/Max/MinMax`
- **Strings** — `regexp(re)` (a number is stringified and matched too),
  `stringRegexp(re)` (text only), `stringWithLength(n)`,
  `stringWithLengthMin/Max/MinMax`
- **Values** — `equal(v)`, `oneOf([...])`, `oneIn({...})`, `notEqual(v)`,
  `notOneOf([...])`, `notOneIn({...})`
- **Arrays** — `arrayWithLength(n)`, `arrayWithLengthMin/Max/MinMax`,
  `arrayOf(validator, allowEmpty)`
- **Objects** — `objectWith(properties, validator)`,
  `objectWithSome(properties, validator)`,
  `objectWithShape({ prop: validator, … }, allowExtraProperties)`,
  `partialObjectWithShape({ prop: validator, … }, allowExtraProperties)` (only
  the properties actually present have to pass, so it is the one to use for
  optional config objects)
- **Combinators** — `or([...validators])`, `and([...validators])`,
  `not(validator)`
- **Conditional** — `validators.conditional(rules, object)` picks the first
  rule whose `condition(object)` matches and uses its `validator`. A rule's
  optional `suffix` is appended to that validator's message, so it can say
  when the rule applies (`should be a number when type is a`). When no rule
  matches, the result rejects every value and its `errorMessage` is every
  rule's message joined with ` or ` (`no conditional rule matched` for an
  empty rule list)

The bare type predicates are also exported directly for convenience:

```js
import { typeValidators, customTypeValidators } from '@mochart/movalid';
typeValidators.string('hi'); // true
```

TypeScript types are exported as well: `Validator` (the predicate-with-metadata
shape returned by every factory), `Validators`, `CustomValidator`,
`ConditionalRule`, and `RangeValues`.

## Chainable extensions

Every validator can be extended, `conditional` included. Each extension returns
a new validator that can be extended in turn:

- `.orEqual(value)` / `.orOneOf([...])` / `.or(otherValidator)` — widen what
  passes and extend the error message
- `.withMessage(msg)` / `.appendMessage(msg)` / `.prependMessage(msg)` —
  override or decorate the error message without changing behavior
- `.withCustomName(name)` — set the `customName` metadata field, leaving both
  behavior and error message unchanged

```js
const size = validators.numberMin(0).orEqual('auto').withMessage('should be a size');
```

## Development

```sh
npm test -w @mochart/movalid
```

## License

MIT

## The `development` export condition

In this repository's manifest, the `exports` map has a `development` entry
pointing at this package's TypeScript sources; the repo's own dev servers,
tests and `tsx` scripts run the library from source through it. It never
reaches npm: publishing goes through `pnpm publish`, which replaces the map
with the dist-only `publishConfig.exports`, so installed copies of this
package always resolve the built `dist/`.
