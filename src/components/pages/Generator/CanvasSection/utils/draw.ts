import {type NumberDual} from '@/types';
import {degreesToRadians} from '@/utils/math';
import {xxx, xxxa} from '@/utils/colors';
import {
  randomBoolean,
  randomInteger,
  randomItem,
  setSeed,
} from '@/utils/random';
import {getCanvasDimensions} from './getCanvasDimensions';
import {clearCanvas} from './clearCanvas';
import {type CompositionMode} from '../../constants';

/** A decoded, ready-to-draw sprite. An `ImageBitmap` so the core runs in a Worker. */
export type Sprite = ImageBitmap;

export type DrawProps = {
  initialSeed: number;
  iterations: number;
  backgroundBrightness: number;
  rectEnabled: boolean;
  rectBrightness: NumberDual;
  rectAlpha: NumberDual;
  rectScale: number;
  gridEnabled: boolean;
  gridBrightness: NumberDual;
  gridAlpha: NumberDual;
  gridScale: number;
  gridAmount: NumberDual;
  gridGap: number;
  colsEnabled: boolean;
  colsBrightness: NumberDual;
  colsAlpha: NumberDual;
  colsScale: number;
  colsAmount: NumberDual;
  colsGap: number;
  rowsEnabled: boolean;
  rowsBrightness: NumberDual;
  rowsAlpha: NumberDual;
  rowsScale: number;
  rowsAmount: NumberDual;
  rowsGap: number;
  linesEnabled: boolean;
  linesBrightness: NumberDual;
  linesAlpha: NumberDual;
  linesWidth: NumberDual;
  spritesEnabled: boolean;
  sprites: Sprite[];
  spritesRotationEnabled: boolean;
  seamlessTextureEnabled: boolean;
  compositionModes: CompositionMode[];
};

/**
 * Synchronous render core. Runs the full deterministic generation loop into the
 * given target — a real 2D context, the float target, or a recording stub. It
 * uses NO `requestAnimationFrame`, so it can run inside a Web Worker (where
 * blocking is fine); coarse progress is reported via `onProgress`. The op
 * sequence is identical to the previous rAF-batched renderer, so the determinism
 * guard hash is unchanged.
 */
export const drawSync = ({
  ctx2d,
  props,
  onProgress,
}: {
  ctx2d: CanvasRenderingContext2D;
  props: DrawProps;
  onProgress?: (fraction: number) => void;
}): void => {
  const {
    initialSeed,
    iterations,
    backgroundBrightness,
    rectEnabled,
    rectBrightness,
    rectAlpha,
    rectScale,
    gridEnabled,
    gridBrightness,
    gridAlpha,
    gridScale,
    gridAmount,
    gridGap,
    colsEnabled,
    colsBrightness,
    colsAlpha,
    colsScale,
    colsAmount,
    colsGap,
    rowsEnabled,
    rowsBrightness,
    rowsAlpha,
    rowsScale,
    rowsAmount,
    rowsGap,
    linesEnabled,
    linesBrightness,
    linesAlpha,
    linesWidth,
    spritesEnabled,
    sprites,
    spritesRotationEnabled,
    seamlessTextureEnabled,
    compositionModes,
  } = props;

  setSeed(initialSeed);
  clearCanvas(ctx2d);
  drawBackground({ctx2d, backgroundBrightness});

  const originalCompositeOperation = ctx2d.globalCompositeOperation;

  // Report progress every Nth iteration (no canvas op, so the op trace is
  // unaffected).
  const progressEvery = 64;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const compositionMode = randomItem(compositionModes);
    if (compositionMode) {
      ctx2d.globalCompositeOperation = compositionMode;
    }

    switch (randomInteger(0, 5)) {
      case 0:
        if (!rectEnabled) break;
        drawRect({
          ctx2d,
          rectBrightness,
          rectAlpha,
          rectScale,
          seamlessTextureEnabled,
        });
        break;
      case 1:
        if (!gridEnabled) break;
        drawGrid({
          ctx2d,
          gridBrightness,
          gridAlpha,
          gridScale,
          gridAmount,
          gridGap,
          seamlessTextureEnabled,
        });
        break;
      case 2:
        if (!colsEnabled) break;
        drawCols({
          ctx2d,
          colsBrightness,
          colsAlpha,
          colsScale,
          colsAmount,
          colsGap,
          seamlessTextureEnabled,
        });
        break;
      case 3:
        if (!rowsEnabled) break;
        drawRows({
          ctx2d,
          rowsBrightness,
          rowsAlpha,
          rowsScale,
          rowsAmount,
          rowsGap,
          seamlessTextureEnabled,
        });
        break;
      case 4:
        if (!linesEnabled) break;
        drawLines({ctx2d, linesBrightness, linesAlpha, linesWidth});
        break;
      case 5:
        if (!spritesEnabled) break;
        drawSprite({
          ctx2d,
          sprites,
          spritesRotationEnabled,
          seamlessTextureEnabled,
        });
        break;
      default:
        break;
    }

    if (onProgress && iteration % progressEvery === 0) {
      onProgress(iteration / iterations);
    }
  }

  ctx2d.globalCompositeOperation = originalCompositeOperation;
  onProgress?.(1);
};

