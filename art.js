// art.js — the ONLY place that knows where botanical art comes from.
//
// Every art element in the page is a slot:  <div data-art="corner-a"></div>
// To use your real watercolors, drop files named after the slot into /site/art:
//     art/corner-a.webp   (or .png)   → replaces the procedural placeholder automatically.
// If the file has a plain white background that's fine: images are blended with `multiply`.
// Until then, the placeholders below are drawn procedurally (SVG turbulence + displacement → bitmap).

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export async function mountArt(root = document) {
  const slots = [...root.querySelectorAll('[data-art]')];
  await Promise.all(slots.map(fill));
}

const sources = new Map();
function resolve(key) {
  if (!sources.has(key)) {
    sources.set(key, (async () => {
      for (const ext of ['webp', 'png']) {
        const found = await probe(`art/${key}.${ext}`);
        if (found) return found;
      }
      return procedural(key);
    })());
  }
  return sources.get(key);
}

async function fill(el) {
  const src = await resolve(el.dataset.art);
  if (!src) return;
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.src = src;
  await img.decode().catch(() => {});
  el.append(img);
  requestAnimationFrame(() => el.classList.add('is-ready')); // CSS "blooms" it in
}

function probe(url) {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(url);
    i.onerror = () => resolve(null);
    i.src = url;
  });
}

// ---------------------------------------------------------------- procedural placeholders

const cache = new Map();
function procedural(key) {
  if (!cache.has(key)) cache.set(key, build(key));
  return cache.get(key);
}

async function build(key) {
  try {
    if (key === 'corner-a') return await rasterize(corner(11, 1), 1000);
    if (key === 'corner-b') return await rasterize(corner(47, 2), 1000);
    return null;
  } catch (e) {
    console.warn('art placeholder failed', key, e);
    return null;
  }
}

async function rasterize(svg, size) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  // Bake it once into a bitmap so scrolling never re-runs the SVG filters (matters on phones).
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.92));
  return blob ? URL.createObjectURL(blob) : img.src;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => n.toFixed(1);
const lerp = (a, b, t) => a + (b - a) * t;

function bez(p, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
}
function bezAngle(p, t) {
  const u = 1 - t;
  const d = [0, 1].map((k) => 3 * u * u * (p[1][k] - p[0][k]) + 6 * u * t * (p[2][k] - p[1][k]) + 3 * t * t * (p[3][k] - p[2][k]));
  return (Math.atan2(d[1], d[0]) * 180) / Math.PI;
}

function palette() {
  return {
    ink: css('--ink', '#1F4B4C'),
    pink: css('--pink', '#D9A9A3'),
    coral: css('--coral', '#E1927F'),
    sage: css('--sage', '#A9B79F'),
    olive: css('--olive', '#7C8259'),
    blue: css('--blue', '#8B9CA8'),
  };
}

// mix a hex color toward white (t>0) or toward ink-dark (t<0)
function tone(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  return `rgb(${ch.join(',')})`;
}

function petalPath(len, wid) {
  return `M0 0C${f(len * 0.12)} ${f(-wid * 0.95)} ${f(len * 0.74)} ${f(-wid * 1.1)} ${f(len * 0.97)} ${f(-wid * 0.2)}Q${f(len * 1.05)} 0 ${f(len * 0.97)} ${f(wid * 0.2)}C${f(len * 0.74)} ${f(wid * 1.1)} ${f(len * 0.12)} ${f(wid * 0.95)} 0 0Z`;
}

function leafPath(r, len, wid) {
  const j = () => (r() - 0.5) * wid * 0.45;
  return `M0 0C${f(len * 0.2)} ${f(-wid + j())} ${f(len * 0.66)} ${f(-wid * 0.95 + j())} ${f(len)} 0C${f(len * 0.64)} ${f(wid * 0.95 + j())} ${f(len * 0.22)} ${f(wid + j())} 0 0Z`;
}

