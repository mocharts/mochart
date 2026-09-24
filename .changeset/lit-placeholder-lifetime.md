---
"@mochart/lit": patch
---

clears a placeholder template when the chart leaves its state, disconnecting its async directives, and renders it again on re-entry, instead of keeping the detached render alive, matching the React and Svelte bindings
