import validators from './validators.js';

export default function getValidators() {
  return {
    id: validators.id(),
    ignore: validators.boolean(),
  };
}