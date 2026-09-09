import validators from './validators';
import { isPlainObject } from '../core/deepMerge';
import type { Validator } from '@mochart/movalid';

export type ConfigObject = Record<string, unknown>;
type ValidatorMap = Record<string, Validator>;

export function isConfigObject(value: unknown): value is ConfigObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// own-key check: user config keys (__proto__, constructor, ...) must not resolve to prototype members
function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

const objectValidator = validators.object();

const suffix = ' - ';
const maxInvalidProperties = 10;
export const DEFAULT = 'Default ';

export interface LocatedValidationMessage {
  path: (string | number)[];
  message: string;
  /** The offending key names (capped) when the message reports invalid properties. */
  invalidProperties?: string[];
}

function messagePath(prefix: string, i: number | undefined, ...properties: string[]): (string | number)[] {
  const section = prefix.startsWith(DEFAULT) ? prefix.slice(DEFAULT.length) : prefix;
  const path: (string | number)[] = section === 'config' || section === '' ? [] : [section];
  if (i !== undefined) path.push(i);
  for (const property of properties) {
    path.push(property);
  }
  return path;
}

/** The property part of a message for a nested key: `backgroundStyle.fillColor`. */
function joinProperties(properties: string[]): string {
  return properties.join('.');
}

/** The member validators an object validator publishes as `nestedValues`; null for every other validator. */
function nestedValidators(validator: unknown): ValidatorMap | null {
  const nested = (validator as Validator | undefined)?.nestedValues;
  return nested !== undefined && nested !== null ? nested : null;
}

function prefixMessage(prefix: string, i: number | undefined = undefined): string {
  return i === undefined ? prefix + suffix : prefix + '[' + i + ']' + suffix;
}

function prefixPropertyErrorMessage(prefix: string, property: string, message: string, i: number | undefined = undefined): string {
  return prefixMessage(prefix, i) + property + suffix + message;
}

function prefixErrorMessage(prefix: string, message: string, i: number | undefined = undefined): string {
  return prefixMessage(prefix, i) + message;
}

export function getPropertyMessage(prefix: string, property: string, message: string, i: number | undefined = undefined): string {
  return prefixPropertyErrorMessage(prefix, property, message, i);
}

export function getMessage(prefix: string, message: string): string {
  return prefixMessage(prefix) + message;
}

// Report one (possibly nested) failed config value, drilling into the failing members so a path reaches
// e.g. ['axisConfig', 'backgroundStyle', 'fillColor']; the aggregate message is the no-single-member fallback.
function addErrorMessageForKey(prefix: string, properties: string[], value: unknown, validator: Validator, errorMessages: string[], errorDetails: LocatedValidationMessage[], i: number | undefined): void {
  if (validator(value)) {
    return;
  }
  const nested = nestedValidators(validator);
  if (nested !== null && isPlainObject(value)) {
    const failedKeys = Object.keys(value).filter(nestedKey => {
      const nestedValidator = hasOwn(nested, nestedKey) ? nested[nestedKey] : undefined;
      return nestedValidator !== undefined && value[nestedKey] !== undefined && !nestedValidator(value[nestedKey]);
    });
    if (failedKeys.length > 0) {
      for (const nestedKey of failedKeys) {
        addErrorMessageForKey(prefix, [...properties, nestedKey], value[nestedKey], nested[nestedKey]!,
          errorMessages, errorDetails, i);
      }
      return;
    }
  }
  const message = validator.getErrorMessage(value);
  errorMessages.push(prefixPropertyErrorMessage(prefix, joinProperties(properties), message, i));
  errorDetails.push({ path: messagePath(prefix, i, ...properties), message });
}

function addErrorMessagesInternal(prefix: string, config: unknown, validatorMap: ValidatorMap, errorMessages: string[], errorDetails: LocatedValidationMessage[], i: number | undefined = undefined, all = false): void {
  if (objectValidator(config) && isConfigObject(config)) {
    const validatorKeys = Object.keys(validatorMap);
    const configKeys = Object.keys(config);
    const keys = all ? validatorKeys : configKeys.filter(configKey => hasOwn(validatorMap, configKey) && validatorMap[configKey] !== undefined)

    for (const key of keys) {
      addErrorMessageForKey(prefix, [key], config[key], validatorMap[key]!, errorMessages, errorDetails, i);
    }
  }
}

