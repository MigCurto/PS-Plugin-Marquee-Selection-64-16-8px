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

## Draw Things workflow (no generation)

The plugin cannot push an image into Draw Things' canvas without generating:
UXP has no UI automation/AppleScript. The HTTP API server exposes only
`/sdapi/v1/txt2img`, `/sdapi/v1/img2img`, `/`, and `/sdapi/v1/options`, and the
gRPC service exposes only `Echo`, `FilesExist`, `GenerateImage`, `UploadFile`,
`Pubkey`, and `Hours` — no canvas or moodboard load endpoint. The app's
scripting API (`canvas.loadImage`) runs only inside Draw Things.

Reliable no-generation path:

1. Click **Copy (merged)** in the panel — the merged pixels go to the clipboard.
2. In Draw Things, press **⌘V** (Paste) to place the image on the canvas.

The installed app registers a real `drawthings` URL scheme, but it has no
documented commands; the `draw-things://` API sometimes cited online is a
fictional proposal, not a real feature.

## Loading the plugin

1. Install **Photoshop 25+** and the **UXP Developer Tool** (free, from Adobe).
2. In UXP Developer Tool: **Add Plugin** → select this folder.
3. Click **Load** — the panel appears under **Window > Extensions > Marquee 64/16px Setup**.

## Verification note (important)

The tool-selection, selection-clearing, selection-creation, and transform
descriptors are verified against published ExtendScript code and the user's
recorded **Copy As JavaScript** output.

Setting the marquee tool's **option-bar** fields (Style = Fixed Size, Width,
Height) is **not scriptable**: Photoshop does not record those UI-only changes
as actions, and the internal `currentToolOptions` descriptor (`$MrqI` /
`$MrqF`) is undocumented and varies by build. That attempt has been removed
from the panel.

Reliable workaround: set the marquee to Fixed Size + your dimensions once
manually, then save it as a **Tool Preset** (option bar → preset dropdown → +).
Selecting that preset gives you the pre-filled bar values.

## Files

- `manifest.json` — plugin manifest (panel entrypoint).
- `index.html` — panel UI (sliders, MP readout, buttons).
- `index.js` — panel logic using `require('photoshop')` + `batchPlay`.
- `icons/` — plugin icons.