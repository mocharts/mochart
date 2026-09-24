---
"@mochart/core": patch
---

treat an empty string like null for every text setting that takes null for none (titles, prefixes and suffixes, axis and threshold titles, the pie centre label, value labels, series titles and the tooltip's filtered value text): title.text '' reserved a title row and, with truncation on, drew "undefined..." into the chart and exported svg, an empty prefix or suffix reserved its default width, categoryAxis.valueLabel '' printed ": " before the category in the tooltip, and pie.centerLabel.text '' pushed the centre total below the centre
