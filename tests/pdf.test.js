/**
 * tests/pdf.test.js
 * Tests for PDF export: src/lib/pdf.js + the PDF-related branches in popup.js.
 *
 * pdf.js uses browser-only APIs (Image, document.createElement, canvas).
 * We supply lightweight globals so the module can be imported under Node,
 * and we re-implement the private pure helpers in isolation for focused
 * unit tests — matching the pattern used in offscreen.test.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Browser API stubs (pdf.js needs these at import time) ─────────────────────

// A minimal Image that fires onload on the next tick after src is assigned.
class MockImage {
  constructor() {
    this.naturalWidth  = 200;
    this.naturalHeight = 100;
    this.onload = null;
    this.onerror = null;
  }
  set src(_val) {
    if (this.onload) setTimeout(this.onload, 0);
  }
}
global.Image = MockImage;

// A minimal canvas whose toDataURL returns a predictable JPEG data URL.
const FAKE_JPEG_B64 = btoa('\xFF\xD8\xFF\xE0fake-jpeg-payload');
const FAKE_JPEG_DATA_URL = `data:image/jpeg;base64,${FAKE_JPEG_B64}`;

function makeMockCanvas() {
  return {
    width:      0,
    height:     0,
    getContext: () => ({ drawImage: vi.fn() }),
    toDataURL:  vi.fn((_mime, _q) => FAKE_JPEG_DATA_URL),
  };
}
global.document = {
  createElement: vi.fn((tag) => {
    if (tag === 'canvas') return makeMockCanvas();
    throw new Error(`Unexpected createElement('${tag}')`);
  }),
};

// ── Import the module under test ──────────────────────────────────────────────

import { imageToPdfDataUrl } from '../src/lib/pdf.js';

// ── Re-implementations of private helpers (mirrored from pdf.js) ──────────────

function base64ToBytes_impl(b64) {
  const str   = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

const CHUNK = 8192;
function bytesToBase64_impl(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(str);
}

function concat_impl(arrays) {
  const total  = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { result.set(a, pos); pos += a.length; }
  return result;
}

function buildPdf_impl(imgBytes, w, h) {
  const enc = new TextEncoder();
  const contentBytes = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Img Do Q`);

  const obj1 = enc.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const obj2 = enc.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  const obj3 = enc.encode(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}]` +
    ` /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`
  );
  const obj4 = concat_impl([
    enc.encode(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
    contentBytes,
    enc.encode('\nendstream\nendobj\n'),
  ]);
  const obj5 = concat_impl([
    enc.encode(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h}` +
      ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode` +
      ` /Length ${imgBytes.length} >>\nstream\n`
    ),
    imgBytes,
    enc.encode('\nendstream\nendobj\n'),
  ]);

  const header = enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  const parts  = [obj1, obj2, obj3, obj4, obj5];
  let offset   = header.length;
  const offsets = parts.map(p => { const o = offset; offset += p.length; return o; });
  const xrefOffset = offset;

  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (const o of offsets) {
    xref += String(o).padStart(10, '0') + ' 00000 n \n';
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return concat_impl([header, ...parts, enc.encode(xref)]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pdfText(bytes) {
  return new TextDecoder().decode(bytes);
}

// ── base64ToBytes / bytesToBase64 roundtrip ───────────────────────────────────

describe('base64ToBytes / bytesToBase64 roundtrip', () => {
  it('roundtrips an empty buffer', () => {
    const empty  = new Uint8Array(0);
    const result = base64ToBytes_impl(bytesToBase64_impl(empty));
    expect(result).toEqual(empty);
  });

  it('roundtrips a short buffer', () => {
    const data   = new Uint8Array([1, 2, 3, 255, 128, 0]);
    const result = base64ToBytes_impl(bytesToBase64_impl(data));
    expect(result).toEqual(data);
  });

  it('roundtrips a buffer larger than the 8192-byte chunk size', () => {
    const data = new Uint8Array(20000).map((_, i) => i % 256);
    const result = base64ToBytes_impl(bytesToBase64_impl(data));
    expect(result).toEqual(data);
  });

  it('decodes known base64 to the expected bytes', () => {
    // btoa('ABC') === 'QUJD'
    const bytes = base64ToBytes_impl(btoa('ABC'));
    expect(bytes).toEqual(new Uint8Array([65, 66, 67]));
  });

  it('encodes known bytes to the expected base64', () => {
    const bytes = new Uint8Array([65, 66, 67]); // 'ABC'
    expect(bytesToBase64_impl(bytes)).toBe(btoa('ABC'));
  });
});

// ── concat helper ─────────────────────────────────────────────────────────────

describe('concat helper', () => {
  it('concatenates two arrays in order', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4]);
    expect(concat_impl([a, b])).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('handles an empty array in the list', () => {
    const a = new Uint8Array([10]);
    const b = new Uint8Array(0);
    const c = new Uint8Array([20]);
    expect(concat_impl([a, b, c])).toEqual(new Uint8Array([10, 20]));
  });

  it('handles a single-element list', () => {
    const a = new Uint8Array([7, 8, 9]);
    expect(concat_impl([a])).toEqual(a);
  });

  it('produces the correct total length', () => {
    const arrays = [new Uint8Array(100), new Uint8Array(200), new Uint8Array(50)];
    expect(concat_impl(arrays).length).toBe(350);
  });
});

// ── buildPdf structure ────────────────────────────────────────────────────────

describe('buildPdf structure', () => {
  const sampleImg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]); // minimal JPEG
  const W = 800, H = 600;
  let pdfBytes, text;

  beforeEach(() => {
    pdfBytes = buildPdf_impl(sampleImg, W, H);
    text     = pdfText(pdfBytes);
  });

  it('starts with %PDF-1.4', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
  });

  it('ends with %%EOF', () => {
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('contains an xref table', () => {
    expect(text).toContain('xref');
  });

  it('contains a trailer dictionary', () => {
    expect(text).toContain('trailer');
  });

  it('declares 6 objects in the xref header (0–5)', () => {
    expect(text).toContain('xref\n0 6');
  });

  it('includes the Catalog object', () => {
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Pages 2 0 R');
  });

  it('includes the Pages object with Count 1', () => {
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Count 1');
  });

  it('embeds the correct MediaBox dimensions', () => {
    expect(text).toContain(`/MediaBox [0 0 ${W} ${H}]`);
  });

  it('scales the image to fill the page in the content stream', () => {
    expect(text).toContain(`q ${W} 0 0 ${H} 0 0 cm /Img Do Q`);
  });

  it('specifies the correct image dimensions in the XObject', () => {
    expect(text).toContain(`/Width ${W} /Height ${H}`);
  });

  it('uses DCTDecode filter (JPEG embedding)', () => {
    expect(text).toContain('/Filter /DCTDecode');
  });

  it('declares 8 bits per component', () => {
    expect(text).toContain('/BitsPerComponent 8');
  });

  it('declares DeviceRGB colour space', () => {
    expect(text).toContain('/ColorSpace /DeviceRGB');
  });

  it('reports the correct image byte length in the XObject dictionary', () => {
    expect(text).toContain(`/Length ${sampleImg.length}`);
  });

  it('sets /Root to point at object 1 (Catalog)', () => {
    expect(text).toContain('/Root 1 0 R');
  });

  it('xref free entry is exactly 20 bytes', () => {
    const freeEntry = '0000000000 65535 f \n';
    expect(freeEntry.length).toBe(20);
    expect(text).toContain(freeEntry);
  });

  it('each normal xref entry is exactly 20 bytes', () => {
    // Extract the xref section and check each in-use entry line length
    const xrefStart = text.indexOf('xref\n');
    const xrefBody  = text.slice(xrefStart);
    const lines     = xrefBody.split('\n');

    // Lines 0='xref', 1='0 6', 2=free entry, 3-7=object entries
    const normalEntries = lines.slice(3, 8);
    for (const line of normalEntries) {
      // Each entry ends with ' n ' and we split on \n, so line = 'nnnnnnnnnn 00000 n '
      // That's 19 chars (the \n was the delimiter). With the delimiter it's 20.
      expect(line.length).toBe(19);   // 19 chars + the consumed '\n' = 20 bytes
      expect(line).toMatch(/^\d{10} \d{5} n $/);
    }
  });

  it('different image dimensions produce different MediaBox and content stream', () => {
    const bytes2 = buildPdf_impl(sampleImg, 1920, 1080);
    const text2  = pdfText(bytes2);
    expect(text2).toContain('/MediaBox [0 0 1920 1080]');
    expect(text2).toContain('q 1920 0 0 1080 0 0 cm /Img Do Q');
  });
});

// ── imageToPdfDataUrl output ──────────────────────────────────────────────────

describe('imageToPdfDataUrl', () => {
  beforeEach(() => {
    // Restore document.createElement mock
    global.document.createElement = vi.fn(() => makeMockCanvas());
  });

  it('returns a data URL with the application/pdf MIME type', async () => {
    const result = await imageToPdfDataUrl('data:image/png;base64,iVBORw0KGgo=');
    expect(result.startsWith('data:application/pdf;base64,')).toBe(true);
  });

  it('the base64 payload decodes to a PDF starting with %PDF-1.4', async () => {
    const result = await imageToPdfDataUrl('data:image/png;base64,iVBORw0KGgo=');
    const [, b64] = result.split(',');
    const decoded = atob(b64);
    expect(decoded.startsWith('%PDF-1.4')).toBe(true);
  });

  it('the decoded PDF ends with %%EOF', async () => {
    const result = await imageToPdfDataUrl('data:image/png;base64,iVBORw0KGgo=');
    const [, b64] = result.split(',');
    const decoded = atob(b64);
    expect(decoded.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('accepts a JPEG data URL as input', async () => {
    const result = await imageToPdfDataUrl(FAKE_JPEG_DATA_URL);
    expect(result.startsWith('data:application/pdf;base64,')).toBe(true);
  });

  it('accepts a WebP data URL as input', async () => {
    const result = await imageToPdfDataUrl('data:image/webp;base64,UklGRgAAAABXRUJQVlA4IAAAAA==');
    expect(result.startsWith('data:application/pdf;base64,')).toBe(true);
  });

  it('uses the quality argument when calling canvas.toDataURL', async () => {
    const canvas = makeMockCanvas();
    global.document.createElement = vi.fn(() => canvas);

    await imageToPdfDataUrl('data:image/png;base64,iVBORw0KGgo=', 75);

    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.75);
  });

  it('defaults to quality 90 (0.9 fraction)', async () => {
    const canvas = makeMockCanvas();
    global.document.createElement = vi.fn(() => canvas);

    await imageToPdfDataUrl('data:image/png;base64,iVBORw0KGgo=');

    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
  });

  it('always converts to JPEG (DCTDecode) regardless of input format', async () => {
    const canvas = makeMockCanvas();
    global.document.createElement = vi.fn(() => canvas);

    await imageToPdfDataUrl('data:image/png;base64,iVBORw0KGgo=');

    // The MIME passed to toDataURL should always be JPEG for PDF embedding
    const [mime] = canvas.toDataURL.mock.calls[0];
    expect(mime).toBe('image/jpeg');
  });
});

// ── captureFullPage MIME selection for PDF ────────────────────────────────────
// Mirrors the logic from popup.js captureFullPage() (line ~666)

describe('captureFullPage MIME selection for PDF format', () => {
  function getMime(format) {
    return (format === 'PNG' || format === 'PDF') ? 'image/png'
         : format === 'WebP' ? 'image/webp'
         : 'image/jpeg';
  }

  it('uses image/png for PNG format', () => {
    expect(getMime('PNG')).toBe('image/png');
  });

  it('uses image/png for PDF format (intermediate PNG, converted to PDF after)', () => {
    expect(getMime('PDF')).toBe('image/png');
  });

  it('uses image/webp for WebP format', () => {
    expect(getMime('WebP')).toBe('image/webp');
  });

  it('uses image/jpeg for JPG format', () => {
    expect(getMime('JPG')).toBe('image/jpeg');
  });

  it('falls back to image/jpeg for unknown formats', () => {
    expect(getMime('TIFF')).toBe('image/jpeg');
    expect(getMime('')).toBe('image/jpeg');
    expect(getMime(undefined)).toBe('image/jpeg');
  });
});

// ── convertPending format passthrough for PDF ─────────────────────────────────
// Mirrors the guard logic from popup.js convertPending()

describe('convertPending passthrough logic for PDF', () => {
  function shouldPassthrough(format) {
    return format === 'PNG' || format === 'PDF';
  }

  it('passes through PNG without conversion', () => {
    expect(shouldPassthrough('PNG')).toBe(true);
  });

  it('passes through PDF without conversion (imageToPdfDataUrl runs after)', () => {
    expect(shouldPassthrough('PDF')).toBe(true);
  });

  it('does NOT pass through JPG (needs JPEG re-encode)', () => {
    expect(shouldPassthrough('JPG')).toBe(false);
  });

  it('does NOT pass through WebP (needs WebP re-encode)', () => {
    expect(shouldPassthrough('WebP')).toBe(false);
  });
});

// ── selectFormat quality-disable logic for PDF ───────────────────────────────
// Mirrors the condition in popup.js selectFormat()

describe('selectFormat quality-disabled logic for PDF', () => {
  function isQualityDisabled(format) {
    return format === 'PNG' || format === 'PDF';
  }

  it('disables quality for PNG', () => {
    expect(isQualityDisabled('PNG')).toBe(true);
  });

  it('disables quality for PDF', () => {
    expect(isQualityDisabled('PDF')).toBe(true);
  });

  it('enables quality for JPG', () => {
    expect(isQualityDisabled('JPG')).toBe(false);
  });

  it('enables quality for WebP', () => {
    expect(isQualityDisabled('WebP')).toBe(false);
  });
});

// ── FORMATS constant includes PDF ─────────────────────────────────────────────

describe('FORMATS constant', () => {
  it('includes PDF as an export format', async () => {
    const { FORMATS } = await import('../src/lib/constants.js');
    expect(FORMATS).toContain('PDF');
  });

  it('retains the original image formats', async () => {
    const { FORMATS } = await import('../src/lib/constants.js');
    expect(FORMATS).toContain('PNG');
    expect(FORMATS).toContain('JPG');
    expect(FORMATS).toContain('WebP');
  });
});
