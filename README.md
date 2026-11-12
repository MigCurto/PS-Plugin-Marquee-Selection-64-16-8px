# Marquee 64/16px Setup — Photoshop UXP Panel Plugin

A dockable Photoshop panel that sets up the **Rectangular Marquee Tool** on
**64/16-pixel increments** (toggleable):

- Two sliders — **Width** and **Height** — each stepping in 64 px (64 → 4096).
  Each has its description on the left and current pixel value on the right of
  one line, with the slider on its own full-width line beneath.
- A live **MP** readout (area in megapixels, one decimal).
- Four equal-size buttons: **Draw rectangular Marquee tool**,
  **Copy (merged)**, **Paste (from Clipboard)**, and
  **Conform existing selection**.

## What the button does

1. Selects the Rectangular Marquee Tool (`select` → `marqueeRectTool`).
2. **Clears any existing selection** first, so the new marquee replaces it
   instead of being unioned with it (`set` → channel `selection` → `none`).
3. Creates a fixed-size rectangular selection of the chosen `width × height`,
   **centered** in the active document (`addTo` → channel `selection` →
   object `rectangle` with `bottom/left/right/top` bounds in `pixelsUnit`).
4. **Transforms** the selection right after creation so it can be easily
   dragged (`transform` → channel `selection`, offset 0/0).

All four steps are verified — steps 3 and 4 use the exact descriptors the
user recorded in Photoshop via **Copy As JavaScript**.

The **Copy (merged)** button runs `{ _obj: 'copyMerged' }`, and
**Paste (from Clipboard)** runs
`{ _obj: 'paste', antiAlias, as: { _class: 'pixel' }, inPlace: false }` — both
verified from Adobe developer Mike Chambers' UXP command library
(`mikechambers/adb-mcp`).

The **Conform existing selection** button reads the current selection bounds,
 rounds width and height up to the next multiple of the active step (64 or 16,
minimum = the active step), replaces the
selection anchored at its original top-left, and updates both sliders to the new
size (raising a slider's max if the size exceeds 4096). Requires Photoshop 25+.

## Loading the plugin

1. Install **Photoshop 25+** and the **UXP Developer Tool** (free, from Adobe).
2. In UXP Developer Tool: **Add Plugin** → select this folder.
3. Click **Load** — the panel appears under **Window > Extensions > Marquee 64/16px Setup**.


## Files

- `manifest.json` — plugin manifest (panel entrypoint).
- `index.html` — panel UI (sliders, MP readout, buttons).
- `index.js` — panel logic using `require('photoshop')` + `batchPlay`.
- `icons/` — plugin icons.
