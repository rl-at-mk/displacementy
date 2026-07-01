# Spec — Rendering core, export & derived maps

> Status: everything under **Shipped** is done, tested, and verified in-browser
> (82 unit tests green at last count). Active work: **LUT editor with draggable
> stops** — see the final section. (The prior parameter-locks spec was fully
> implemented and removed; the code is its record.)

## Shipped — CPU float-precision rendering core (Phases 0–D)

**What/why.** The 8-bit Canvas2D accumulation target was replaced with a **CPU
`Float32` framebuffer** so the heightmap carries true >8-bit precision (Canvas2D
rounds every composite pass to 8 bits — cumulative quantization capped output at
256 levels, so 16-bit export was pointless without this). CPU rather than GPU
float because **JS IEEE-754 math is bit-identical across machines** while GPU
results are not — preserving the "same URL → identical image everywhere" contract
behind Copy-URL and locks. Baseline change vs. the old renderer was accepted
(pre-1.0, no users; Decision C — no compatibility shim).

**Architecture facts (still binding):**

- `draw.ts` is unchanged; the float core is
  [FloatRenderTarget.ts](src/components/pages/Generator/CanvasSection/utils/float/FloatRenderTarget.ts),
  implementing the `CanvasRenderingContext2D` subset `draw()` uses. Blend math
  (all 16 modes per the W3C compositing spec, reduced to scalar on grayscale) is
  in [blendModes.ts](src/components/pages/Generator/CanvasSection/utils/float/blendModes.ts),
  unit-tested against Canvas2D at 8-bit tolerance.
- Buffer is **value + alpha** (two `Float32Array`s, ~512 MB at 8192²) — faithful
  `xor`/`source-atop` need tracked alpha. `toRGBA()` forces **alpha = 255** on
  output (a height map has no transparency; keeps display and all exports
  consistent).
- Integer rasterization (no sub-pixel edge AA; ≤1px vs. canvas, irrelevant for
  heightmaps). Sprites rasterize via offscreen canvas then blend per-pixel in
  float; rotation is 90°-multiples only.
- **Render runs in a Web Worker** ([renderWorker.ts](src/components/pages/Generator/CanvasSection/utils/renderWorker.ts))
  via a synchronous `drawSync` core; main thread pre-rasterizes SVG sprites to
  transferable `ImageBitmap`s. Worker `onProgress` drives a determinate progress
  bar in the canvas overlay ([Canvas.tsx](src/components/pages/Generator/CanvasSection/Canvas/Canvas.tsx)).
- **Determinism guard** ([draw.determinism.test.ts](src/components/pages/Generator/CanvasSection/utils/draw.determinism.test.ts)):
  hashes the ordered op trace `draw()` issues per seed (pure PRNG output, no
  pixels) with a baseline tripwire. **Every change must keep it green** — it has
  stayed hash-identical through all refactors. PRNG is Mulberry32, consumption
  order preserved.

**Export (single-file Download, bit-depth selector `8 | 16 | 32`):**

- **8-bit PNG** — the visible canvas as-is (respects preview/inversion).
- **16-bit grayscale PNG** — from the retained float buffer via `fast-png`
  ([heightmapPng.ts](src/components/pages/Generator/CanvasSection/utils/heightmapPng.ts));
  independent of preview. Verified >256 distinct levels (no banding).
- **32-bit float OpenEXR** — hand-rolled, zero-dependency **uncompressed
  single-channel (`Y`) FLOAT scanline** EXR
  ([heightmapExr.ts](src/components/pages/Generator/CanvasSection/utils/heightmapExr.ts));
  values verbatim (no quantization/clamping, out-of-`0..1` headroom survives).
  Chosen over raw `.r32`/TIFF (self-describing; native in Blender/Nuke/World
  Machine). Validated against the real `OpenEXR` Python library.

**Performance profile (measured in-browser, default settings):** 2048² render
with sprites **~0.7 s**; 8192² render **~28 s** (determinism-bound CPU core,
gated by the progress bar), 4-map export **~9 s**, main-thread peak heap
~308 MB, no OOM. Optional future polish (not blockers): tiling, "live forming"
intermediate frames during render.

## Shipped — Multi-map ZIP export (v1 + v2)

