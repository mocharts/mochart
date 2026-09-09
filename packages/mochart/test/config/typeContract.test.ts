// the config interfaces and the validators are two halves of one contract; the per-row tests pin known drift cases and the ratchet walks every section interface against its validators
import { describe, it, expect } from 'vitest';
import ts from 'typescript';

import type {
  ColorPaletteConfig, DeepPartial, GradientStop, MochartConfig, MochartInputConfig, PatternInputConfig, SeriesColor,
  SeriesConfig, Style, ValueAxisConfig, ValueAxisTick
} from '../../src';
import validateConfig, { configWithoutAllValidators } from '../../src/config/validation/mochartConfig';
import { getDefaults } from '../../src/config/defaults/mochartConfig';
import { buildConfigReference, getRuntimeSectionIds } from '../../scripts/configReferenceModel';
import { sectionInterfaceMap, typesPath } from '../../scripts/generateJsdoc';

const V = '1.0.0';

function errorsFor(config: MochartInputConfig): string[] {
  const defaults = getDefaults(config as never);
  return validateConfig(config, defaults as never).errors;
}

describe('category axis bounds accept the date forms the validators accept', () => {
  // the type had no string, so this literal was a compile error even though the validators accept it
  const config: MochartInputConfig = {
    version: V,
    categoryAxis: {
      property: 'c', type: 'date', scale: 'linear',
      min: '2020-01-01', max: '2021-01-01', softMin: '2020-02-01', softMax: '2020-12-01'
    },
    series: [{ property: 'v' }]
  };

  it('validates an ISO date string min/max/softMin/softMax', () => {
    expect(errorsFor(config)).toEqual([]);
  });

  it('still validates the timestamp form', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c', type: 'date', scale: 'linear', min: 1577836800000, max: 1609459200000 },
      series: [{ property: 'v' }]
    })).toEqual([]);
  });

  it('rejects a date string on a linear number axis, as before', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c', type: 'number', scale: 'linear', min: '2020-01-01' },
      series: [{ property: 'v' }]
    })).toContain('categoryAxis - min - should be a number or be equal to "auto" when scale is linear and type is number: "2020-01-01"');
  });
});

describe('value axis scale and type are the single values the validators accept', () => {
  it('rejects an ordinal scale at typecheck time', () => {
    const config: MochartInputConfig = {
      version: V,
      categoryAxis: { property: 'c' },
      // @ts-expect-error a value axis is always linear; the validator rejects anything else
      valueAxes: [{ id: 'A', scale: 'ordinal' }],
      series: [{ property: 'v' }]
    };
    expect(errorsFor(config)).toContain('valueAxes[0] - scale - should be equal to "linear": "ordinal"');
  });

  it('rejects a string type at typecheck time', () => {
    const config: MochartInputConfig = {
      version: V,
      categoryAxis: { property: 'c' },
      // @ts-expect-error a value axis is always numeric; the validator rejects anything else
      valueAxes: [{ id: 'A', type: 'string' }],
      series: [{ property: 'v' }]
    };
    expect(errorsFor(config)).toContain('valueAxes[0] - type - should be equal to "number": "string"');
  });

  it('accepts the two values it does allow', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c' },
      valueAxes: [{ id: 'A', scale: 'linear', type: 'number' }],
      series: [{ property: 'v' }]
    })).toEqual([]);
  });
});

describe('tooltip filteredValueCharacter takes the documented null', () => {
  it('validates null, the value the docs name for "no character"', () => {
    // the type was `string`, so this literal was a compile error
    const config: MochartInputConfig = {
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      tooltip: { filteredValueCharacter: null }
    };
    expect(errorsFor(config)).toEqual([]);
  });

  it('still rejects a multi-character string', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      tooltip: { filteredValueCharacter: '--' }
    })).toContain('tooltip - filteredValueCharacter - should be a string with length 1 or be equal to null: "--"');
  });
});

// stops is optional in the type on purpose (linearGradientDefaults may supply it) and required by validation, like categoryAxis.property and series.property
describe('gradient stops have no default and are required by validation', () => {
  it('reports an entry with no stops', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      linearGradients: [{ id: 'G' }]
    }).length).toBe(1);
  });

  it('accepts an entry whose stops come from linearGradientDefaults', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      linearGradientDefaults: { stops: [{ offset: 0, color: '#000000', opacity: 1 }] },
      linearGradients: [{ id: 'G' }]
    })).toEqual([]);
  });

  it('rejects an empty stops array', () => {
    expect(errorsFor({
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      radialGradients: [{ id: 'G', stops: [] }]
    }).length).toBe(1);
  });
});

