import validators from './validators';

export default function getValidators() {
  return {
    id: validators.id(),
    ignore: validators.boolean(),
  };
}