---
"@mochart/vue": patch
---

unmounts a placeholder component when the chart leaves its state and mounts a fresh one on re-entry, instead of keeping the instance mounted in its detached container with its watchers and timers running, matching the React and Svelte bindings
