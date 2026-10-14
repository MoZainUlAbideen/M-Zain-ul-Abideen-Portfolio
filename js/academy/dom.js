// Tiny DOM helpers shared by the academy games.
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

export function svgIcon(markup, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = markup;
  return s;
}

export const ICONS = {
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  stack: '<path d="M4 6h16v4H4zM4 14h16v4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 8h5M8 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9l-9 9a2 2 0 0 1-2.8-2.8l9-9a4 4 0 0 0-2.1-2.1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  check: '<path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 9-6 14-14 14H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 19 13 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  back: '<path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
