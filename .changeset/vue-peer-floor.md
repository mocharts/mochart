---
"@mochart/vue": minor
---

raise the vue peer dependency from ^3.3.0 to ^3.5.2: the binding's declarations name DefineComponent with the type parameters Vue 3.5.2 introduced, so on 3.3, 3.4, 3.5.0 and 3.5.1 the Chart and DefaultChart types resolved to an error type (every prop check silently off with skipLibCheck, a TS2707 build error without it); the guide and README now state the floor
