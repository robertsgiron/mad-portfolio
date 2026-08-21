# Portfolio Menu

Open this folder in VS Code (`code .` from a terminal, or File → Open Folder).
No build step — just open `index.html` in a browser (right-click → "Open with Live Server"
if you have that extension, or double-click the file). If the video doesn't autoplay when
opened directly from disk, serve the folder locally instead (Live Server, or
`python3 -m http.server` from inside this folder) — some browsers restrict autoplay for
files opened via `file://`.

## Files
- `index.html` — structure/markup
- `style.css` — palette, film grain, glitch animations, layout
- `script.js` — bar-swap glitch logic
- `assets/hero-loop.mp4` — your video, looping muted in the center square

## What changed in this revision
- Font is now Helvetica Neue everywhere (system font stack, no external font load needed).
- Contact info is `position: fixed`, bottom-right — it never moves, even on scroll.
- Top strip background is pure white; the grain overlay uses `mix-blend-mode: multiply`
  at low opacity instead of `overlay`, so it no longer washes the area gray.
- 10 bars now (up from 5), each with independently randomized width *and* height on every
  move, plus 3 static red hairlines — more visual density at the top.
- Bar palette extended with a cold night-blue range (`#0d1b2e` → `#93b3d3`) alongside the
  original black/gray tones, echoing Heat's nocturnal LA color grade. Red is still
  reserved exclusively for the hairlines.
- Glitch timing tightened to 900–1900ms per bar (was 3200–6200ms) for a livelier, more
  consistently active top strip.
- The hover "focus bar" interaction has been removed entirely.
- Every bar has a faint 1px inset border (`box-shadow`) so it stays visible even if it
  lands on a very light color against the white background.

## Quick reference for tweaking

**Palette** — `BAR_PALETTE` array at the top of `script.js`. Keep it red-free; red is
hardcoded onto `.line` in `style.css` (`--heat-red`) and should stay exclusive to those.

**Glitch speed** — `--glitch-speed`, `--glitch-pause-min`, `--glitch-pause-max` in
`style.css` (`:root`). Smaller pause numbers = busier/more frequent movement.

**Bar count / layout** — `index.html` has 13 `.slot` elements (10 bars + 3 static red
lines). `script.js`'s `barSlotIndex` array maps each bar to its starting slot number —
add more slots in the HTML and extend that array to add more bars.

**Bio link** — `#bioLink` in `index.html` currently points to `#bio` as a placeholder.
Swap the `href` for your real bio page/anchor.

**Centering** — `.content` in `style.css` uses flexbox (`justify-content: center`,
`align-items: center`) to center everything vertically and horizontally in the space
between the bar zone and the fixed footer. The footer height is reserved via
`--footer-height` so content never sits underneath it.

## Project pages
- `metamorphosis.html` and `mpc-logo.html` are individual project pages, styled
  from the shared `project.css`. Each has: an image (left), a title + meta line
  (right), and an empty `.project-body` div reserved for write-up copy — just
  type directly inside that `<div class="project-body">...</div>` in the HTML.
- Images live in `assets/media/`. Add new project images there and point a new
  page's `<img src="assets/media/your-file.jpg">` at them.
- `.project-image-frame` crops to a 3:2 box via `object-fit: cover` (used for
  Metamorphosis). Add the `frameless` class (see `mpc-logo.html`) for images
  that should show uncropped and without a background box — best for logos or
  anything with transparency, like the MPC asset.
- The menu's "Metamorphosis" and "Music Production Club" links in `index.html`
  now point to these two pages. The other three tracks (Tree of Light, To Live
  and Die in LA, Goodbye Horses) still use `#` placeholder anchors — swap
  those in the same way (`href="your-new-page.html"`) once you have pages for
  them, following the same two files as a template.
- Every project page has a small "← menu" link fixed to the top-left corner
  that routes back to `index.html`. Remove `.back-link` from `project.css` if
  you don't want it.

## Notes
- Bars can never overlap by construction: they live in fixed, mutually exclusive
  horizontal slots and only ever swap slots with one another — they don't free-roam
  in pixel space.
- Respects `prefers-reduced-motion` (grain and bar transitions get quieted).
- Video is `autoplay muted loop playsinline` — required by browsers to autoplay
  without a user gesture.
