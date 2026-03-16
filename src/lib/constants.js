/**
 * constants.js — Shared configuration values
 *
 * Single source of truth for size presets, format options, and default settings.
 * Import this wherever you need to reference these values.
 */

export const SIZE_PRESETS = {
  'As-is':      null,
  'Desktop HD': { w: 1920, h: 1080 },
  'Desktop':    { w: 1440, h: 900  },
  'Laptop':     { w: 1280, h: 800  },
  'Tablet':     { w: 768,  h: 1024 },
  'Mobile':     { w: 375,  h: 812  },
};

export const FORMATS = ['PNG', 'JPG', 'WebP'];

export const DEFAULT_SETTINGS = {
  format:           'PNG',
  quality:          90,
  mode:             'viewport',       // 'viewport' | 'fullpage' | 'element'
  sizePreset:       'As-is',
  customWidth:      1440,
  customHeight:     900,
  filenamePattern:  '{domain}-{path}',
  saveLocation:     'prompt',         // 'prompt' | 'default'
  theme:            'system',         // 'system' | 'light' | 'dark'
  maxFullPageHeight: 15000,
};

export const HISTORY_MAX_ITEMS = 20;
export const HISTORY_THUMBNAIL_WIDTH = 200; // px, resized before storing