// --- DeepPartial, checked at compile time -------------------------------------

type Extends<A, B> = A extends B ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T extends true>(_value?: T): void { /* compile-time only */ }
// NonNullable is T & {}, which collapses ColorMode | (string & {}) to string; Exclude keeps the union as declared
type Defined<T> = Exclude<T, undefined>;

/** A section's element type: the entry type of an array (or OneOrMany) section, the section itself otherwise. */
type SectionEntry<T> = Defined<T> extends infer U ? U extends readonly (infer E)[] ? E : U : never;

// every input section accepts the one-level Partial of its built section, so DeepPartial only ever
// accepts more than Partial did, never less (patterns is checked against its own input type below)
type SectionSupersets = {
  [K in Exclude<keyof MochartInputConfig & keyof MochartConfig, 'patterns'>]:
    Extends<Partial<SectionEntry<MochartConfig[K]>>, SectionEntry<MochartInputConfig[K]>>
};

describe('DeepPartial', () => {
  it('makes nested members optional without narrowing what Partial accepted', () => {
    expectType<Equal<SectionSupersets[keyof SectionSupersets], true>>();
    // patterns keeps its discriminator, so an entry that names nothing but its type is the partial it accepts
    expectType<Extends<Pick<PatternInputConfig, 'type'>, SectionEntry<MochartInputConfig['patterns']>>>();
    expectType<Extends<Partial<Style>, DeepPartial<Style>>>();
    expectType<Extends<{ backgroundStyle: { fillColor: 'red' } }, DeepPartial<{ backgroundStyle: Style }>>>();
    const nested: MochartInputConfig = {
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      chart: { backgroundStyle: { fillColor: 'red' } },
      seriesDefaults: { curve: { type: 'basis' } }
    };
    expect(errorsFor(nested)).toEqual([]);
  });

  it('keeps arrays as arrays of whole entries, so a partial entry is rejected at typecheck time', () => {
    // the runtime merge replaces an array wholesale, so its entries can never be filled in from a default
    expectType<Equal<DeepPartial<{ stops: GradientStop[] }>['stops'], GradientStop[] | undefined>>();
    expectType<Equal<DeepPartial<readonly string[]>, readonly string[]>>();
    expectType<Equal<Defined<Defined<DeepPartial<ColorPaletteConfig>['shape']>['normal']>['strokeColors'], string[] | undefined>>();
    expectType<Equal<DeepPartial<ValueAxisConfig>['ticks'], ValueAxisTick[] | null | undefined>>();
    const config: MochartInputConfig = {
      version: V,
      categoryAxis: { property: 'c' },
      series: [{ property: 'v' }],
      // @ts-expect-error a stop is a whole GradientStop; the validator rejects the missing members too
      linearGradients: [{ id: 'G', stops: [{ offset: 0 }] }]
    };
    expect(errorsFor(config)).toEqual([
      'linearGradients[0] - stops - should be a non-empty array with elements that should be an object with exact properties'
      + ' { offset: should be a number >= to 0 and <= 1, color: should be a valid color, opacity: should be a number >= to 0 and <= 1 }: [ { offset: 0 } ]'
    ]);
  });

  it('leaves the optionality an array entry declares for itself alone', () => {
    // a ThresholdConfig entry marks its own optional members, so those are optional and value is not
    const config: MochartInputConfig = {
      version: V,
      categoryAxis: { property: 'c', type: 'number', scale: 'linear', thresholds: [{ value: 1, style: { normal: { strokeColor: 'red' } } }] },
      series: [{ property: 'v' }]
    };
    expect(errorsFor(config)).toEqual([]);
    expect(errorsFor({
      version: V,
      // @ts-expect-error a threshold entry is a whole ThresholdConfig, so value is required
      categoryAxis: { property: 'c', type: 'number', scale: 'linear', thresholds: [{ front: true }] },
      series: [{ property: 'v' }]
    }).length).toBe(1);
  });

  it('leaves primitives alone, so ColorMode | (string & {}) keeps its literals and its free string', () => {
    expectType<Equal<DeepPartial<SeriesColor>, SeriesColor>>();
    expectType<Equal<DeepPartial<string | null>, string | null>>();
    expectType<Equal<DeepPartial<number | 'auto'>, number | 'auto'>>();
    type StrokeColor = Defined<Defined<Defined<Defined<DeepPartial<SeriesConfig>['marker']>['style']>['normal']>['strokeColor']>;
    expectType<Equal<StrokeColor, SeriesColor>>();
    expectType<Extends<'#ff0000', StrokeColor>>();
    expectType<Extends<'seriesIndex', StrokeColor>>();
  });

  // the modes the validators reject stay out of autocomplete: 'same' has nothing to inherit in the normal
  // state, and shapeStyle defines the series color so cannot reference it with 'series'
  it('offers only the modes each style state accepts', () => {
    type Modes<T> = Extract<T, 'series' | 'same' | 'seriesIndex' | 'categoryIndex'>;
    type ShapeNormal = Defined<Defined<Defined<DeepPartial<SeriesConfig>['shapeStyle']>['normal']>['fillColor']>;
    type ShapeFocused = Defined<Defined<Defined<DeepPartial<SeriesConfig>['shapeStyle']>['focused']>['fillColor']>;
    type MarkerNormal = Defined<Defined<Defined<Defined<DeepPartial<SeriesConfig>['marker']>['style']>['normal']>['fillColor']>;
    type MarkerFocused = Defined<Defined<Defined<Defined<DeepPartial<SeriesConfig>['marker']>['style']>['focused']>['fillColor']>;
    expectType<Equal<Modes<ShapeNormal>, 'seriesIndex' | 'categoryIndex'>>();
    expectType<Equal<Modes<ShapeFocused>, 'same' | 'seriesIndex' | 'categoryIndex'>>();
    expectType<Equal<Modes<MarkerNormal>, 'series' | 'seriesIndex' | 'categoryIndex'>>();
    expectType<Equal<Modes<MarkerFocused>, 'series' | 'same' | 'seriesIndex' | 'categoryIndex'>>();
    // any string still compiles: the validators, not the types, reject a mode out of place
    expectType<Extends<'series', ShapeNormal>>();
  });

  it('leaves functions alone rather than mapping them to an empty object', () => {
    type Format = (value: number) => string;
    expectType<Equal<DeepPartial<Format>, Format>>();
    expectType<Equal<DeepPartial<{ format: Format }>, { format?: Format }>>();
    // @ts-expect-error a function member is still a function, not an object that anything satisfies
    const notAFunction: DeepPartial<{ format: Format }> = { format: {} };
    expect(notAFunction).toBeDefined();
  });
});

