import {describe, expect, it} from 'vitest';
import {createHash} from 'node:crypto';
import {drawSync} from './draw';

/**
 * Phase 0 — determinism guard for the rendering core.
 *
 * `draw()` is driven entirely by the seeded PRNG, so the ordered sequence of
 * drawing operations it issues is a pure function of (seed + settings). We record
 * that sequence against a stub context instead of rasterizing, then assert it is
 * reproducible. This is the property Copy-URL and parameter locks depend on.
 *
 * Why the op trace (not a pixel hash): the upcoming CPU float-core refactor will
 * change exact pixel output (8-bit → float) but must NOT change which operations
 * are issued in what order. So this trace should stay invariant across that
 * refactor, making it the correct regression tripwire. (A pixel hash would also
 * need a real canvas, which the test environment lacks.)
 */

type TraceEvent =
  | {t: 'gco'; v: string}
  | {t: 'fillStyle'; v: string}
  | {t: 'clearRect'; a: number[]}
  | {t: 'fillRect'; a: number[]}
  | {t: 'drawImage'; a: number[]}
  | {t: 'translate'; a: number[]}
  | {t: 'rotate'; a: number[]};

const W = 256;
const H = 256;

// Stand-in for CanvasRenderingContext2D that records ordered ops instead of
// drawing. Only the members `draw()` actually touches are implemented.
class RecordingContext {
  readonly trace: TraceEvent[] = [];
  readonly canvas = {width: W, height: H};
  #gco = 'source-over';

  get globalCompositeOperation(): string {
    return this.#gco;
  }

  set globalCompositeOperation(v: string) {
    this.#gco = v;
    this.trace.push({t: 'gco', v});
  }

  set fillStyle(v: string) {
    this.trace.push({t: 'fillStyle', v});
  }

  clearRect(...a: number[]): void {
    this.trace.push({t: 'clearRect', a});
  }

  fillRect(...a: number[]): void {
    this.trace.push({t: 'fillRect', a});
  }

  drawImage(_img: unknown, ...a: number[]): void {
    this.trace.push({t: 'drawImage', a});
  }

  translate(...a: number[]): void {
    this.trace.push({t: 'translate', a});
  }

  rotate(...a: number[]): void {
    this.trace.push({t: 'rotate', a});
  }
}

const runTrace = (initialSeed: number): TraceEvent[] => {
  const ctx = new RecordingContext();
  drawSync({
    ctx2d: ctx as unknown as CanvasRenderingContext2D,
    props: {
      initialSeed,
      iterations: 300,
      backgroundBrightness: 30,
      rectEnabled: true,
      rectBrightness: [0, 255],
      rectAlpha: [0, 128],
      rectScale: 100,
      gridEnabled: true,
      gridBrightness: [0, 255],
      gridAlpha: [0, 128],
      gridScale: 100,
      gridAmount: [1, 5],
      gridGap: 20,
      colsEnabled: true,
      colsBrightness: [0, 255],
      colsAlpha: [0, 128],
      colsScale: 100,
      colsAmount: [1, 5],
      colsGap: 20,
      rowsEnabled: true,
      rowsBrightness: [0, 255],
      rowsAlpha: [0, 128],
      rowsScale: 100,
      rowsAmount: [1, 5],
      rowsGap: 20,
      linesEnabled: true,
      linesBrightness: [0, 255],
      linesAlpha: [0, 128],
      linesWidth: [1, 10],
      spritesEnabled: false,
      sprites: [],
      spritesRotationEnabled: false,
      seamlessTextureEnabled: false,
      compositionModes: ['multiply', 'screen', 'overlay'],
    },
  });
  return ctx.trace;
};

const hashTrace = (trace: TraceEvent[]): string =>
  createHash('sha256').update(JSON.stringify(trace)).digest('hex');

describe('draw determinism guard', () => {
  it('produces an identical operation trace for the same seed', () => {
    const a = runTrace(12345);
    const b = runTrace(12345);
    expect(a.length).toBeGreaterThan(0);
    expect(hashTrace(a)).toBe(hashTrace(b));
  });

  it('produces a different trace for a different seed', () => {
    const a = runTrace(12345);
    const b = runTrace(67890);
    expect(hashTrace(a)).not.toBe(hashTrace(b));
  });

  it('matches the recorded baseline trace', () => {
    const trace = runTrace(12345);
    expect({
      events: trace.length,
      hash: hashTrace(trace),
    }).toMatchInlineSnapshot(`
      {
        "events": 1256,
        "hash": "892a25adb4eb7fa950bfb203344bf2e23f83f964c7befac29c653c5f6c7097d7",
      }
    `);
  });
});
