# Config reference

The reference has three parts:

- **Config sections** — this page and the pages it links to, one per section
  of a mochart config (`chart`, `series`, `categoryAxis`, …): every property,
  its rules, and its default. Generated from the library source — the same
  descriptions, validators, and defaults that power
  [config validation](/guide/config-model#validation) produce these pages, so
  they cannot drift from the code.
- **Props and callbacks** — what a chart *instance* takes, as opposed to what
  its config says: [Chart props](/reference/props) (sizing, `loading`/`error`,
  controlled focus and filtering, the state factories),
  [Callbacks and payloads](/reference/callbacks), and the name each framework
  binding gives those props in [Framework props](/reference/framework-props).
  Generated from the packages' type declarations.
- **[API](/reference/api)** — the functions and classes `@mochart/core`
  exports: the entry points and `ChartHandle`, the data providers, the config
  and chart helpers, constants, and `mochartCssClasses`. The literal types
  behind the enumerated config values (`RendererType`, `CurveType`, …) have
  their own generated page, [Enumerated values](/reference/enumerations).

## Config sections

A mochart config is a plain object made of per-concern sections. Every
section — and almost every property inside one — is optional and falls back to
a sensible default, so a minimal config only names the data properties to plot
(see [Getting started](/guide/getting-started)).

The list sections (`series`, `valueAxes`, `seriesGroups`, `seriesStacks`,
`linearGradients`, `radialGradients`, `patterns`) take an array of config
objects and have a companion `*Defaults` section for values shared by every
entry — see [The config model](/guide/config-model) for how sharing and
defaulting work. `id` and `version` are the only top-level keys that are not
sections.

<script setup>
import { data } from './sections.data.ts'
</script>

<table>
  <thead>
    <tr><th>Property</th><th>Description</th><th>Default</th></tr>
  </thead>
  <tbody>
    <tr v-for="entry in data.topLevel" :key="entry.key">
      <td>
        <template v-if="entry.sectionId">
          <a :href="entry.sectionId">
            <code>{{ entry.key }}</code>
          </a>
          <template v-if="entry.allKey">
            <br />
            <code>{{ entry.allKey }}</code>
          </template>
        </template>
        <template v-else>
          <code>{{ entry.key }}</code>
        </template>
      </td>
      <td>
        {{ entry.description }}
        <template v-if="entry.allDescription">
          <br />{{ entry.allDescription }}
        </template>
      </td>
      <td>
        <code v-if="entry.defaultText">{{ entry.defaultText }}</code>
      </td>
    </tr>
  </tbody>
</table>
