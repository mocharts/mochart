# Config fuzzer: tier 1

A single-property sweep over the whole config surface, looking for lingering
bugs in core. Every leaf config property from `generated/config-reference.json`
is moved to each of its candidate values on each of several base configs, and
the result is checked by four oracles. Nothing here needs an expected output to
be written by hand: every check is a property the library must satisfy for any
config, which is what lets it cover ~1,300 properties.

Each base is normalized before the sweep: a list section written as a single
object is wrapped in a one-entry list, and a base with no `valueAxes` gets
`[{}]`, the default axis the library draws anyway.

```
npm run fuzz -w @mochart/core                       # the default sweep, hours long
npm run fuzz -w @mochart/core -- --sections=legend  # one section, seconds
```

The report lands in `packages/mochart/.fuzz/report.md` (and `report.json`),
rewritten every few seconds, so a long run can be read while it is still going.

## The oracles

1. **error**: nothing throws, nothing reaches `console.error`/`warn`, and every
   chart settles inside the frame cap, also after both charts are destroyed.
   A chart that never settles is an animation that never ends.
2. **geometry**: no `NaN`, `Infinity`, `undefined`/`null` or negative extent
   reaches a rendered attribute, and no text node reads as `NaN`. Catches most
   scale and domain edge cases.
3. **path-independence**: building a chart with config A and updating it to B
   must reach the same DOM as building B directly, and updating back to A must
   return to A's DOM. A mismatch is retained renderer state that a config change
   failed to clean up. This is the oracle with the most reach.
4. **input-mutation**: the raw config, the enhanced config and the data rows
   handed to the library come back byte-identical.

## List-valued properties

A property whose value is a list (thresholds, explicit ticks, gradient stops,
color lists) is swept two ways:

- **As a whole list.** Explicit `ticks` and `thresholds` take their values from
  the base: the axis's first, middle and last category (and on a date axis the
  same instant written the other way), or the range of the series values on a
  value axis, plus one value that matches nothing, so the hidden case is
  covered too. The thresholds include a line, a range and a titled line, each
  drawn visibly. Every other list gets an empty, a one-entry and a two-entry
  list built from its item model.
- **Member by member.** Each member of a list entry, such as
  `categoryAxis.thresholds[].style.normal.strokeColor`, is a property of its
  own, written into the first entry of a list the base already declares, so it
  only runs on bases that have one. `category-ticks`, `threshold-range`,
  `threshold-category-line`, `heatmap` and `gradients` are default bases for
  this reason. The `value` and `rangeValue` members also take the values
  derived from the base.

## Shape changes

Alongside the property sweep, each base also runs a small set of cases that
change the chart's shape rather than a value, because the property sweep can
only ever move a value *inside* an entry that already exists. Per base: drop
each list entry in turn, duplicate the last one, swap the first two, and add or
remove a data row. About 100 cases in total, a minute of a multi-hour run,
checked by the same four oracles: reaching a shape by update must match building
it directly.

Turned off with `--no-structural`. List length and entry order are otherwise
never varied, and the data is otherwise fixed for the whole run.

## What one case does

For a base config A and a candidate value producing config B:

1. enhance A and B, checking each raw config is not mutated
2. render A, settle, capture the DOM
3. update the same chart to B, settle, capture
4. render B into a second chart, settle, capture
5. update the first chart back to A, settle, capture
6. compare (A→B) against B, and (A→B→A) against A
7. compare every input object against its pre-call copy

A case only runs when the mutated config passes `validateConfig` and the
config/data pair passes `getDataErrors`, because an invalid value is a different
experiment (that the validator rejects it is what should be checked, and that is
not this tier). The `getDataErrors` gate matters because `createChart` trusts
its input: `DefaultChartInput` runs the same check and swaps in an error
provider before the controller sees the data, so a pair that fails it is out of
contract rather than a bug. Without the gate, moving `categoryAxis.type` to
`number` over string categories renders `NaN` tick labels.

