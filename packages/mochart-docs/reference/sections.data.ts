import { loadConfigReference, modelPath, type ConfigReferenceModel } from '../.vitepress/lib/model.ts';

declare const data: ConfigReferenceModel;
export { data };

export default {
  watch: [modelPath],
  load(): ConfigReferenceModel {
    return loadConfigReference();
  }
};
