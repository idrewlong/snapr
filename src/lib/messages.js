/**
 * messages.js — Message type constants for chrome.runtime.sendMessage
 *
 * All inter-component communication uses these typed message objects.
 * Never use raw string literals for message types — always import from here.
 *
 * Flow overview:
 *
 *   Popup  ──▶  Service Worker  ──▶  Content Script
 *   Popup  ──▶  Service Worker  ──▶  Offscreen Document
 *   Command ──▶ Service Worker  (keyboard shortcut, no popup)
 */

// Popup → Service Worker
export const CAPTURE_VIEWPORT = 'CAPTURE_VIEWPORT'; // { format, quality, sizePreset }
export const CAPTURE_FULLPAGE = 'CAPTURE_FULLPAGE'; // { format, quality, maxHeight }
export const CAPTURE_ELEMENT  = 'CAPTURE_ELEMENT';  // {} — initiates element picker
export const CAPTURE_REGION   = 'CAPTURE_REGION';   // {} — initiates drag-to-select region picker

// Content Script → Service Worker
export const ELEMENT_SELECTED = 'ELEMENT_SELECTED'; // { rect: {x,y,width,height}, devicePixelRatio }
export const REGION_SELECTED  = 'REGION_SELECTED';  // { rect: {x,y,width,height}, devicePixelRatio }
export const SCROLL_INFO      = 'SCROLL_INFO';       // { scrollHeight, scrollWidth, viewportHeight, viewportWidth }

// Service Worker → Content Script
export const SCROLL_TO        = 'SCROLL_TO';         // { y }
export const HIDE_FIXED       = 'HIDE_FIXED';        // {} → { fixedBarHeight }

// Service Worker → Offscreen Document
export const COMPOSITE_FRAMES = 'COMPOSITE_FRAMES';  // { frames: dataUrl[], dimensions }
export const CROP_IMAGE       = 'CROP_IMAGE';         // { dataUrl, rect, outputFormat, quality }
export const CONVERT_FORMAT   = 'CONVERT_FORMAT';     // { dataUrl, format, quality }

// Service Worker → Popup
export const CAPTURE_COMPLETE = 'CAPTURE_COMPLETE';  // { success, filename, error? }

// Command (keyboard shortcut) → Service Worker
export const QUICK_CAPTURE    = 'QUICK_CAPTURE';     // {}