const drawSeamless = ({
  x,
  y,
  rectW,
  rectH,
  canvasW,
  canvasH,
  seamlessTextureEnabled,
  drawFunc,
}: {
  x: number;
  y: number;
  rectW: number;
  rectH: number;
  canvasW: number;
  canvasH: number;
  seamlessTextureEnabled: boolean;
  drawFunc: (x: number, y: number, rectW: number, rectH: number) => void;
}): void => {
  if (seamlessTextureEnabled) {
    while (x + rectW > canvasW) {
      x -= canvasW;
    }
    while (y + rectH > canvasH) {
      y -= canvasH;
    }
    for (let ox = 0; x + ox <= canvasW; ox += canvasW) {
      for (let oy = 0; y + oy <= canvasH; oy += canvasH) {
        drawFunc(x + ox, y + oy, rectW, rectH);
      }
    }
  } else {
    drawFunc(x, y, rectW, rectH);
  }
};

const drawBackground = ({
  ctx2d,
  backgroundBrightness,
}: {
  ctx2d: CanvasRenderingContext2D;
  backgroundBrightness: number;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);
  ctx2d.fillStyle = xxx({x: backgroundBrightness});
  ctx2d.fillRect(0, 0, w, h);
};

const drawRect = ({
  ctx2d,
  rectBrightness,
  rectAlpha,
  rectScale,
  seamlessTextureEnabled,
}: {
  ctx2d: CanvasRenderingContext2D;
  rectBrightness: NumberDual;
  rectAlpha: NumberDual;
  rectScale: number;
  seamlessTextureEnabled: boolean;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);
  ctx2d.fillStyle = xxxa({
    x: randomInteger(...rectBrightness),
    a: randomInteger(...rectAlpha),
  });
  const rectW = Math.round(
    randomInteger(Math.round(w / 16), Math.round(w / 8)) * (rectScale / 100),
  );
  const rectH = Math.round(
    randomInteger(Math.round(w / 16), Math.round(w / 8)) * (rectScale / 100),
  );
  const x = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-rectW / 2),
    seamlessTextureEnabled ? Math.round(w) : Math.round(w - rectW / 2),
  );
  const y = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-rectH / 2),
    seamlessTextureEnabled ? Math.round(h) : Math.round(h - rectH / 2),
  );
  drawSeamless({
    x,
    y,
    rectW,
    rectH,
    canvasW: w,
    canvasH: h,
    seamlessTextureEnabled,
    drawFunc: (x, y, rectW, rectH) => {
      ctx2d.fillRect(x, y, rectW, rectH);
    },
  });
};

