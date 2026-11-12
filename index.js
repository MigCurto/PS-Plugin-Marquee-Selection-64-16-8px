// Marquee 64/16/8px Setup panel logic.
// Uses the Photoshop UXP API (require('photoshop')) and low-level batchPlay
// action descriptors to drive the Rectangular Marquee Tool.

const { app, action, core } = require('photoshop');

function updateLabels() {
  const w = Number(document.getElementById('width').value);
  const h = Number(document.getElementById('height').value);
  document.getElementById('widthVal').textContent = `${w} px`;
  document.getElementById('heightVal').textContent = `${h} px`;
  const mp = (w * h) / 1000000;
  document.getElementById('mp').textContent = `${mp.toFixed(1)} MP`;
}

document.getElementById('width').addEventListener('input', updateLabels);
document.getElementById('height').addEventListener('input', updateLabels);
updateLabels();

// Step-size mode: 64px or 16px. The toggle at the top switches between them.
let stepMode = 64;

function applyStepMode(mode) {
  stepMode = mode;
  const w = document.getElementById('width');
  const h = document.getElementById('height');
  w.min = String(mode);
  w.step = String(mode);
  h.min = String(mode);
  h.step = String(mode);
  // Keep current values as multiples of the new step.
  w.value = String(Math.max(mode, Math.ceil(Number(w.value) / mode) * mode));
  h.value = String(Math.max(mode, Math.ceil(Number(h.value) / mode) * mode));
  document.getElementById('widthUnit').textContent = `(px, ${mode}-step)`;
  document.getElementById('heightUnit').textContent = `(px, ${mode}-step)`;
  setActiveButton(mode);
  updateLabels();
}

function setActiveButton(mode) {
  const b64 = document.getElementById('stepBtn64');
  const b16 = document.getElementById('stepBtn16');
  const b8 = document.getElementById('stepBtn8');
  b64.classList.remove('activeStep');
  b16.classList.remove('activeStep');
  b8.classList.remove('activeStep');
  const active = mode === 64 ? b64 : mode === 16 ? b16 : b8;
  active.classList.add('activeStep');
}


function setStatus(text) {
  document.getElementById('status').textContent = text;
}

// batchPlay returns one result per descriptor. Surface any error so the user
// can see exactly what failed (result codes: 0 = ok, -128 = user cancelled).
function checkResults(results, label) {
  const errors = results.filter((r) => r && r._obj === 'error');
  if (errors.length) {
    const first = errors[0];
    return `${label} failed: ${first.message || 'unknown error'} (result ${first.result})`;
  }
  return null;
}

async function applyToTool() {
  const width = Number(document.getElementById('width').value);
  const height = Number(document.getElementById('height').value);

  if (!app.activeDocument) {
    await setStatus('No active document — open one first.');
    return;
  }

  await setStatus('Applying…');

  let outcome = '';

  await core.executeAsModal(
    async () => {
      // 1) Select the Rectangular Marquee Tool.
      // ExtendScript equivalent: executeAction('slct') with a class reference
      // to 'marqueeRectTool' (verified from Adobe community / StackOverflow).
      // In batchPlay actionJSON the command name is 'select'.
      const selRes = await action.batchPlay(
        [
          {
            _obj: 'select',
            _target: [{ _ref: 'marqueeRectTool' }],
          },
        ],
        {},
      );
      const selErr = checkResults(selRes, 'Select marquee tool');
      if (selErr) outcome += selErr + '\n';

      // 2) Clear any existing selection first, so the new marquee replaces it
      // instead of being unioned with it (addTo would otherwise keep the
      // larger previous selection). Verified batchPlay "deselect all" form.
      const clearRes = await action.batchPlay(
        [
          {
            _obj: 'set',
            _target: [{ _ref: 'channel', _property: 'selection' }],
            to: { _enum: 'ordinal', _value: 'none' },
          },
        ],
        {},
      );
      const clearErr = checkResults(clearRes, 'Clear selection');
      if (clearErr) {
        outcome += clearErr + '\n';
        return;
      }

      // 3) Create a fixed-size rectangular selection of width x height,
      // centered in the active document.
      // This is the exact descriptor the user recorded in Photoshop
      // ("Copy As JavaScript") for a fixed-size marquee selection:
      //   _obj 'addTo' -> channel selection -> to { _obj 'rectangle',
      //   bottom/left/right/top bounds in pixelsUnit }.
      const doc = app.activeDocument;
      const docW = doc.width;
      const docH = doc.height;
      const left = Math.max(0, (docW - width) / 2);
      const top = Math.max(0, (docH - height) / 2);
      const right = Math.min(docW, left + width);
      const bottom = Math.min(docH, top + height);

      const selBoundsRes = await action.batchPlay(
        [
          {
            _obj: 'addTo',
            _target: [
              {
                _property: 'selection',
                _ref: 'channel',
              },
            ],
            to: {
              _obj: 'rectangle',
              bottom: { _unit: 'pixelsUnit', _value: bottom },
              left: { _unit: 'pixelsUnit', _value: left },
              right: { _unit: 'pixelsUnit', _value: right },
              top: { _unit: 'pixelsUnit', _value: top },
            },
          },
        ],
        {},
      );
      const boundsErr = checkResults(selBoundsRes, 'Create selection');
      if (boundsErr) outcome += boundsErr + '\n';

      // 4) Transform the selection right after creation so it can be easily
      // dragged. This is the exact descriptor the user recorded in Photoshop
      // ("Copy As JavaScript") for a transform selection. Offset 0/0 keeps the
      // selection in place and just shows the transform handles.
      const transformRes = await action.batchPlay(
        [
          {
            _obj: 'transform',
            _target: [
              {
                _property: 'selection',
                _ref: 'channel',
              },
            ],
            freeTransformCenterState: {
              _enum: 'quadCenterState',
              _value: 'QCSAverage',
            },
            interfaceIconFrameDimmed: {
              _enum: 'interpolationType',
              _value: 'bicubic',
            },
            offset: {
              _obj: 'offset',
              horizontal: { _unit: 'pixelsUnit', _value: 0 },
              vertical: { _unit: 'pixelsUnit', _value: 0 },
            },
          },
        ],
        {},
      );
      const transformErr = checkResults(transformRes, 'Transform selection');
      if (transformErr) outcome += transformErr + '\n';
    },
    { commandName: 'Set Marquee 64px' },
  );

  await setStatus(
    outcome
      ? outcome
      : `Rectangular Marquee Tool active — ${width} x ${height} selection created (centered) and transformed for dragging.`,
  );
}