One **"Export maps (.zip)"** button exports the selected derived maps in a single
zip, without disturbing the on-screen preview.

- **Single source:** all maps derive from the retained float buffer
  (`lastHeightsRef` — invalidated on resolution change; also records the render's
  **seamless flag**). Preview and export share the same pure per-map functions
  (the old in-place `drawNormal`/`drawColor` were deleted; their `w`/`h` bug fixed).
- **Offloaded:** derivation + `fast-png` encode + `fflate` `zipSync` (level 0 —
  PNGs are already deflate-compressed) run in
  [exportWorker.ts](src/components/pages/Generator/CanvasSection/utils/exportWorker.ts)
  wrapping the pure [buildMapsZip.ts](src/components/pages/Generator/CanvasSection/utils/maps/buildMapsZip.ts);
  a *copy* of the heights is transferred (retained buffer stays intact). Reuses
  the render progress overlay, relabeled "Exporting NN%".
- **Filenames:** member = `{map.prefix}{base}{map.suffix}.png`, zip =
  `{base}.zip`. Shared Base defaults to `DisplacementY_{W}x{H}` and tracks
  resolution; **no auto timestamp** (user owns the name). Windows-reserved chars
  stripped; empty stems fall back; a **collision guard** disables export when two
  included maps resolve to the same name.
- **Options panel** (collapsible; uses the new
  [Input](src/components/ui/Input/Input.tsx) text primitive): per-map include
  checkboxes, per-map prefix/suffix with live filename preview, per-map param
  sliders, per-map bit-depth where applicable.
- **Per-map depth/channels:** height = 1-ch grayscale, depth follows the global
  selector (`32`→16 in the zip); normal = RGB with its own 8/16 radio; color =
  RGB 8-bit (LUT is inherently ≤256 bands). Unused alpha dropped everywhere.

## Shipped — Derived-maps registry + ambient occlusion

- **Registry** ([registry.ts](src/components/pages/Generator/CanvasSection/utils/maps/registry.ts),
  [types.ts](src/components/pages/Generator/CanvasSection/utils/maps/types.ts)):
  each map is a pure, Worker-safe **`MapDescriptor { key, label, channels,
  depthMode, defaultInclude, defaultSuffix, params[], derive(ctx, depth),
  previewRGBA?(ctx) }`**. `buildMapsZip`, the export Worker, the preview toggles,
  and all per-map UI iterate the registry — **adding a map is one entry + its
  derivation, no plumbing changes** (proven behavior-preserving: default export
  stayed byte-identical through the refactor).
- **Maps:** height (grayscale 8/16) · normal (**3×3 Sobel**, OpenGL/+Y encoding,
  strength 0.1–5, 8/16-bit RGB —
  [normalMap.ts](src/components/pages/Generator/CanvasSection/utils/maps/normalMap.ts)) ·
  color (palette LUT over float heights —
  [colorMap.ts](src/components/pages/Generator/CanvasSection/utils/maps/colorMap.ts)) ·
  **AO** (**HBAO**, 8 directions × 8 steps, tunable radius + strength, grayscale,
  off by default — [ao.ts](src/components/pages/Generator/CanvasSection/utils/maps/ao.ts)).
- **AO at scale:** above 2048², `toAO8Auto` box-downsamples the heights, runs
  HBAO there (radius scaled), bilinearly upscales — 8192² 4-map export dropped
  **~57 s → ~9 s**, visually ~identical (AO is low-frequency).
- **Seamless tiling:** derived maps must tile when the render does. A shared
  sampler ([sampleHeights.ts](src/components/pages/Generator/CanvasSection/utils/maps/sampleHeights.ts))
  **wraps** neighbor sampling when seamless (clamps otherwise); the AO upscale
  wraps too. The flag is captured at render time and threaded through
  `MapContext`. Verified by shift-equivariance tests (`AO(roll(h)) ===
  roll(AO(h))` under wrap) and a live seam-continuity check (seam |Δ| ≪ interior).
- **Future maps (unbuilt):** roughness / specular / metalness (LUT remaps of
  height/slope), curvature — each just a registry entry once the scalar-LUT
  machinery below lands.

## Decisions (resolved, condensed)

- **A.** Accumulation buffer: single-channel grayscale float (+ alpha channel for
  compositing); RGBA float (~1 GiB at 8192²) rejected.
