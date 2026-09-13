---
"@mochart/core": patch
---

fix validation reporting a failing member of a list-valued entry, such as a gradient stop, as the whole list with every rule of its entry shape, which is now reported at its own path such as stops[1].offset with a matching editor path, and drop the ": undefined" appended to the message for an absent value
