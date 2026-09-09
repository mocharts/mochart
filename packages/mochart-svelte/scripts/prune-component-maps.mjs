// svelte2tsx emits `.svelte` declaration maps against its own virtual TS file, so their `sources`
// name a file that does not exist and their positions run past the end of the real component.
// Drop those rather than ship maps that send go-to-definition nowhere; keep the plain-TS ones.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

for (const name of readdirSync(dist)) {
  if (!name.endsWith('.d.ts.map')) continue;

  const file = join(dist, name);
  const { sources = [] } = JSON.parse(readFileSync(file, 'utf8'));
  if (sources.every((source) => existsSync(resolve(dirname(file), source)))) continue;

  rmSync(file);

  // Strip the now-dangling reference from the declaration file it belonged to.
  const declaration = join(dist, name.slice(0, -4));
  const stripped = readFileSync(declaration, 'utf8').replace(
    new RegExp(`\\n?//# sourceMappingURL=${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?$`),
    '\n'
  );
  writeFileSync(declaration, stripped);
}
