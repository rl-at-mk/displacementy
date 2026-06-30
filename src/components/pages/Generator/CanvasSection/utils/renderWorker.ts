import {drawSync, type DrawProps} from './draw';
import {FloatRenderTarget} from './float/FloatRenderTarget';

export type RenderRequest = {
  props: DrawProps;
  width: number;
  height: number;
};

export type RenderResponse =
  | {type: 'progress'; fraction: number}
  | {
      type: 'done';
      rgba: Uint8ClampedArray;
      heights: Float32Array;
      width: number;
      height: number;
    };

// Dedicated-worker global. Casting avoids pulling in the "webworker" TS lib,
// which conflicts with the project's "dom" lib.
const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage: (message: RenderResponse, transfer?: Transferable[]) => void;
};

worker.onmessage = (event) => {
  const {props, width, height} = event.data;

  const target = new FloatRenderTarget(width, height);
  drawSync({
    ctx2d: target as unknown as CanvasRenderingContext2D,
    props,
    onProgress: (fraction) => {
      worker.postMessage({type: 'progress', fraction});
    },
  });

  // Read RGBA (for display) before transferring the float buffer (export).
  const rgba = target.toRGBA();
  const heights = target.heights;
  // Transfer both pixel buffers (zero-copy) back to the main thread.
  worker.postMessage({type: 'done', rgba, heights, width, height}, [
    rgba.buffer,
    heights.buffer,
  ]);
};