export function addWarningMessages(prefix: string, config: unknown, propertyMap: Record<string, unknown>, warningMessages: string[], warningDetails: LocatedValidationMessage[] = [], i: number | undefined = undefined): void {
  addWarningMessagesInternal(prefix, config, propertyMap, warningMessages, warningDetails, i, true);
}

function addWarningMessagesInternal(prefix: string, config: unknown, propertyMap: Record<string, unknown>, warningMessages: string[], warningDetails: LocatedValidationMessage[], i: number | undefined = undefined, _all = false): void {
  addWarningMessagesForObject(prefix, [], config, propertyMap, warningMessages, warningDetails, i);
}

/** Warn about the keys an object has that its shape does not, then recurse, so a typo inside a nested style is not swallowed. */
function addWarningMessagesForObject(prefix: string, properties: string[], config: unknown, propertyMap: Record<string, unknown>, warningMessages: string[], warningDetails: LocatedValidationMessage[], i: number | undefined): void {
  if (objectValidator(config) && isConfigObject(config)) {
    const invalidProperties: string[] = [];
    let invalidPropertyCount = 0;
    const configProperties = Object.keys(config);
    for (const property of configProperties) {
      if (!(hasOwn(propertyMap, property) && propertyMap[property])) {
        if (invalidProperties.length < maxInvalidProperties) {
          invalidProperties.push(property);
        }
        invalidPropertyCount++;
      }
    }
    if (invalidPropertyCount > 0) {
      let message: string;
      const propertyNoun = invalidPropertyCount === 1 ? ' invalid property' : ' invalid properties';
      if (invalidPropertyCount > maxInvalidProperties) {
        message = 'had ' + invalidPropertyCount + propertyNoun + ', first ' + maxInvalidProperties + ' are: ' + invalidProperties.join(', ');
      }
      else {
        message = 'had ' + invalidPropertyCount + propertyNoun + ': ' + invalidProperties.join(', ');
      }
      warningMessages.push(properties.length === 0
        ? prefixErrorMessage(prefix, message, i)
        : prefixPropertyErrorMessage(prefix, joinProperties(properties), message, i));
      warningDetails.push({ path: messagePath(prefix, i, ...properties), message, invalidProperties });
    }
    for (const property of configProperties) {
      const nested = nestedValidators(hasOwn(propertyMap, property) ? propertyMap[property] : undefined);
      if (nested !== null && isPlainObject(config[property])) {
        addWarningMessagesForObject(prefix, [...properties, property], config[property], nested,
          warningMessages, warningDetails, i);
      }
    }
  }
}

function objectWithKeys<T>(object: Record<string, T>, keys: string[]): Record<string, T> {
  const clone: Record<string, T> = Object.create(null); // null proto: keys may come from user configs
  for (const key of keys) {
    if (hasOwn(object, key) && object[key] !== undefined) {
      clone[key] = object[key];
    }
  }
  return clone;
}


/** The object's own keys whose value is set: an explicit undefined reads as "not specified", like the config merge treats it. */
function definedKeys(config: ConfigObject): string[] {
  return Object.keys(config).filter(key => config[key] !== undefined);
}

function withDefinedKeys(config: ConfigObject): ConfigObject {
  return objectWithKeys(config, definedKeys(config)) as ConfigObject;
}

