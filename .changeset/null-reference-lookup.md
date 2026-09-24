---
"@mochart/core": patch
---

fix a null stack, group, gradient or pattern reference on a series (the documented opt-out) being linked to an entry whose id is the string "null", and a bar series opted out of a stack being treated as capped by a stack's outerCap, which threw "Cannot read properties of null (reading '0')" on mount
