import {describe, expect, it} from 'vitest';
import {
  computePackId,
  isCustomPackToken,
  isValidCustomPackToken,
  reconcileSpritePacks,
  sortFilesByName,
} from './spritePacksDb';

const file = (name: string, content: string) => ({
  name,
  blob: new Blob([content]),
});

describe('computePackId', () => {
  it('is stable and independent of selection order (same files → same id)', async () => {
    const a = [file('a.svg', 'AAA'), file('b.svg', 'BBB'), file('c.svg', 'C')];
    const shuffled = [a[2], a[0], a[1]];
    const id1 = await computePackId(a);
    const id2 = await computePackId(shuffled);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^custom_[0-9a-f]{8}$/);
  });

  it('changes when file content changes', async () => {
    const id1 = await computePackId([file('a.svg', 'AAA')]);
    const id2 = await computePackId([file('a.svg', 'AAB')]);
    expect(id1).not.toBe(id2);
  });
});

describe('sortFilesByName', () => {
  it('orders by code units (locale-free, deterministic)', () => {
    const sorted = sortFilesByName([
      {name: 'b.svg'},
      {name: 'B.svg'},
      {name: '10.svg'},
      {name: '2.svg'},
    ]);
    // Plain code-unit order: digits < uppercase < lowercase; "10" < "2".
    expect(sorted.map((f) => f.name)).toEqual([
      '10.svg',
      '2.svg',
      'B.svg',
      'b.svg',
    ]);
  });
});

describe('custom pack tokens', () => {
  it('classifies and validates tokens', () => {
    expect(isCustomPackToken('custom_12ab34cd')).toBe(true);
    expect(isCustomPackToken('classic')).toBe(false);
    expect(isValidCustomPackToken('custom_12ab34cd')).toBe(true);
    expect(isValidCustomPackToken('custom_XYZ')).toBe(false);
    expect(isValidCustomPackToken('custom_12ab34cd99')).toBe(false);
  });
});

describe('reconcileSpritePacks', () => {
  it('keeps built-ins and known customs, drops unknown customs', () => {
    const {kept, dropped} = reconcileSpritePacks(
      ['classic', 'custom_aaaaaaaa', 'crappack', 'custom_bbbbbbbb'],
      ['custom_aaaaaaaa'],
    );
    expect(kept).toEqual(['classic', 'custom_aaaaaaaa', 'crappack']);
    expect(dropped).toEqual(['custom_bbbbbbbb']);
  });

  it('passes everything through when nothing is custom', () => {
    const {kept, dropped} = reconcileSpritePacks(['classic'], []);
    expect(kept).toEqual(['classic']);
    expect(dropped).toEqual([]);
  });
});