async function copyMergedAction() {
  if (!app.activeDocument) {
    await setStatus('No active document — open one first.');
    return;
  }

  await setStatus('Copying merged…');
  let outcome = '';

  await core.executeAsModal(
    async () => {
      // Verified descriptor (Adobe developer Mike Chambers' UXP commands):
      // Copy Merged is simply { _obj: 'copyMerged' }.
      const res = await action.batchPlay([{ _obj: 'copyMerged' }], {});
      const err = checkResults(res, 'Copy merged');
      if (err) outcome += err + '\n';
    },
    { commandName: 'Copy Merged' },
  );

  await setStatus(
    outcome
      ? outcome
      : 'Copied merged pixels — in Draw Things press ⌘V to place it on the canvas.',
  );
}

async function pasteAction() {
  if (!app.activeDocument) {
    await setStatus('No active document — open one first.');
    return;
  }

  await setStatus('Pasting…');
  let outcome = '';

  await core.executeAsModal(
    async () => {
      // Verified descriptor (Adobe developer Mike Chambers' UXP commands):
      // Paste as pixels, no anti-alias, not in place (standard Edit > Paste).
      const res = await action.batchPlay(
        [
          {
            _obj: 'paste',
            antiAlias: { _enum: 'antiAliasType', _value: 'antiAliasNone' },
            as: { _class: 'pixel' },
            inPlace: false,
          },
        ],
        {},
      );
      const err = checkResults(res, 'Paste');
      if (err) outcome += err + '\n';
    },
    { commandName: 'Paste' },
  );

  await setStatus(outcome ? outcome : 'Pasted from clipboard.');
}
async function conformSelection() {
  const doc = app.activeDocument;
  if (!doc) {
    await setStatus('No active document — open one first.');
    return;
  }

  await setStatus('Conforming selection…');

  let outcome = '';
  let oldW = 0;
  let oldH = 0;
  let newW = 0;
  let newH = 0;

  await core.executeAsModal(
    async () => {
      const bounds = doc.selection.bounds;
      if (!bounds) {
        outcome = 'No active selection — make one first.';
        return;
      }

      oldW = bounds.right - bounds.left;
      oldH = bounds.bottom - bounds.top;
      newW = Math.max(stepMode, Math.ceil(oldW / stepMode) * stepMode);
      newH = Math.max(stepMode, Math.ceil(oldH / stepMode) * stepMode);

      // Replace the existing selection with the conformed rectangle, anchored
      // at the original top-left corner.
      const clearRes = await action.batchPlay(
        [
          {
            _obj: 'set',
            _target: [{ _ref: 'channel', _property: 'selection' }],
            to: { _enum: 'ordinal', _value: 'none' },
          },
        ],
        {},
      );
      const clearErr = checkResults(clearRes, 'Clear selection');
      if (clearErr) {
        outcome += clearErr + '\n';
        return;
      }

      const conformRes = await action.batchPlay(
        [
          {
            _obj: 'addTo',
            _target: [
              {
                _property: 'selection',
                _ref: 'channel',
              },
            ],
            to: {
              _obj: 'rectangle',
              bottom: { _unit: 'pixelsUnit', _value: bounds.top + newH },
              left: { _unit: 'pixelsUnit', _value: bounds.left },
              right: { _unit: 'pixelsUnit', _value: bounds.left + newW },
              top: { _unit: 'pixelsUnit', _value: bounds.top },
            },
          },
        ],
        {},
      );
      const conformErr = checkResults(conformRes, 'Conform selection');
      if (conformErr) outcome += conformErr + '\n';
    },
    { commandName: `Conform selection to ${stepMode}px` },
  );

  if (!newW || !newH) {
    await setStatus(outcome || 'No active selection — make one first.');
    return;
  }

  // Reflect the conformed size in the sliders (and the MP readout).
  const widthEl = document.getElementById('width');
  const heightEl = document.getElementById('height');
  widthEl.max = String(Math.max(4096, newW));
  widthEl.min = String(stepMode);
  widthEl.step = String(stepMode);
  heightEl.max = String(Math.max(4096, newH));
  heightEl.min = String(stepMode);
  heightEl.step = String(stepMode);
  heightEl.max = String(Math.max(4096, newH));
  widthEl.value = String(newW);
  heightEl.value = String(newH);
  updateLabels();

  await setStatus(
    outcome
      ? outcome
      : `Conformed selection: ${oldW} × ${oldH} → ${newW} × ${newH}.`,
  );
}

function bindButton(id, fn) {
  const el = document.getElementById(id);
  el.addEventListener('click', fn);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  });
}

bindButton('applyBtn', applyToTool);
bindButton('stepBtn64', () => applyStepMode(64));
bindButton('stepBtn16', () => applyStepMode(16));
bindButton('stepBtn8', () => applyStepMode(8));
bindButton('copyMergedBtn', copyMergedAction);
bindButton('pasteBtn', pasteAction);
bindButton('conformBtn', conformSelection);