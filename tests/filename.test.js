/**
 * tests/filename.test.js
 * Unit tests for src/lib/filename.js
 */

import { describe, it, expect } from 'vitest';
import { slugify, buildFilename } from '../src/lib/filename.js';

// ── slugify ────────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('HelloWorld')).toBe('helloworld');
  });

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(slugify('hello world!')).toBe('hello-world');
  });

  it('strips http:// protocol prefix before slugifying', () => {
    // Dots are non-alphanumeric and are replaced by hyphens after stripping
    expect(slugify('http://example.com')).toBe('example-com');
  });

  it('strips https:// protocol prefix before slugifying', () => {
    expect(slugify('https://example.com')).toBe('example-com');
  });

  it('strips www. prefix before slugifying', () => {
    expect(slugify('www.example.com')).toBe('example-com');
  });

  it('strips trailing slashes before slugifying', () => {
    expect(slugify('example.com/')).toBe('example-com');
    expect(slugify('example.com///')).toBe('example-com');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
    expect(slugify('foo...bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('-foo-')).toBe('foo');
    expect(slugify('---bar---')).toBe('bar');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long)).toHaveLength(80);
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles numeric input (coerces to string)', () => {
    expect(slugify(42)).toBe('42');
  });

  it('produces correct slug for a full URL', () => {
    expect(slugify('https://shop.example.com/products/sale?ref=abc'))
      .toBe('shop-example-com-products-sale-ref-abc');
  });

  it('handles domains with dots', () => {
    expect(slugify('sub.domain.example.co.uk')).toBe('sub-domain-example-co-uk');
  });
});

// ── buildFilename ──────────────────────────────────────────────────────────────

describe('buildFilename', () => {
  const BASE_CTX = {
    url:    'https://shop.example.com/products/sale?ref=abc',
    title:  'Sale | Example Shop',
    mode:   'viewport',
    width:  1440,
    height: 900,
  };

  it('replaces {domain} token', () => {
    const result = buildFilename('{domain}', BASE_CTX);
    expect(result).toBe('shop-example-com');
  });

  it('replaces {path} token (uses pathname only, not query string)', () => {
    // url.pathname for .../products/sale?ref=abc is "/products/sale"
    const result = buildFilename('{path}', BASE_CTX);
    expect(result).toBe('products-sale');
  });

  it('replaces {title} token', () => {
    const result = buildFilename('{title}', BASE_CTX);
    expect(result).toBe('sale-example-shop');
  });

  it('replaces {mode} token', () => {
    expect(buildFilename('{mode}', BASE_CTX)).toBe('viewport');
    expect(buildFilename('{mode}', { ...BASE_CTX, mode: 'fullpage' })).toBe('fullpage');
    expect(buildFilename('{mode}', { ...BASE_CTX, mode: 'element' })).toBe('element');
  });

  it('replaces {width} and {height} tokens', () => {
    expect(buildFilename('{width}x{height}', BASE_CTX)).toBe('1440x900');
  });

  it('replaces {timestamp} token with a numeric string', () => {
    const result = buildFilename('{timestamp}', BASE_CTX);
    expect(result).toMatch(/^\d+$/);
    expect(Number(result)).toBeGreaterThan(0);
  });

  it('replaces {date} token with YYYY-MM-DD format', () => {
    const result = buildFilename('{date}', BASE_CTX);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('replaces {time} token with HH-MM-SS format', () => {
    const result = buildFilename('{time}', BASE_CTX);
    expect(result).toMatch(/^\d{2}-\d{2}-\d{2}$/);
  });

  it('handles default pattern {domain}-{path}', () => {
    const result = buildFilename('{domain}-{path}', BASE_CTX);
    expect(result).toBe('shop-example-com-products-sale');
  });

  it('uses "index" when pathname is root /', () => {
    const result = buildFilename('{path}', { ...BASE_CTX, url: 'https://example.com/' });
    expect(result).toBe('index');
  });

  it('collapses consecutive hyphens in final output', () => {
    // If {title} is empty, the pattern {domain}-{title}-{path} should not produce "--"
    const result = buildFilename('{domain}-{title}-{path}', { ...BASE_CTX, title: '' });
    expect(result).not.toContain('--');
  });

  it('trims leading/trailing hyphens from final output', () => {
    const result = buildFilename('-{domain}-', BASE_CTX);
    expect(result).not.toMatch(/^-|-$/);
  });

  it('replaces all occurrences of the same token', () => {
    const result = buildFilename('{domain}-{domain}', BASE_CTX);
    expect(result).toBe('shop-example-com-shop-example-com');
  });

  it('handles a pattern with no tokens', () => {
    expect(buildFilename('my-screenshot', BASE_CTX)).toBe('my-screenshot');
  });

  it('handles an invalid URL gracefully (falls back to unknown)', () => {
    const ctx = { ...BASE_CTX, url: 'not-a-url' };
    // Should not throw
    const result = buildFilename('{domain}', ctx);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles missing title gracefully', () => {
    const result = buildFilename('{title}', { ...BASE_CTX, title: undefined });
    // No token in output, just empty string after trimming
    expect(typeof result).toBe('string');
  });

  it('handles missing width/height gracefully', () => {
    const result = buildFilename('{width}x{height}', { ...BASE_CTX, width: undefined, height: undefined });
    expect(result).toBe('x');
  });

  it('uses "viewport" as default mode when mode is missing', () => {
    const result = buildFilename('{mode}', { ...BASE_CTX, mode: undefined });
    expect(result).toBe('viewport');
  });

  it('produces the same filename for the same inputs (deterministic except for time tokens)', () => {
    const a = buildFilename('{domain}-{path}', BASE_CTX);
    const b = buildFilename('{domain}-{path}', BASE_CTX);
    expect(a).toBe(b);
  });
});
