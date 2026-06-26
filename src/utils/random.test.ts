import {describe, expect, it} from 'vitest';
import {
  randomBoolean,
  randomColorRGB,
  randomInteger,
  randomItem,
  setSeed,
} from './random';

// The generators are driven by a seeded Mulberry32 PRNG (see `random.ts`), not
// by `Math.random()`. Pinning the seed first makes every sequence reproducible,
// so these snapshots are stable across runs.
const collect = <T>(seed: number, count: number, fn: () => T): T[] => {
  setSeed(seed);
  return Array.from({length: count}, () => fn());
};

const SEED = 12345;

describe('setSeed', () => {
  it('reproduces the same sequence for the same seed', () => {
    const first = collect(SEED, 10, () => randomInteger(0, 1000));
    const second = collect(SEED, 10, () => randomInteger(0, 1000));
    expect(second).toEqual(first);
  });

  it('produces different sequences for different seeds', () => {
    const a = collect(1, 10, () => randomInteger(0, 1000));
    const b = collect(2, 10, () => randomInteger(0, 1000));
    expect(b).not.toEqual(a);
  });
});

describe('randomBoolean', () => {
  it('returns booleans', () => {
    const results = collect(SEED, 20, randomBoolean);
    expect(results.every((r) => typeof r === 'boolean')).toBe(true);
  });

  it('is reproducible', () => {
    expect(collect(SEED, 10, randomBoolean)).toMatchInlineSnapshot(`
      [
        true,
        false,
        true,
        false,
        true,
        true,
        true,
        false,
        false,
        false,
      ]
    `);
  });
});

describe('randomInteger', () => {
  it('stays within the inclusive range', () => {
    setSeed(SEED);
    for (let i = 0; i < 1000; i++) {
      const n = randomInteger(5, 15);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(15);
    }
  });

  it('can return both range bounds', () => {
    setSeed(SEED);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randomInteger(0, 3));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it('is reproducible', () => {
    expect(collect(SEED, 10, () => randomInteger(0, 10)))
      .toMatchInlineSnapshot(`
      [
        7,
        5,
        5,
        3,
        7,
        7,
        6,
        0,
        3,
        4,
      ]
    `);
  });
});

describe('randomColorRGB', () => {
  it('returns channels within [0, 255]', () => {
    const results = collect(SEED, 50, randomColorRGB);
    for (const {r, g, b} of results) {
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  it('is reproducible', () => {
    expect(collect(SEED, 3, randomColorRGB)).toMatchInlineSnapshot(`
      [
        {
          "b": 134,
          "g": 118,
          "r": 182,
        },
        {
          "b": 178,
          "g": 173,
          "r": 73,
        },
        {
          "b": 76,
          "g": 10,
          "r": 148,
        },
      ]
    `);
  });
});

describe('randomItem', () => {
  it('returns undefined for an empty array', () => {
    setSeed(SEED);
    expect(randomItem([] as number[])).toBeUndefined();
  });

  it('only returns items from the array', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = collect(SEED, 50, () => randomItem(items));
    expect(results.every((r) => items.includes(r as number))).toBe(true);
  });

  it('is reproducible', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(collect(SEED, 10, () => randomItem(items))).toMatchInlineSnapshot(`
      [
        8,
        5,
        6,
        3,
        7,
        7,
        6,
        1,
        3,
        5,
      ]
    `);
  });
});
