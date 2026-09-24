---
"@mochart/core": patch
---

treat an empty string like null for every text setting that takes null for none (the title and its prefix and suffix, axis and threshold titles, the pie centre label, category and series value labels, prefixes and suffixes, series titles and the tooltip's filtered value text): title.text '' reserved a title row, remeasured on every update and, with truncation on, drew "undefined..." into the chart and exported svg; an empty prefix or suffix reserved its default width; categoryAxis.valueLabel '' printed ": " before the category in the tooltip and its announcement; and pie.centerLabel.text '' pushed the centre total below the centre
