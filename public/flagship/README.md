# Flagship frame sequences

Drop Apple-style image-sequence frames here so the scrollytelling canvas can scrub them on scroll.

## Layout

```
public/flagship/<slug>/frames/
  frame_0001.webp
  frame_0002.webp
  …
  frame_0060.webp
```

Example for the default jersey experience:

```
public/flagship/scc-jersey-2026/frames/frame_0001.webp
…
public/flagship/scc-jersey-2026/frames/frame_0060.webp
```

## Config

Edit `src/lib/flagship/config.ts`:

- `slug` — URL at `/flagship/[slug]`
- `productId` — catalog product id (or use `match` rules)
- `framesFolder` — e.g. `/flagship/scc-jersey-2026/frames`
- `frameCount` — total frames (desktop)
- `mobileFrameStep` / `mobileMaxFrames` — subsample on coarse pointer / narrow viewports

You can also set `frames: string[]` to absolute or `/public` URLs instead of the folder pattern.

## Fallback

If frames are missing (404) or the list is empty, the experience uses 1–3 product images with scroll-linked scale / opacity / pan so the page still works without a full sequence.
