---
"@mochart/svelte": patch
---

fix the shipped types under node16 or nodenext module resolution, where the extensionless relative imports in the declarations and .svelte files made ChartProps, DefaultChartProps, ChartRef and the other exported types resolve to any; the imports now name their .js targets
