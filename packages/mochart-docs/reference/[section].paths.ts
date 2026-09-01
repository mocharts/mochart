import { loadConfigReference } from '../.vitepress/lib/model.ts';
import { loadApiReference } from '../.vitepress/lib/apiModel.ts';
import { loadBindingReference } from '../.vitepress/lib/bindingModel.ts';
import { renderSectionPage } from '../.vitepress/lib/renderSection.ts';
import { renderApiPage } from '../.vitepress/lib/renderApiPage.ts';
import { renderEnumerationsPage } from '../.vitepress/lib/renderEnumerationsPage.ts';
import { renderBindingPage } from '../.vitepress/lib/renderBindingPage.ts';
import { buildUsageIndex } from '../.vitepress/lib/usageIndex.ts';

// All the generated reference families share this route: config sections
// render from the config-reference model, props/callbacks and the enumerated
// values from the api-reference one, and the framework props from the
// binding-reference one.
export const FRAMEWORK_PROPS_PAGE = 'framework-props';

export default {
  paths() {
    const usage = buildUsageIndex();
    const configPages = loadConfigReference().sections.map(section => ({
      params: { section: section.id },
      content: renderSectionPage(section, usage)
    }));
    const apiReference = loadApiReference();
    const apiPages = apiReference.pages.map(page => ({
      params: { section: page.id },
      content: renderApiPage(page)
    }));
    const enumerationsPage = {
      params: { section: apiReference.enumerations.id },
      content: renderEnumerationsPage(apiReference.enumerations)
    };
    const bindingPage = {
      params: { section: FRAMEWORK_PROPS_PAGE },
      content: renderBindingPage(loadBindingReference())
    };
    return [...configPages, ...apiPages, enumerationsPage, bindingPage];
  }
};
