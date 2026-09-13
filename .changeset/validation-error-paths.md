---
"@mochart/core": patch
---

fix validation reporting a failing member of a threshold, tick or gradient stop entry as the whole list with every rule of its entry shape, which is now reported at its own path such as thresholds[1].title.side with a matching editor path, and drop the ": undefined" appended to the message for an absent value