const drawGrid = ({
  ctx2d,
  gridBrightness,
  gridAlpha,
  gridScale,
  gridAmount,
  gridGap,
  seamlessTextureEnabled,
}: {
  ctx2d: CanvasRenderingContext2D;
  gridBrightness: NumberDual;
  gridAlpha: NumberDual;
  gridScale: number;
  gridAmount: NumberDual;
  gridGap: number;
  seamlessTextureEnabled: boolean;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);

  ctx2d.fillStyle = xxxa({
    x: randomInteger(...gridBrightness),
    a: randomInteger(...gridAlpha),
  });
  const x0 = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-w / 16),
    Math.round(w),
  );
  const y0 = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-h / 16),
    Math.round(h),
  );
  const xn = randomInteger(...gridAmount);
  const yn = randomInteger(...gridAmount);
  const scale = gridScale / 100;
  const gap = gridGap / 100;
  const size = Math.round(
    randomInteger(Math.round(w / 256), Math.round(w / 16)) * scale,
  );

  for (let i = 0, x = x0; i < xn; i++) {
    for (let j = 0, y = y0; j < yn; j++) {
      drawSeamless({
        x,
        y,
        rectW: size,
        rectH: size,
        canvasW: w,
        canvasH: h,
        seamlessTextureEnabled,
        drawFunc: (x, y, rectW, rectH) => {
          ctx2d.fillRect(x, y, rectW, rectH);
        },
      });
      y += size + Math.round(size * gap);
    }

    x += size + Math.round(size * gap);
  }
};

const drawCols = ({
  ctx2d,
  colsBrightness,
  colsAlpha,
  colsScale,
  colsAmount,
  colsGap,
  seamlessTextureEnabled,
}: {
  ctx2d: CanvasRenderingContext2D;
  colsBrightness: NumberDual;
  colsAlpha: NumberDual;
  colsScale: number;
  colsAmount: NumberDual;
  colsGap: number;
  seamlessTextureEnabled: boolean;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);

  ctx2d.fillStyle = xxxa({
    x: randomInteger(...colsBrightness),
    a: randomInteger(...colsAlpha),
  });

  const x0 = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-w / 16),
    Math.round(w),
  );
  const y0 = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-h / 16),
    Math.round(h),
  );
  const xn = randomInteger(...colsAmount);
  const scale = colsScale / 100;
  const gap = colsGap / 100;
  const sizeW = Math.round(
    randomInteger(Math.round(w / 256), Math.round(w / 16)) * scale,
  );
  const sizeH = Math.round(sizeW * randomInteger(1, 10));

  for (let i = 0, x = x0; i < xn; i++) {
    drawSeamless({
      x,
      y: y0,
      rectW: sizeW,
      rectH: sizeH,
      canvasW: w,
      canvasH: h,
      seamlessTextureEnabled,
      drawFunc: (x, y, rectW, rectH) => {
        ctx2d.fillRect(x, y, rectW, rectH);
      },
    });
    x += sizeW + Math.round(sizeW * gap);
  }
};

const drawRows = ({
  ctx2d,
  rowsBrightness,
  rowsAlpha,
  rowsScale,
  rowsAmount,
  rowsGap,
  seamlessTextureEnabled,
}: {
  ctx2d: CanvasRenderingContext2D;
  rowsBrightness: NumberDual;
  rowsAlpha: NumberDual;
  rowsScale: number;
  rowsAmount: NumberDual;
  rowsGap: number;
  seamlessTextureEnabled: boolean;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);

  ctx2d.fillStyle = xxxa({
    x: randomInteger(...rowsBrightness),
    a: randomInteger(...rowsAlpha),
  });

  const x0 = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-w / 16),
    Math.round(w),
  );
  const y0 = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-h / 16),
    Math.round(h),
  );
  const yn = randomInteger(...rowsAmount);
  const scale = rowsScale / 100;
  const gap = rowsGap / 100;
  const sizeH = Math.round(
    randomInteger(Math.round(w / 256), Math.round(w / 16)) * scale,
  );
  const sizeW = Math.round(sizeH * randomInteger(1, 10));

  for (let i = 0, y = y0; i < yn; i++) {
    drawSeamless({
      x: x0,
      y,
      rectW: sizeW,
      rectH: sizeH,
      canvasW: w,
      canvasH: h,
      seamlessTextureEnabled,
      drawFunc: (x, y, rectW, rectH) => {
        ctx2d.fillRect(x, y, rectW, rectH);
      },
    });
    y += sizeH + Math.round(sizeH * gap);
  }
};