export function getMessages(sectionKey: string, allKey: string | undefined, uniqueKeys: string[] | undefined, section: unknown, sectionDefaults: unknown, all: unknown, validatorMap: ValidatorMap, onlyAll: boolean, i: number | undefined = undefined, first: boolean = i === undefined || i === 0, allExcludedKeys: string[] | undefined = undefined) {
  const errorMessages: string[] = [];
  const warningMessages: string[] = [];
  const errorDetails: LocatedValidationMessage[] = [];
  const warningDetails: LocatedValidationMessage[] = [];
  const validatorKeys = Object.keys(validatorMap);
  let providedKeyMap: ConfigObject = {};

  if (!onlyAll && objectValidator(sectionDefaults) && isConfigObject(sectionDefaults)) {
    providedKeyMap = {...providedKeyMap, ...withDefinedKeys(sectionDefaults)};

    if (first) {
      const sectionDefaultKeys = definedKeys(sectionDefaults);
      const defaultValidators = objectWithKeys(validatorMap, sectionDefaultKeys);

      addErrorMessagesInternal(DEFAULT + sectionKey, sectionDefaults, defaultValidators, errorMessages, errorDetails);
      addWarningMessagesInternal(DEFAULT + sectionKey, sectionDefaults, validatorMap, warningMessages, warningDetails);
    }
  }
  if (objectValidator(all) && isConfigObject(all)) {
    providedKeyMap = { ...providedKeyMap, ...withDefinedKeys(all) };
    if (first) {
      const uniqueAllKeys = (Array.isArray(uniqueKeys) ? uniqueKeys : []).filter(uniqueKey => all[uniqueKey] !== undefined)

      for (const uniqueAllKey of uniqueAllKeys) {
        const message = 'unique properties cannot be set on an all config';
        errorMessages.push(
          prefixPropertyErrorMessage(allKey ?? sectionKey, uniqueAllKey, message));
        errorDetails.push({ path: messagePath(allKey ?? sectionKey, undefined, uniqueAllKey), message });
      }

      const excludedAllKeys = (Array.isArray(allExcludedKeys) ? allExcludedKeys : [])
        .filter(excludedKey => all[excludedKey] !== undefined);
      for (const excludedAllKey of excludedAllKeys) {
        const message = 'entry-only properties cannot be set on an all config';
        errorMessages.push(prefixPropertyErrorMessage(allKey ?? sectionKey, excludedAllKey, message));
        errorDetails.push({ path: messagePath(allKey ?? sectionKey, undefined, excludedAllKey), message });
      }

      const allKeys = definedKeys(all).filter(allKey => uniqueAllKeys.indexOf(allKey) === -1 && excludedAllKeys.indexOf(allKey) === -1);
      const allValidators = objectWithKeys(validatorMap, allKeys);

      addErrorMessagesInternal(allKey ?? sectionKey, all, allValidators, errorMessages, errorDetails);
      addWarningMessagesInternal(allKey ?? sectionKey, all, validatorMap, warningMessages, warningDetails);
    }
    else if (!onlyAll) {
      // later entries carry their own conditional rules (renderer, stack, colorProperty…), so the all-config
      // values they inherit are checked under them too; the caller drops repeats of a message already reported
      const overriddenKeys = objectValidator(section) && isConfigObject(section) ? definedKeys(section) : [];
      const inheritedKeys = definedKeys(all).filter(key => overriddenKeys.indexOf(key) === -1 &&
        (!Array.isArray(uniqueKeys) || uniqueKeys.indexOf(key) === -1) &&
        (!Array.isArray(allExcludedKeys) || allExcludedKeys.indexOf(key) === -1));
      addErrorMessagesInternal(allKey ?? sectionKey, all, objectWithKeys(validatorMap, inheritedKeys), errorMessages, errorDetails);
    }
  }
  if (!onlyAll && objectValidator(section) && isConfigObject(section)) {
    providedKeyMap = { ...providedKeyMap, ...withDefinedKeys(section) };
    const sectionKeys = definedKeys(section);
    const sectionValidators = objectWithKeys(validatorMap, sectionKeys);

    addErrorMessagesInternal(sectionKey, section, sectionValidators, errorMessages, errorDetails, i);
    addWarningMessagesInternal(sectionKey, section, validatorMap, warningMessages, warningDetails, i);
  }

  if (!onlyAll) {
    const missingKeys = validatorKeys.filter(key => providedKeyMap[key] === undefined);
    const missingValidators = objectWithKeys(validatorMap, missingKeys);

    addErrorMessagesInternal(sectionKey, isConfigObject(section) ? section : {}, missingValidators, errorMessages, errorDetails, i, true);
  }

  return {
    errorMessages,
    warningMessages,
    errorDetails,
    warningDetails
  };
}