// --- the general ratchet -----------------------------------------------------

// The category axis validators are conditional on type/scale, so they are evaluated under every
// combination: a value the type allows only has to be accepted by one of the branches.
const conditionConfigs: Record<string, Record<string, unknown>[]> = {
  categoryAxis: [
    { type: 'string', scale: 'ordinal' }, { type: 'number', scale: 'ordinal' }, { type: 'date', scale: 'ordinal' },
    { type: 'number', scale: 'linear' }, { type: 'date', scale: 'linear' }
  ]
};

// Free-string forms probed against the validators: one accepted here means the type must be able to
// express a string, which is how the date-string axis bounds were caught.
const stringProbes = ['2020-01-01', 'zzzz'];

// section.key -> why its optionality does not follow from having a default.
const optionalityExceptions: Record<string, string> = {
  'patterns.type': 'the pattern type is the required discriminator for each entry',
  'patterns.rotation': 'the default only applies to line and crosshatch patterns; dots do not have a rotation',
  'patterns.lineWidth': 'the default only applies to line and crosshatch patterns; dots do not have a line width',
  'patterns.radius': 'the default only applies to dot patterns; line and crosshatch patterns do not have a radius',
  'series.axis': 'the default only applies when there is exactly one value axis; with several, nothing is filled in',
  'seriesStacks.axis': 'the default only applies when there is exactly one value axis; with several, nothing is filled in'
};

function typeParts(type: ts.Type): ts.Type[] {
  return type.isUnion() ? type.types : [type];
}

function admitsString(part: ts.Type): boolean {
  return (part.flags & ts.TypeFlags.String) !== 0
    || (part.isIntersection() && part.types.some(inner => (inner.flags & ts.TypeFlags.String) !== 0));
}

