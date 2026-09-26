---
"@mochart/core": minor
---

rename the pattern color keyword 'series' to 'owner' in patterns' foregroundColor and backgroundColor, since a pattern can now fill a threshold range as well as a series; 'owner' resolves to the normal fill color of whichever it fills, and a config that sets 'series' explicitly must change it to 'owner'
