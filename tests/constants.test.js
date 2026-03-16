/**
 * tests/constants.test.js
 * Validates the values in src/lib/constants.js.
 */

import { describe, it, expect } from 'vitest';
import {
  SIZE_PRESETS,
  FORMATS,
  DEFAULT_SETTINGS,
  HISTORY_MAX_ITEMS,
  HISTORY_THUMBNAIL_WIDTH,
} from '../src/lib/constants.js';

// ── SIZE_PRESETS ──────────────────────────────────────────────────────────────

describe('SIZE_PRESETS', () => {
  it('contains an "As-is" entry with null dimensions', () => {
    expect(SIZE_PRESETS['As-is']).toBeNull();
  });

  it('contains Desktop HD at 1920×1080', () => {
    expect(SIZE_PRESETS['Desktop HD']).toEqual({ w: 1920, h: 1080 });
  });

  it('contains Desktop at 1440×900', () => {
    expect(SIZE_PRESETS['Desktop']).toEqual({ w: 1440, h: 900 });
  });

  it('contains Laptop at 1280×800', () => {
    expect(SIZE_PRESETS['Laptop']).toEqual({ w: 1280, h: 800 });
  });

  it('contains Tablet at 768×1024', () => {
    expect(SIZE_PRESETS['Tablet']).toEqual({ w: 768, h: 1024 });
  });

  it('contains Mobile at 375×812', () => {
    expect(SIZE_PRESETS['Mobile']).toEqual({ w: 375, h: 812 });
  });

  it('all dimensional presets have positive width and height', () => {
    Object.entries(SIZE_PRESETS).forEach(([name, dims]) => {
      if (dims === null) return; // As-is
      expect(dims.w).toBeGreaterThan(0);
      expect(dims.h).toBeGreaterThan(0);
    });
  });

  it('mobile-category presets have width <= 768 (triggers mobile UA)', () => {
    expect(SIZE_PRESETS['Mobile'].w).toBeLessThanOrEqual(768);
    expect(SIZE_PRESETS['Tablet'].w).toBeLessThanOrEqual(768);
  });

  it('desktop-category presets have width > 768', () => {
    expect(SIZE_PRESETS['Desktop HD'].w).toBeGreaterThan(768);
    expect(SIZE_PRESETS['Desktop'].w).toBeGreaterThan(768);
    expect(SIZE_PRESETS['Laptop'].w).toBeGreaterThan(768);
  });
});

// ── FORMATS ───────────────────────────────────────────────────────────────────

describe('FORMATS', () => {
  it('is an array', () => {
    expect(Array.isArray(FORMATS)).toBe(true);
  });

  it('contains PNG, JPG, and WebP', () => {
    expect(FORMATS).toContain('PNG');
    expect(FORMATS).toContain('JPG');
    expect(FORMATS).toContain('WebP');
  });

  it('has exactly 3 formats', () => {
    expect(FORMATS).toHaveLength(3);
  });
});

// ── DEFAULT_SETTINGS ──────────────────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
  it('has format "PNG"', () => {
    expect(DEFAULT_SETTINGS.format).toBe('PNG');
  });

  it('has quality 90', () => {
    expect(DEFAULT_SETTINGS.quality).toBe(90);
  });

  it('quality is in valid range 1-100', () => {
    expect(DEFAULT_SETTINGS.quality).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_SETTINGS.quality).toBeLessThanOrEqual(100);
  });

  it('has mode "viewport"', () => {
    expect(DEFAULT_SETTINGS.mode).toBe('viewport');
  });

  it('has sizePreset "As-is"', () => {
    expect(DEFAULT_SETTINGS.sizePreset).toBe('As-is');
  });

  it('has positive customWidth and customHeight', () => {
    expect(DEFAULT_SETTINGS.customWidth).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.customHeight).toBeGreaterThan(0);
  });

  it('has a valid filename pattern string', () => {
    expect(typeof DEFAULT_SETTINGS.filenamePattern).toBe('string');
    expect(DEFAULT_SETTINGS.filenamePattern.length).toBeGreaterThan(0);
  });

  it('saveLocation is "prompt" or "default"', () => {
    expect(['prompt', 'default']).toContain(DEFAULT_SETTINGS.saveLocation);
  });

  it('theme is "system", "light", or "dark"', () => {
    expect(['system', 'light', 'dark']).toContain(DEFAULT_SETTINGS.theme);
  });

  it('maxFullPageHeight is a positive number', () => {
    expect(DEFAULT_SETTINGS.maxFullPageHeight).toBeGreaterThan(0);
  });

  it('maxFullPageHeight is 15000 as documented', () => {
    expect(DEFAULT_SETTINGS.maxFullPageHeight).toBe(15000);
  });
});

// ── HISTORY_MAX_ITEMS ─────────────────────────────────────────────────────────

describe('HISTORY_MAX_ITEMS', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(HISTORY_MAX_ITEMS)).toBe(true);
    expect(HISTORY_MAX_ITEMS).toBeGreaterThan(0);
  });

  it('is 20 as documented', () => {
    expect(HISTORY_MAX_ITEMS).toBe(20);
  });
});

// ── HISTORY_THUMBNAIL_WIDTH ───────────────────────────────────────────────────

describe('HISTORY_THUMBNAIL_WIDTH', () => {
  it('is a positive number', () => {
    expect(HISTORY_THUMBNAIL_WIDTH).toBeGreaterThan(0);
  });

  it('is 200px as documented', () => {
    expect(HISTORY_THUMBNAIL_WIDTH).toBe(200);
  });
});
