---
"@mochart/editor": patch
---

fix completions: an inserted default now resolves the real value from core for conditional defaults, palettes and object-notation literals, an object or array property whose default is null gets {} or [] to fill in, reference ids no longer offer entries core rejects (ignored entries, the series itself or another follower for followSeries, inside seriesDefaults too), and accepting a completion no longer corrupts the document right after a closing quote, in an array entry slot or before a member that still lacks its comma