function corner(seed, variant) {
  const P = palette();
  const r = rng(seed);
  const W = 1000;

  const defs = `
    <linearGradient id="gPink" x1="0" x2="1"><stop offset="0" stop-color="${tone(P.pink, -0.14)}"/><stop offset=".55" stop-color="${P.pink}"/><stop offset="1" stop-color="${tone(P.pink, 0.45)}"/></linearGradient>
    <linearGradient id="gCoral" x1="0" x2="1"><stop offset="0" stop-color="${tone(P.coral, -0.16)}"/><stop offset=".55" stop-color="${P.coral}"/><stop offset="1" stop-color="${tone(P.coral, 0.45)}"/></linearGradient>
    <linearGradient id="gSage" x1="0" x2="1"><stop offset="0" stop-color="${tone(P.sage, -0.22)}"/><stop offset="1" stop-color="${tone(P.sage, 0.28)}"/></linearGradient>
    <linearGradient id="gOlive" x1="0" x2="1"><stop offset="0" stop-color="${tone(P.olive, -0.2)}"/><stop offset="1" stop-color="${tone(P.olive, 0.3)}"/></linearGradient>
    <linearGradient id="gBlue" x1="0" x2="1"><stop offset="0" stop-color="${tone(P.blue, -0.2)}"/><stop offset="1" stop-color="${tone(P.blue, 0.35)}"/></linearGradient>
    <linearGradient id="gTeal" x1="0" x2="1"><stop offset="0" stop-color="${P.ink}"/><stop offset="1" stop-color="${tone(P.ink, 0.5)}"/></linearGradient>
    ${['L:.010 .014:34:2.4', 'M:.02 .028:15:1.8', 'S:.04 .05:7:1.2']
      .map((s, i) => {
        const [id, freq, scale, blur] = s.split(':');
        return `<filter id="wc${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed + i}" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d1"/>
      <feTurbulence type="fractalNoise" baseFrequency=".085" numOctaves="2" seed="${seed + 3}" result="fine"/>
      <feDisplacementMap in="d1" in2="fine" scale="${scale / 3}" xChannelSelector="G" yChannelSelector="R" result="d2"/>
      <feGaussianBlur in="d2" stdDeviation="${blur}" result="soft"/>
      <feComposite in="d2" in2="soft" operator="arithmetic" k1="0" k2="1.7" k3="-.7" k4="0" result="pool"/>
      <feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="4" seed="${seed + 7}" result="mott"/>
      <feColorMatrix in="mott" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.5 -.1" result="mottA"/>
      <feComposite in="pool" in2="mottA" operator="in" result="mot"/>
      <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="${seed + 11}" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 .66" result="grainA"/>
      <feComposite in="mot" in2="grainA" operator="in"/>
    </filter>`;
      })
      .join('')}
    <filter id="pen" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${seed + 5}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;

  // ---- atmosphere: big, faint washes so the corner has body before any detail
  const atmos = [
    [190, 175, 190, 150, P.pink, 0.15],
    [330, 70, 250, 80, P.sage, 0.14],
    [70, 320, 80, 230, P.sage, 0.12],
    [300, 250, 130, 110, P.blue, 0.09],
  ]
    .map(([cx, cy, rx, ry, c, o]) => `<ellipse cx="${f(cx + (r() - 0.5) * 30)}" cy="${f(cy + (r() - 0.5) * 30)}" rx="${rx}" ry="${ry}" fill="${c}" fill-opacity="${o}" transform="rotate(${f(r() * 40 - 20)} ${cx} ${cy})"/>`)
    .join('');

  // ---- stems fanning out from the corner
  const angles = [6, 25, 44, 63, 84].map((a) => a + (r() - 0.5) * 8);
  const stems = angles.map((deg, i) => {
    const len = i === 0 || i === 4 ? 560 + r() * 170 : 320 + r() * 170;
    const rad = (deg * Math.PI) / 180;
    const dir = [Math.cos(rad), Math.sin(rad)];
    const nrm = [-dir[1], dir[0]];
    const p0 = [-30 + r() * 40, -30 + r() * 40];
    const bend = (r() - 0.5) * len * 0.34;
    const at = (k, b) => [p0[0] + dir[0] * len * k + nrm[0] * b, p0[1] + dir[1] * len * k + nrm[1] * b];
    return [p0, at(0.33, bend), at(0.66, -bend * 0.6), at(1, 0)];
  });

  const leafGrads = ['gSage', 'gSage', 'gOlive', 'gBlue', 'gBlue', 'gTeal'];
  const leafInk = [];
  const stemGroups = stems.map((s, si) => {
    const n = Math.round(lerp(3, 8, Math.min(1, Math.hypot(s[3][0] - s[0][0], s[3][1] - s[0][1]) / 700)));
    let out = '';
    for (let i = 0; i <= n; i++) {
      const t = lerp(0.14, 0.97, i / n);
      const [x, y] = bez(s, t);
      const tan = bezAngle(s, t);
      const side = i % 2 ? 1 : -1;
      const ang = i === n ? tan : tan + side * (36 + r() * 24);
      const size = lerp(125, 52, t) * (0.75 + r() * 0.5);
      const wid = size * lerp(0.3, 0.42, r());
      const grad = leafGrads[Math.floor(r() * leafGrads.length)];
      const op = grad === 'gTeal' ? 0.32 : 0.62;
      const d = leafPath(r, size, wid);
      out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"><path d="${d}" fill="url(#${grad})" fill-opacity="${op}" stroke="${P.olive}" stroke-opacity=".25" stroke-width="1.6"/></g>`;
      let veins = '';
      for (let k = 1; k <= 4; k++) {
        const px = size * (k / 5.2);
        veins += `M${f(px)} 0l${f(size * 0.13)} ${f(-wid * 0.55)}M${f(px)} 0l${f(size * 0.13)} ${f(wid * 0.55)}`;
      }
      leafInk.push(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"><path d="M0 0Q${f(size * 0.5)} ${f((r() - 0.5) * 6)} ${f(size * 0.93)} 0${veins}" fill="none" stroke="${P.ink}" stroke-opacity=".3" stroke-width="1.1" stroke-linecap="round"/></g>`);
    }
    return `<g filter="url(#wcM)">${out}</g>`;
  });

  const stemInk = stems
    .map((s) => `<path d="M${f(s[0][0])} ${f(s[0][1])}C${f(s[1][0])} ${f(s[1][1])} ${f(s[2][0])} ${f(s[2][1])} ${f(s[3][0])} ${f(s[3][1])}" fill="none" stroke="${P.olive}" stroke-opacity=".7" stroke-width="3.2" stroke-linecap="round"/>`)
    .join('');

  // ---- flowers
  const flowers = [];
  const flowerInk = [];
  function rose(cx, cy, R, hue) {
    const g = hue === 'coral' ? 'gCoral' : 'gPink';
    const rim = hue === 'coral' ? P.coral : P.pink;
    const start = r() * 360;
    let out = '';
    const ring = (n, len, wid, op, rot) => {
      for (let i = 0; i < n; i++) {
        const a = rot + (i * 360) / n + (r() - 0.5) * 22;
        const l = len * (0.88 + r() * 0.24);
        out += `<path transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a)})" d="${petalPath(l, wid * (0.9 + r() * 0.25))}" fill="url(#${g})" fill-opacity="${op}" stroke="${tone(rim, -0.25)}" stroke-opacity=".5" stroke-width="1.6"/>`;
      }
    };
    ring(7, R, R * 0.34, 0.52, start);
    ring(5, R * 0.68, R * 0.27, 0.58, start + 25);
    ring(4, R * 0.42, R * 0.2, 0.66, start + 60);
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.1)}" fill="${tone(rim, -0.3)}" fill-opacity=".6"/>`;
    flowers.push(`<g filter="url(#wcM)">${out}</g>`);
    // fine ink: petal veins + a small spiral heart
    let ink = '';
    for (let i = 0; i < 6; i++) {
      const a = ((start + i * 60 + r() * 20) * Math.PI) / 180;
      ink += `M${f(cx + Math.cos(a) * R * 0.15)} ${f(cy + Math.sin(a) * R * 0.15)}L${f(cx + Math.cos(a + 0.05) * R * 0.78)} ${f(cy + Math.sin(a + 0.05) * R * 0.78)}`;
    }
    ink += `M${f(cx - R * 0.08)} ${f(cy)}a${f(R * 0.08)} ${f(R * 0.08)} 0 1 1 ${f(R * 0.16)} 0a${f(R * 0.13)} ${f(R * 0.13)} 0 1 1 ${f(-R * 0.26)} 0`;
    flowerInk.push(`<path d="${ink}" fill="none" stroke="${P.ink}" stroke-opacity=".3" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="46 5 22 7"/>`);
  }
  function daisy(cx, cy, R, hue) {
    const g = hue === 'coral' ? 'gCoral' : 'gPink';
    const n = 9;
    const rot = r() * 40;
    let out = '';
    for (let i = 0; i < n; i++) {
      out += `<path transform="translate(${f(cx)} ${f(cy)}) rotate(${f(rot + (i * 360) / n + (r() - 0.5) * 12)})" d="${petalPath(R * (0.9 + r() * 0.2), R * 0.2)}" fill="url(#${g})" fill-opacity=".62" stroke="${P.coral}" stroke-opacity=".4" stroke-width="1.2"/>`;
    }
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.2)}" fill="${P.olive}" fill-opacity=".62"/>`;
    flowers.push(`<g filter="url(#wcS)">${out}</g>`);
  }

  const place = (si, t, R, hue, kind = rose) => {
    const [x, y] = bez(stems[si], t);
    kind(x, y, R, hue);
  };
  const flip = variant === 2;
  place(2, 0.3, 122, flip ? 'coral' : 'pink');
  place(1, 0.5, 86, flip ? 'pink' : 'coral');
  place(3, 0.5, 90, flip ? 'coral' : 'pink');
  place(2, 0.68, 66, flip ? 'pink' : 'coral');
  place(0, 0.62, 44, 'pink', daisy);
  place(4, 0.7, 46, 'coral', daisy);
  place(1, 0.92, 34, 'pink', daisy);
  place(3, 0.9, 34, 'coral', daisy);

  // ---- buds / berries at the stem tips, and paint splatter
  let berries = '';
  stems.forEach((s, si) => {
    const [x, y] = s[3];
    const a = bezAngle(s, 1);
    for (let k = 0; k < 3 + (si % 2); k++) {
      const off = (k - 1) * 22;
      const px = x + Math.cos(((a + 90) * Math.PI) / 180) * off + Math.cos((a * Math.PI) / 180) * (r() * 24);
      const py = y + Math.sin(((a + 90) * Math.PI) / 180) * off + Math.sin((a * Math.PI) / 180) * (r() * 24);
      berries += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(7 + r() * 6)}" fill="${r() > 0.5 ? P.coral : P.pink}" fill-opacity=".62"/>`;
    }
  });
  let dots = '';
  for (let i = 0; i < 26; i++) {
    const t = r();
    const x = r() * 640 * (0.4 + t);
    const y = r() * 640 * (1.3 - t) * 0.8;
    dots += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + r() * 4.5)}" fill="${[P.pink, P.coral, P.blue, P.ink][Math.floor(r() * 4)]}" fill-opacity="${f(0.25 + r() * 0.35)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}"><defs>${defs}</defs>
    <g filter="url(#wcL)">${atmos}</g>
    ${stemGroups.join('')}
    <g filter="url(#pen)">${leafInk.join('')}</g>
    <g filter="url(#wcS)">${stemInk}</g>
    <g filter="url(#wcS)">${berries}</g>
    ${flowers.join('')}
    <g filter="url(#pen)">${flowerInk.join('')}</g>
    <g filter="url(#wcS)">${dots}</g>
  </svg>`;
}
