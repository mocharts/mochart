---
"@mochart/angular": patch
---

destroys a placeholder component (ngOnDestroy runs, the view leaves the ApplicationRef) when the chart leaves its state and creates a fresh one on re-entry, instead of keeping the hidden component attached and change-detected with its intervals and subscriptions running, matching the React and Svelte bindings
