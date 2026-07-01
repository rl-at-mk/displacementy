import clsx from 'clsx';
import {forwardRef} from 'react';

type CanvasProps = {
  readonly width: number;
  readonly height: number;
  readonly isRendering: boolean;
  readonly isExporting: boolean;
  readonly isPristine: boolean;
  /** Progress in `0..1` (only meaningful while rendering/exporting). */
  readonly progress: number;
};

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  (
    {width, height, isRendering, isExporting, isPristine, progress},
    forwardedRef,
  ) => {
    const isBusy = isRendering || isExporting;
    const busyLabel = isExporting ? 'Exporting' : 'Rendering';
    return (
      <div
        className={clsx(
          'relative flex aspect-square w-full max-w-xl items-center justify-center border border-dashed',
          isBusy ? 'border-pink' : 'border-white',
        )}
      >
        <canvas
          ref={forwardedRef}
          className='absolute inset-0 max-h-full max-w-full'
          width={width}
          height={height}
          role='img'
          aria-busy={isBusy}
          aria-label={
            isPristine
              ? `Empty canvas, ${width}×${height}. Render to generate a displacement map.`
              : `Generated displacement map, ${width}×${height}.`
          }
        >
          <span className='absolute inset-0 flex items-center justify-center p-2 text-center text-sm'>
            HTML canvas is not supported in this browser
          </span>
        </canvas>
        {/* Sighted-only overlay; the live region below announces the busy state. */}
        <div
          aria-hidden='true'
          className={clsx(
            'absolute flex h-full w-full flex-col items-center justify-center gap-3 bg-black/50',
            !isBusy && 'hidden',
          )}
        >
          <span className='animate-pulse text-lg text-pink uppercase'>
            {`${busyLabel} ${Math.round(progress * 100)}%`}
          </span>
          <div className='h-1 w-1/2 overflow-hidden rounded-full bg-white/20'>
            <div
              className='h-full bg-pink transition-[width] duration-150 ease-out'
              style={{width: `${Math.round(progress * 100)}%`}}
            />
          </div>
        </div>
        <span className='sr-only' role='status' aria-live='polite'>
          {isBusy ? `${busyLabel} displacement map` : ''}
        </span>
      </div>
    );
  },
);

Canvas.displayName = 'Canvas';
