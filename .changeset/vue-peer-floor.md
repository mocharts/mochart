---
"@mochart/vue": minor
---

raise the vue peer dependency from ^3.3.0 to ^3.5.2: the binding's declarations name DefineComponent with type parameters Vue 3.5.2 introduced, so below it the Chart and DefaultChart types resolved to an error type, every prop check silently off under skipLibCheck and a TS2707 build error without it; the guide and README state the floor
