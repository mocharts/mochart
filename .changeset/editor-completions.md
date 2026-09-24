---
"@mochart/editor": patch
---

fix completions: an inserted default now takes the real value from core for conditional defaults, palettes and object-notation literals, a null object or array default inserts {} or [] to fill in, reference ids leave out the entries core rejects (ignored entries, and for followSeries the series itself or another follower) and match a series' stack by the axis core gives each side, so a stack or series left to its default or seriesDefaults axis is offered or left out correctly, and accepting a completion after a closing quote, in an array entry slot or before a member missing its comma no longer corrupts the document
