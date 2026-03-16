/**
 * filename.js — Filename generation from URL + token pattern
 *
 * Default pattern: {domain}-{path}
 *
 * Supported tokens:
 *   {domain}    — slugified hostname          e.g. "shop-example-com"
 *   {path}      — slugified pathname          e.g. "products-sale"
 *   {title}     — slugified page <title>      e.g. "sale-example-shop"
 *   {date}      — YYYY-MM-DD                  e.g. "2026-03-14"
 *   {time}      — HH-MM-SS                    e.g. "14-30-45"
 *   {timestamp} — Unix epoch seconds          e.g. "1773696645"
 *   {width}     — captured width in CSS px    e.g. "1440"
 *   {height}    — captured height in CSS px   e.g. "900"
 *   {mode}      — capture mode                e.g. "viewport"
 */

/**
 * Converts a raw string into a filesystem-safe slug.
 * Steps: lowercase → strip protocol/www/trailing slashes
 *        → replace non-alphanumeric with "-" → collapse hyphens
 *        → trim edges → truncate to 80 chars
 */
export function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Generates a filename (without extension) from a pattern and capture context.
 *
 * @param {string}  pattern    — e.g. '{domain}-{path}'
 * @param {Object}  ctx
 * @param {string}  ctx.url
 * @param {string}  ctx.title
 * @param {string}  ctx.mode
 * @param {number}  ctx.width
 * @param {number}  ctx.height
 * @returns {string}
 */
export function buildFilename(pattern, ctx) {
  let url;
  try {
    url = new URL(ctx.url);
  } catch {
    url = new URL('https://unknown');
  }
  const now   = new Date();

  const pad   = (n) => String(n).padStart(2, '0');
  const date  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const time  = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const tokens = {
    domain:    slugify(url.hostname),
    path:      slugify(url.pathname) || 'index',
    title:     slugify(ctx.title    || ''),
    date,
    time,
    timestamp: String(Math.floor(now.getTime() / 1000)),
    width:     String(ctx.width  || ''),
    height:    String(ctx.height || ''),
    mode:      ctx.mode || 'viewport',
  };

  return Object.entries(tokens).reduce(
    (result, [token, value]) => result.replace(new RegExp(`\\{${token}\\}`, 'g'), value),
    pattern
  ).replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}
