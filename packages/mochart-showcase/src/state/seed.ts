// The seed a page reads from its ?seed= query param. randomForSeed walks one
// step per seed, so the parser bounds it at four digits and ignores anything
// longer rather than letting a hand-edited URL hang the page.

export const MAX_SEED = 9999;

export function parseSeed(param: string | null): number | null {
  return param !== null && /^-?\d{1,4}$/.test(param) ? Number(param) : null;
}

/** The seed after `seed`, held at MAX_SEED so play and stepping never write a seed the parser drops. */
export function nextSeed(seed: number | null): number {
  return Math.min(MAX_SEED, (seed ?? 0) + 1);
}
