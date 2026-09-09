import { NONE, TYPE_DATE } from '../config/core/constants';
import type { CategoryAxisConfig } from '../types/config';

export type CategoryKeyAxisConfig = Pick<CategoryAxisConfig, 'type' | 'keyProperty'>;

/** Stable lookup key for category values; date axes key by epoch ms so Date, ISO string and epoch forms of one instant match. */
export function getCategoryValueKey(categoryAxisConfig: CategoryKeyAxisConfig, value: unknown): string {
  if (categoryAxisConfig.type === TYPE_DATE && categoryAxisConfig.keyProperty === NONE) {
    return String(new Date(value as string | number | Date).getTime());
  }
  return String(value);
}
