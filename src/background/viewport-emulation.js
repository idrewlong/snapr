/**
 * viewport-emulation.js — Chrome Debugger viewport override
 *
 * Used when a size preset other than "As-is" is selected.
 * Requires the optional "debugger" permission — it is requested on first use.
 *
 * UX note: Chrome displays a yellow "Snapr is debugging this tab" banner
 * while the debugger is attached. This is unavoidable and lasts ~1–2 seconds.
 */

import { SIZE_PRESETS } from '../lib/constants.js';

/**
 * @param {number} tabId
 * @param {Object} options
 * @param {string} options.sizePreset
 * @param {number} [options.customWidth]
 * @param {number} [options.customHeight]
 */
export async function emulateViewport(tabId, options) {
  await requireDebuggerPermission();

  const preset = SIZE_PRESETS[options.sizePreset];
  const width  = preset ? preset.w : (options.customWidth  || 1440);
  const height = preset ? preset.h : (options.customHeight || 900);

  await chrome.debugger.attach({ tabId }, '1.3');
  await chrome.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,           // always capture at 2x for retina quality
    mobile: width <= 768,
  });
}

export async function clearViewportEmulation(tabId) {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride', {});
  } catch { /* ignore — tab may have navigated or debugger was already detached */ }
  try {
    await chrome.debugger.detach({ tabId });
  } catch { /* ignore — already detached */ }
}

async function requireDebuggerPermission() {
  const has = await chrome.permissions.contains({ permissions: ['debugger'] });
  if (has) return;

  const granted = await chrome.permissions.request({ permissions: ['debugger'] });
  if (!granted) {
    throw new Error('Debugger permission required for viewport presets.');
  }
}
