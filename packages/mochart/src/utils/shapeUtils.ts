import { symbol, symbols } from 'd3-shape';
import type { MarkerShape } from '../config/core/constants';

// d3 no longer resolves a symbol from its string name, so map it ourselves
// https://github.com/d3/d3-shape/issues/64
const shapeToSymbolIndexMap: Record<MarkerShape, (typeof symbols)[number]> = {
  circle: symbols[0],
  cross: symbols[1],
  diamond: symbols[2],
  square: symbols[3],
  star: symbols[4],
  triangle: symbols[5],
  wye: symbols[6]
};

// spelled out locally: d3-shape's types are repo-local ambients, so they cannot be referenced from the emitted .d.ts
interface SymbolGenerator {
  (): string | null;
  size(value: number): SymbolGenerator;
}

export function getSymbolGenerator(size: number, shape: MarkerShape): SymbolGenerator {
  return symbol().size(size * size).type(shapeToSymbolIndexMap[shape]);
}
