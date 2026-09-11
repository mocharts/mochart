// The compact formatter's release lines, with a dependency line that names the
// new versions only: in a fixed group the commit links it would list are the
// ones already in that dependency's own section.
import compact from '@svitejs/changesets-changelog-github-compact';

export default {
  getReleaseLine: compact.getReleaseLine,
  getDependencyReleaseLine: async (_changesets, dependenciesUpdated) => {
    if (dependenciesUpdated.length === 0) return '';
    return '- Updated dependencies: ' + dependenciesUpdated.map((d) => `${d.name}@${d.newVersion}`).join(', ');
  }
};
