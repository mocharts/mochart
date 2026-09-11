# @mochart/core

## 1.0.1

### Patch Changes

- fix animateBaseFromAdjacent animating a leading or trailing value down to the base instead of onto its neighbour when the value goes missing while its category stays ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix animateBaseFromAdjacent animating an entering or leaving interior value from or to the base instead of the point between its neighbours at its category position ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix the categoryIndex swatch reading the fill colours of a hollow bar or line series when only the stroke is per-category ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix categoryIndex-coloured series not showing a swatch in the legend and tooltip icons, which now draw stripes of the palette's first colours ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix legend items always taking the full row when truncated, with the new legend.truncation.maxFraction bounding how much of the legend width one item may occupy ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix a pie chart's tooltip moving to the centre of the pie after a data change ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix an unstacked ranged series animating down to the base when one side goes missing, so a candlestick that flips direction closes onto its open ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))

- fix a bar shorter than its round cap drawing as a wedge instead of closing across its base ([`9c6ab4c`](https://github.com/mocharts/mochart/commit/9c6ab4c479d34cb5852f2223bb5d999be8bd6542))
- Updated dependencies: @mochart/movalid@1.0.1

## 1.0.0

Initial release.