describe('types agree with the validators', () => {
  const program = ts.createProgram([typesPath], {
    strict: true, noEmit: true, target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(typesPath)!;
  const declarations = new Map<string, ts.InterfaceDeclaration>();
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      declarations.set(statement.name.text, statement);
    }
  }
  const { model } = buildConfigReference();
  const inputDeclaration = declarations.get('MochartInputConfig')!;
  const inputType = checker.getTypeAtLocation(inputDeclaration);

  // a section's input entries: OneOrMany unwrapped to the entry union, so each discriminated branch is checked
  const inputEntryTypes = (sectionId: string): ts.Type[] => {
    const symbol = checker.getPropertyOfType(inputType, sectionId);
    if (symbol === undefined) {
      return [];
    }
    return typeParts(checker.getTypeOfSymbolAtLocation(symbol, inputDeclaration))
      .filter(part => (part.flags & ts.TypeFlags.Undefined) === 0)
      .flatMap(part => typeParts(part.getNumberIndexType() ?? part));
  };

  const mismatches: string[] = [];
  const checkedSections: string[] = [];
  for (const [sectionId, interfaceName] of Object.entries(sectionInterfaceMap)) {
    const declaration = declarations.get(interfaceName);
    if (declaration === undefined) {
      mismatches.push(sectionId + ': no interface named ' + interfaceName);
      continue;
    }
    checkedSections.push(sectionId);
    const section = configWithoutAllValidators[sectionId]!;
    const branches = (conditionConfigs[sectionId] ?? [{}])
      .map(condition => section.validators ? section.validators(condition as never) : {});
    const interfaceType = checker.getTypeAtLocation(declaration);
    const members = new Map(checker.getPropertiesOfType(interfaceType).map(member => [member.name, member]));

    for (const [key, member] of members) {
      const validators = branches.map(branch => branch[key]).filter(validator => validator !== undefined);
      if (validators.length === 0) {
        continue;
      }
      const accepts = (value: unknown) => validators.some(validator => validator(value) === true);
      const memberType = checker.getTypeOfSymbolAtLocation(member, declaration);
      const memberTypeText = checker.typeToString(memberType);
      const where = interfaceName + '.' + key + ' (' + memberTypeText + ')';
      const parts = typeParts(memberType);

      for (const part of parts) {
        if (part.isStringLiteral() && !accepts(part.value)) {
          mismatches.push(where + ': the type allows "' + part.value + '", the validator rejects it');
        }
      }
      const typeHasNull = parts.some(part => (part.flags & ts.TypeFlags.Null) !== 0);
      if (typeHasNull !== accepts(null)) {
        mismatches.push(where + ': the type ' + (typeHasNull ? 'allows' : 'rejects')
          + ' null, the validator does not');
      }
      if (!parts.some(admitsString)) {
        for (const probe of stringProbes) {
          if (accepts(probe)) {
            mismatches.push(where + ': the validator accepts "' + probe + '", the type cannot express a string');
          }
        }
      }
    }

    const inputEntries = inputEntryTypes(sectionId);
    for (const property of model.sections.find(candidate => candidate.id === sectionId)?.properties ?? []) {
      const member = members.get(property.key);
      if (member === undefined) {
        mismatches.push(interfaceName + '.' + property.key + ': documented for ' + sectionId + ' but not declared');
        continue;
      }
      const optional = (member.flags & ts.SymbolFlags.Optional) !== 0;
      const hasDefault = (property.default !== undefined && property.default.kind !== 'none')
        || property.conditionalDefaults !== undefined;

      // nothing fills in a member that is required and has no default, so DeepPartial must not make it optional
      if (!optional && !hasDefault && inputEntries.some(entry => {
        const inputMember = checker.getPropertyOfType(entry, property.key);
        return inputMember === undefined || (inputMember.flags & ts.SymbolFlags.Optional) !== 0;
      })) {
        mismatches.push(interfaceName + '.' + property.key
          + ': required with no default, but the input config accepts an entry without it');
      }

      if (optionalityExceptions[sectionId + '.' + property.key] !== undefined) {
        continue;
      }
      if (optional === hasDefault) {
        mismatches.push(interfaceName + '.' + property.key + ': declared ' + (optional ? 'optional' : 'required')
          + ' but it ' + (hasDefault ? 'has' : 'has no') + ' default');
      }
    }
  }

  it('checks every config section', () => {
    expect([...checkedSections].sort()).toEqual(getRuntimeSectionIds());
  });

  it('finds no property whose type and validator disagree', () => {
    expect(mismatches).toEqual([]);
  });
});