- **B.** Encoders: `fast-png` for PNG; EXR hand-rolled (small, self-contained;
  keeps `fast-png` the only encoder dep).
- **C.** New rendering baseline accepted; no shim for old URLs.
- **D.** Web Worker done (render + export both off the main thread).
- Zip: `fflate` level 0. Filenames: per-map prefix/suffix around a shared base,
  no timestamp. Normal-map algorithm: Sobel. AO: HBAO with auto-downsample >2048².

## Out of scope

- GPU/WebGL generation (breaks cross-machine determinism).
- Parallelizing the generation loop (breaks PRNG order).
- Group-level locks, lock-all, reroll-as-preset (from the prior locks spec).

---

## Active — LUT editor with draggable stops (planned, not implemented)

Replace the fixed even-spacing gradient with **draggable stop positions**, built
as **reusable LUT machinery** so future scalar maps (roughness/specular/
metalness) are one registry entry each.

**Resolved decisions:** scope = **color map only** this pass (scalar path built +
unit-tested, no new map shipped); interpolation = **sRGB-linear** (parity with
today's canvas gradient; OKLab a trivial future swap); stops **persist in the
Copy-URL** query.

1. **LUT core — new `maps/lut.ts` (pure, Worker-safe).**
   - `type Stop = { position: number; color: ColorRGB }` (position free in `0..1`).
   - `buildLUT(stops, size=256) → Uint8Array` — sort by position, sRGB-linear
     interpolate between stops, clamp ends. Replaces the canvas
     `createLinearGradient` + row-0 readback entirely (deterministic, testable,
     no DOM).
   - `applyLUT(heights, lut, w, h, channels) → Uint8Array` — generalizes today's
     color lookup (`index = round(clamp(v)·(len−1))`) to N channels: `3` = color
     RGB, `1` = grayscale for future scalar maps.
   - `colorMap.ts` (`toColorMapRGB8`, `paletteFromRowRGBA`) is superseded and
     removed.
2. **Reusable editor — new `ui/LutEditor` (replaces `Gradient`).**
   - Gradient preview bar (CSS `linear-gradient` with positioned stops, matching
     `buildLUT`) + **draggable stop handles**: pointer-drag repositions, click on
     the bar adds a stop, select→edit/delete; min 2 stops; Randomize.
   - `mode: 'color' | 'scalar'` — color mode edits stops with the existing
     `ColorPicker`; scalar mode uses a 0–255 value slider (built now, first used
     by a future roughness map).
   - A11y: each handle is a `slider`-role element (`aria-valuenow` = position),
     arrow keys nudge.
3. **Registry integration.**
   - `MapDescriptor.lut?: { mode: 'color'|'scalar'; defaultStops: Stop[] }`;
     `MapContext.palette` → `lut: Uint8Array`.
   - Main thread builds each LUT-map's LUT from its stops and passes it to the
     Worker/preview (mirrors the old palette flow — Worker still receives plain
     data). CanvasSection renders a `LutEditor` for every map declaring `lut`;
     `gradientCanvasRef` and the `Gradient` component are deleted.
4. **URL persistence (store).**
   - `Values.lutStops: Record<string, Stop[]>` + `setLutStops(mapKey, stops)`.
   - Query encoding: `lut_<mapkey>=PPRRGGBB,PPRRGGBB,…` (2-hex position byte +
     6-hex color per stop); parse side reads any `lut_*` params generically so
     the store stays decoupled from the registry. Effective stops =
     `store.lutStops[key] ?? descriptor.defaultStops`.
   - Excluded from "Randomize all" (keeps its own Randomize); not lockable. No
     effect on the determinism guard (color is post-render). Old URLs simply fall
     back to defaults.
5. **Parity note.** Default stops migrate to 3 colors at positions 0 / 0.5 / 1 —
   a fresh load looks identical to today; the change is that positions become
   explicit and editable (auto even-spacing goes away by design).

**Verification plan:** unit tests for `buildLUT` (arbitrary positions, endpoint
clamping, interpolation) and `applyLUT` (1-ch + 3-ch); store round-trip test for
the stop encoding; live check that dragging updates the preview, Copy-URL
round-trips the gradient, and default output matches today's.
