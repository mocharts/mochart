---
"@mochart/core": patch
---

fix createSparklineConfig letting a member the passed config sets to undefined (a wrapper forwarding an optional prop, such as tooltip: { visible: props.tooltip }) replace the preset value, so the sparkline got a visible tooltip, circle markers or the default margins; an undefined member now counts as not set
