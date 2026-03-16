/**
 * tests/messages.test.js
 * Validates that all message type constants exist and are unique strings.
 */

import { describe, it, expect } from 'vitest';
import * as MSG from '../src/lib/messages.js';

const ALL_MESSAGES = [
  'CAPTURE_VIEWPORT',
  'CAPTURE_FULLPAGE',
  'CAPTURE_ELEMENT',
  'ELEMENT_SELECTED',
  'SCROLL_INFO',
  'SCROLL_TO',
  'COMPOSITE_FRAMES',
  'CROP_IMAGE',
  'CONVERT_FORMAT',
  'CAPTURE_COMPLETE',
  'QUICK_CAPTURE',
];

describe('message constants', () => {
  it('exports all required message type constants', () => {
    ALL_MESSAGES.forEach(name => {
      expect(MSG).toHaveProperty(name);
    });
  });

  it('every constant is a non-empty string', () => {
    ALL_MESSAGES.forEach(name => {
      expect(typeof MSG[name]).toBe('string');
      expect(MSG[name].length).toBeGreaterThan(0);
    });
  });

  it('all constant values are unique (no duplicates)', () => {
    const values = ALL_MESSAGES.map(name => MSG[name]);
    const unique  = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('constant name matches its value (convention: value === name)', () => {
    ALL_MESSAGES.forEach(name => {
      expect(MSG[name]).toBe(name);
    });
  });

  it('CAPTURE_VIEWPORT is sent from Popup to Service Worker', () => {
    // Smoke-test: value is stable
    expect(MSG.CAPTURE_VIEWPORT).toBe('CAPTURE_VIEWPORT');
  });

  it('ELEMENT_SELECTED is sent from Content Script to Service Worker', () => {
    expect(MSG.ELEMENT_SELECTED).toBe('ELEMENT_SELECTED');
  });

  it('COMPOSITE_FRAMES is sent from Service Worker to Offscreen Document', () => {
    expect(MSG.COMPOSITE_FRAMES).toBe('COMPOSITE_FRAMES');
  });
});