## Options

| option | default | meaning |
| --- | --- | --- |
| `--bases=a,b` / `--bases=all` | thirteen demos spanning bar, line, multi-axis, gradient, pattern, text-heavy, missing-data, pie and heatmap charts, and charts with explicit ticks and thresholds | which demo configs to sweep against |
| `--sections=legend,tooltip` | every section | restrict to config sections |
| `--property=tickLabel` | none | substring filter on the dotted property id |
| `--values=6` | 6 | candidate values per property; enum members are never cut, so a longer enum adds more |
| `--frames=600` | 600 | frame cap per settle |
| `--width`, `--height` | 800×600 | chart size |
| `--no-animation` | animation on | render without tweens |
| `--shard=2/4` | none | run one shard; shards are disjoint and can run in parallel processes |
| `--no-structural` | shape changes on | skip the add/remove/reorder cases |
| `--list-entries=N` / `--list-entries=all` | 1 | how many entries of each list section (`series`, `valueAxes`, gradients, …) to sweep; `all` roughly doubles the run |
| `--limit=N` | none | stop after N units (a unit is one property on one base entry) |
| `--resume` | none | continue the previous run of the same options, merging findings |
| `--out=dir` | `packages/mochart/.fuzz` | report directory |
| `--fail-on-findings` | none | exit non-zero when anything is found (for CI, once the report is clean) |

`Ctrl-C` writes the report and stops cleanly.

## Running on GitHub

`.github/workflows/fuzz.yml` runs the sweep as 20 parallel shards on GitHub
Actions, then merges their reports into one. A shard never fails on findings;
the merge job does, so a run with findings shows as failed and GitHub emails
whoever started it.

Until the workflow file reaches main, a run starts with a push to the `fuzz`
branch, which only exists on GitHub:

```
git push -f origin develop:fuzz   # fuzz develop's tip
gh run watch                      # follow it
gh run download --name fuzz-report
```

A push run uses the default bases and every section. Once the file is on main,
the Actions tab can start it by hand with a shard count, bases and sections,
and the push trigger can go.

The merged report is also on the run's summary page. Each shard's own output is
kept for 7 days as `fuzz-shard-N`. To merge shard reports locally:

```
npm run fuzz:merge -w @mochart/core -- --out=merged shard1 shard2
```

## Determinism

The harness installs its own jsdom, a virtual clock (`requestAnimationFrame`,
`setTimeout`, `performance.now`, `Date.now`) and the golden suite's synthetic
font metrics, so a case renders the same DOM on every machine and every run.
Without that, DOM comparison could not be an oracle.

Serialization sorts attributes by name and flattens the per-instance id
counters: attribute write order and instance numbering are not observable, so
they must not count as differences.

## Deliberately out of scope here

- **Invalid values**: filtered out, not fed in. Checking that the validator
  rejects them and that the chart survives them is a separate oracle.
- **Data property names**: a made-up one changes which data the chart reads,
  which is a different experiment.
- **List sections a base does not declare**: `series`, `seriesGroups`,
  `seriesStacks`, gradients and patterns are only swept on bases that declare
  at least one entry. Adding an empty entry would be a different experiment,
  because the library adds no default one; only `valueAxes` is default-filled.
- **List entries past the first**: `--list-entries` sweeps them, but the default
  is entry `[0]` only, because sweeping every declared entry costs roughly
  another 7,200 units.
- **Properties with no generated values**: named under "Untested properties" in
  the report rather than quietly counted as swept, so the header reads
  `properties swept: N of M`. Properties whose every generated value is rejected
  before a case runs are named under "Properties with no valid case" the same
  way.
- **Property pairs**: every case moves exactly one property. Interactions are
  tier 2 (a pairwise covering array) and tier 3 (long random walks).
- **Inertness**: whether a property change did anything at all. Easy to add on
  top of the captured DOMs, but it needs a curated list of legitimately-inert
  combinations first.