const drawLines = ({
  ctx2d,
  linesBrightness,
  linesAlpha,
  linesWidth,
}: {
  ctx2d: CanvasRenderingContext2D;
  linesBrightness: NumberDual;
  linesAlpha: NumberDual;
  linesWidth: NumberDual;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);

  ctx2d.fillStyle = xxxa({
    x: randomInteger(...linesBrightness),
    a: randomInteger(...linesAlpha),
  });

  if (randomBoolean()) {
    // Horizontal
    const y = randomInteger(Math.round(-h / 16), Math.round(h));
    const thickness = Math.round(randomInteger(...linesWidth) * (h / 2500));
    ctx2d.fillRect(0, y, w, thickness);
  } else {
    // Vertical
    const x = randomInteger(Math.round(-w / 16), Math.round(w));
    const thickness = Math.round(randomInteger(...linesWidth) * (w / 2500));
    ctx2d.fillRect(x, 0, thickness, h);
  }
};

const drawSprite = ({
  ctx2d,
  sprites,
  spritesRotationEnabled,
  seamlessTextureEnabled,
}: {
  ctx2d: CanvasRenderingContext2D;
  sprites: Sprite[];
  spritesRotationEnabled: boolean;
  seamlessTextureEnabled: boolean;
}): void => {
  const sprite = randomItem(sprites);
  if (!sprite) return;

  const {w, h} = getCanvasDimensions(ctx2d);
  const size = randomInteger(Math.round(w / 32), Math.round(w / 2));
  const x = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-w / 16),
    Math.round(w),
  );
  const y = randomInteger(
    seamlessTextureEnabled ? 0 : Math.round(-h / 16),
    Math.round(h),
  );
  const angleDegrees = randomInteger(0, 3) * 90;
  if (spritesRotationEnabled) rotate({ctx2d, angleDegrees});
  drawSeamless({
    x,
    y,
    rectW: size,
    rectH: size,
    canvasW: w,
    canvasH: h,
    seamlessTextureEnabled,
    drawFunc: (x, y, rectW, rectH) => {
      ctx2d.drawImage(sprite, x, y, rectW, rectH);
    },
  });
  if (spritesRotationEnabled) rotateEnd({ctx2d, angleDegrees});
};

export const loadSprites = async (
  sprites: HTMLImageElement[],
): Promise<HTMLImageElement[]> => {
  const promises: Array<Promise<HTMLImageElement | undefined>> = [];
  sprites.forEach((sprite) => {
    promises.push(
      new Promise((resolve) => {
        if (sprite.complete) {
          resolve(sprite);
          return;
        }

        sprite.onload = () => {
          resolve(sprite);
        };

        sprite.onerror = () => {
          resolve(undefined);
        };
      }),
    );
  });
  const results = (await Promise.all(promises)).filter(Boolean);
  return results as HTMLImageElement[];
};

const rotate = ({
  ctx2d,
  angleDegrees,
}: {
  ctx2d: CanvasRenderingContext2D;
  angleDegrees: number;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);
  const wc = Math.round(w / 2);
  const hc = Math.round(h / 2);
  const angleRadians = degreesToRadians(angleDegrees);
  ctx2d.translate(wc, hc);
  ctx2d.rotate(angleRadians);
  ctx2d.translate(-wc, -hc);
};

const rotateEnd = ({
  ctx2d,
  angleDegrees,
}: {
  ctx2d: CanvasRenderingContext2D;
  angleDegrees: number;
}): void => {
  const {w, h} = getCanvasDimensions(ctx2d);
  const wc = Math.round(w / 2);
  const hc = Math.round(h / 2);
  const angleRadians = degreesToRadians(angleDegrees);
  ctx2d.translate(wc, hc);
  ctx2d.rotate(-angleRadians);
  ctx2d.translate(-wc, -hc);
};
