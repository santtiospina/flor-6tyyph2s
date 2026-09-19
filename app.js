// Álbum — intro → índice → sección con texto que se revela al tocar cada foto.
// Everything you write lives in content.json; nothing here needs editing to add photos or text.
import { mountArt } from './art.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const params = new URLSearchParams(location.search);
const DEV = params.has('dev'); // ?dev → everything unlocked, nothing saved
const STORE_KEY = 'album-progress-v1';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const wide = matchMedia('(min-width: 900px)');
const canWash = typeof CSS !== 'undefined' && 'registerProperty' in CSS; // @property → animated mask
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const clamp = (n, a = 0, b = 100) => Math.min(b, Math.max(a, n));

function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...kids.flat().filter((k) => k != null && k !== false));
  return node;
}
const svg = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
};
function hash(str) {
  let x = 2166136261;
  for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return x >>> 0;
}
const rotFor = (key) => ((hash(key) % 1000) / 1000 - 0.5) * 4.6; // a stable little tilt, ±2.3°

// ------------------------------------------------------------------ progress (localStorage)
if (params.has('reset')) { // ?reset → forget progress once, then drop the flag from the URL
  try { localStorage.removeItem(STORE_KEY); } catch {}
  params.delete('reset');
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
}
const store = {
  load() {
    try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY))?.read ?? []); } catch { return new Set(); }
  },
  save(set) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, read: [...set] })); } catch {}
  },
};

let content;
let sizes = {};
let read = new Set(); // keyed by photo src, so re-ordering content.json never breaks progress
let sec = null; // section being viewed
let entered = false;
let cameFromMenu = false;
let menuScroll = 0;

const isRead = (src) => DEV || read.has(src);
const readCount = (s) => s.photos.filter((p) => isRead(p.src)).length;

// ------------------------------------------------------------------ boot
async function init() {
  history.scrollRestoration = 'manual';
  const art = mountArt(); // start early; it keeps blooming in even if we stop waiting for it
  try {
    const [c, m] = await Promise.all([
      fetch('content.json', { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`content.json: ${r.status}`);
        return r.json();
      }),
      fetch('photos/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    content = c;
    sizes = m;
  } catch (e) {
    return fail(e);
  }
  read = store.load();
  if (DEV) document.body.append(h('div', { class: 'dev-badge mono' }, 'dev'));
  bindPanel();
  $('#back').addEventListener('click', goMenu);
  addEventListener('keydown', (e) => e.key === 'Escape' && sec && goMenu());
  addEventListener('popstate', route);
  // hold the veil until every font we actually use is ready, so nothing flashes in a fallback face
  const fonts = ['500 1em "Grenze Gotisch"', '1em "EB Garamond"', 'italic 1em "EB Garamond"', '1em "DM Mono"'];
  await Promise.race([Promise.all([...fonts.map((f) => document.fonts.load(f).catch(() => {})), art]), sleep(3000)]);
  route();
  document.body.classList.remove('is-loading');
}

function fail(e) {
  console.error(e);
  $('.bloom').style.display = 'none';
  const t = $('.veil-text');
  t.style.animation = 'none';
  t.textContent = 'No se pudo abrir el álbum. Recarga la página.';
  if (DEV) t.append(h('br'), h('small', { class: 'mono' }, String(e.message)));
}

// ------------------------------------------------------------------ routing: #section-id
function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = content.sections.find((s) => s.id === id);
  if (target) {
    entered = true;
    showSection(target);
  } else if (entered) {
    cameFromMenu = false;
    showMenu();
  } else {
    showIntro();
  }
}

function goMenu() {
  if (cameFromMenu) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    route();
  }
}

function show(name, focusEl) {
  for (const n of ['intro', 'menu', 'section']) $(`#view-${n}`).hidden = n !== name;
  const v = $(`#view-${name}`);
  v.classList.remove('enter');
  void v.offsetWidth;
  v.classList.add('enter');
  document.body.dataset.view = name;
  $('#back').hidden = name !== 'section';
  if (name !== 'section') {
    $('#panel').hidden = true;
    document.body.style.removeProperty('--accent');
  }
  focusEl?.focus({ preventScroll: true });
}

// ------------------------------------------------------------------ intro
const ORNAMENT = `<svg class="orn" viewBox="0 0 240 30" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" aria-hidden="true">
  <path d="M4 15h94M142 15h94"/><circle cx="4" cy="15" r="1.4" fill="currentColor" stroke="none"/><circle cx="236" cy="15" r="1.4" fill="currentColor" stroke="none"/>
  <path d="M120 27V8"/>
  <path d="M120 19c-6-.4-9.500-3.300-10.500-8.500 6 .3 9.800 3.200 10.500 8.500zM120 14c5.500-1 8.500-4 9-9-5.500 1-8.800 4.200-9 9z" fill="currentColor" fill-opacity=".8" stroke="none"/>
  <path d="M100 15c3-2 6.500-2 9.500 0M140 15c-3-2-6.500-2-9.500 0"/>
</svg>`;

function showIntro() {
  const m = content.meta ?? {};
  const lines = String(m.intro ?? '').split('\n');
  const title = h('h1', { class: 'intro-title', tabindex: '-1' }, m.title ?? '');
  $('#view-intro').replaceChildren(
    title,
    svg(ORNAMENT),
    h('p', { class: 'intro-text' }, ...lines.flatMap((l, i) => (i ? [h('br'), l] : [l]))),
    h('div', { class: 'intro-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => { entered = true; route(); } }, read.size ? 'Seguir mirando' : 'Abrir el álbum'))
  );
  show('intro', title);
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ menu = the album's index
function showMenu() {
  sec = null;
  const total = content.sections.reduce((n, s) => n + s.photos.length, 0);
  const got = content.sections.reduce((n, s) => n + readCount(s), 0);
  const title = h('h2', { class: 'menu-title', tabindex: '-1' }, 'Índice');
  $('#view-menu').replaceChildren(
    h('header', { class: 'menu-head' }, title, h('p', { class: 'menu-sub mono' }, `${got} de ${total} recuerdos revelados`)),
    h('ol', { class: 'cards' }, ...content.sections.map(card))
  );
  show('menu', title);
  window.scrollTo(0, menuScroll);
}

function card(s, i) {
  const n = s.photos.length;
  const got = readCount(s);
  const cover = s.cover || s.photos[0]?.src;
  const img = h('img', { src: `photos/${cover}`, alt: '', loading: i < 6 ? 'eager' : 'lazy', decoding: 'async', draggable: 'false' });
  const a = h('a', {
      class: 'card' + (n && got === n ? ' is-done' : ''),
      href: `#${encodeURIComponent(s.id)}`,
      style: `--rot:${rotFor(s.id).toFixed(2)}deg; --p:${(n ? got / n : 0).toFixed(3)}; --accent:${s.accent || 'var(--sage)'}`,
      'aria-label': `${s.title}, ${got} de ${n} fotos reveladas`,
      onclick: () => { cameFromMenu = true; menuScroll = scrollY; },
    },
    h('span', { class: 'card-photo' }, img),
    h('span', { class: 'card-title' }, s.title),
    h('span', { class: 'card-meta mono' }, h('span', {}, pad(i + 1)), h('span', { class: 'card-count' }, `${got}/${n}`))
  );
  const loaded = () => a.classList.add('is-loaded');
  img.addEventListener('load', loaded, { once: true });
  img.addEventListener('error', loaded, { once: true });
  if (img.complete && img.naturalWidth) loaded();
  return h('li', {}, a);
}

// ------------------------------------------------------------------ section view
function showSection(s) {
  sec = s;
  document.body.style.setProperty('--accent', s.accent || 'var(--sage)');
  const title = h('h2', { class: 'sec-title', tabindex: '-1' }, s.title);
  const list = h('ol', { class: 'polas' }, ...s.photos.map((p, i) => polaroid(p, i)));
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.pola');
    if (btn) activate(+btn.dataset.i, btn, e);
  });
  $('#view-section').replaceChildren(
    h('header', { class: 'sec-head' },
      title,
      s.subtitle && h('p', { class: 'sec-sub' }, s.subtitle),
      h('p', { class: 'sec-count mono' }),
      h('p', { class: 'sec-hint mono' }, 'Toca una foto para revelarla')),
    list
  );
  buildPanel(s);
  refreshCounts();
  show('section', title);
  window.scrollTo(0, 0);
}

const polaLabel = (p, i, n, done) => `Foto ${i + 1} de ${n}${p.alt ? `: ${p.alt}` : ''}. ${done ? 'Revelada.' : 'Toca para revelar.'}`;

function polaroid(p, i) {
  const [w, hh] = sizes[p.src] ?? [4, 5];
  const ar = clamp(w / hh, 0.55, 1.8);
  const done = isRead(p.src);
  const loading = i < 4 ? 'eager' : 'lazy';
  const url = `photos/${p.src}`;
  const top = h('img', { class: 'ph-top', src: url, alt: p.alt ?? '', loading, decoding: 'async', draggable: 'false' });
  const base = done ? null : h('img', { class: 'ph-base', src: url, alt: '', 'aria-hidden': 'true', loading, decoding: 'async', draggable: 'false' });
  const btn = h('button', {
      class: `pola ${done ? 'is-read' : 'is-unread'}`,
      type: 'button',
      'data-i': i,
      style: `--rot:${rotFor(sec.id + i).toFixed(2)}deg; --ar:${ar.toFixed(4)}`,
      'aria-label': polaLabel(p, i, sec.photos.length, done),
    },
    h('span', { class: 'frame' },
      h('span', { class: 'photo' }, base, top),
      h('span', { class: 'margin' },
        h('span', { class: 'n mono' }, pad(i + 1)),
        h('span', { class: 'cap' }, p.caption ?? ''),
        h('span', { class: 'mark', 'aria-hidden': 'true' }, svg('<svg viewBox="0 0 24 24"><use href="#i-sprig"/></svg>'))))
  );
  const loaded = () => btn.classList.add('is-loaded');
  for (const img of [top, base].filter(Boolean)) {
    img.addEventListener('load', loaded, { once: true });
    img.addEventListener('error', () => btn.classList.add('is-error'), { once: true });
    if (img.complete && img.naturalWidth) loaded();
  }
  return h('li', {}, btn);
}

// a tap: develop the photo (first time) or point at its text (afterwards); a tap during an animation finishes it
function activate(i, btn, ev) {
  const p = sec.photos[i];
  let entry = entryFor(i);
  const animating = btn.classList.contains('is-developing') || entry?.classList.contains('typing');
  if (animating) {
    finishNow(btn, entry);
  } else if (btn.classList.contains('is-unread')) {
    read.add(p.src);
    if (!DEV) store.save(read);
    develop(btn, ev);
    entry = addEntry(i, true);
    refreshCounts();
  }
  setCurrent(i, btn);
  openEntry(entry ?? entryFor(i));
  keepInView(btn);
}

// on phones the sheet covers the lower half: scroll so the photo she just tapped stays visible above it
function keepInView(btn) {
  if (wide.matches) return;
  requestAnimationFrame(() => {
    const r = btn.getBoundingClientRect();
    const overlap = r.bottom - (innerHeight - $('#panel').offsetHeight - 14);
    if (overlap > 0) scrollBy({ top: Math.min(overlap, Math.max(0, r.top - 72)), behavior: reduce.matches ? 'auto' : 'smooth' });
  });
}

function develop(btn, ev) {
  const top = $('.ph-top', btn);
  const rect = $('.photo', btn).getBoundingClientRect();
  const fromKeyboard = !ev || ev.detail === 0 || (ev.clientX === 0 && ev.clientY === 0);
  top.style.setProperty('--mx', `${fromKeyboard ? 50 : clamp(((ev.clientX - rect.left) / rect.width) * 100)}%`);
  top.style.setProperty('--my', `${fromKeyboard ? 50 : clamp(((ev.clientY - rect.top) / rect.height) * 100)}%`);
  btn.classList.replace('is-unread', 'is-developing');
  btn.setAttribute('aria-label', polaLabel(sec.photos[+btn.dataset.i], +btn.dataset.i, sec.photos.length, true));

  const done = () => {
    clearTimeout(btn._timer);
    btn._anim = btn._finish = null;
    $('.ph-base', btn)?.remove();
    btn.classList.remove('go', 'fade-mode');
    btn.classList.replace('is-developing', 'is-read');
  };
  btn._finish = done;
  if (reduce.matches) return done();
  if (canWash) {
    const a = top.animate([{ '--r': '0%' }, { '--r': '145%' }], { duration: 3200, easing: 'cubic-bezier(.3,.15,.6,.9)', fill: 'forwards' });
    btn._anim = a;
    a.finished.then(() => { a.cancel(); done(); }).catch(() => {});
  } else {
    btn.classList.add('fade-mode');
    requestAnimationFrame(() => requestAnimationFrame(() => btn.classList.add('go')));
    btn._timer = setTimeout(done, 2500);
  }
}

function finishNow(btn, entry) {
  if (btn.classList.contains('is-developing')) {
    if (btn._anim) btn._anim.finish();
    else btn._finish?.();
  }
  if (entry?.classList.contains('typing')) {
    clearTimeout(entry._timer);
    entry.classList.replace('typing', 'instant');
  }
}

const btnFor = (i) => $(`.pola[data-i="${i}"]`);
const entryFor = (i) => $(`#entries [data-i="${i}"]`);

function setCurrent(i, btn = btnFor(i)) {
  $$('.pola.is-active').forEach((el) => el.classList.remove('is-active'));
  $$('.entry.is-current').forEach((el) => el.classList.remove('is-current'));
  btn?.classList.add('is-active');
  entryFor(i)?.classList.add('is-current');
}

// ------------------------------------------------------------------ text panel (bottom sheet ↔ side panel)
function bindPanel() {
  $('#panel-head').addEventListener('click', () => {
    if (!wide.matches) setSheet($('#panel').dataset.state === 'open' ? 'peek' : 'open');
  });
  $('#entries').addEventListener('click', (e) => {
    const entry = e.target.closest('.entry');
    if (!entry) return;
    const i = +entry.dataset.i;
    if (entry.classList.contains('typing')) finishNow(btnFor(i), entry);
    setCurrent(i);
  });
  new ResizeObserver(syncSheetSpace).observe($('#panel'));
  wide.addEventListener('change', () => { $('#panel-head').tabIndex = wide.matches ? -1 : 0; syncSheetSpace(); });
  $('#panel-head').tabIndex = wide.matches ? -1 : 0;
}

function buildPanel(s) {
  $('#panel').hidden = false;
  $('#entries').replaceChildren();
  s.photos.forEach((p, i) => isRead(p.src) && addEntry(i, false));
  $('#panel-body').scrollTop = 0;
  setSheet(readCount(s) ? 'peek' : 'hidden');
}

function setSheet(state) {
  $('#panel').dataset.state = state;
  $('#panel-head').setAttribute('aria-expanded', String(state === 'open'));
  syncSheetSpace();
}

// keep the last polaroids reachable above the sheet
function syncSheetSpace() {
  const v = $('#view-section');
  if (wide.matches) return v.style.removeProperty('--sheet-space');
  const panel = $('#panel');
  const px = { open: panel.offsetHeight, peek: 64, hidden: 0 }[panel.dataset.state] ?? 0;
  v.style.setProperty('--sheet-space', `${px}px`);
}

function buildEntry(i, animate) {
  const p = sec.photos[i];
  const paras = String(p.text ?? '').split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
  const node = h('article', { class: 'entry', 'data-i': i, 'aria-label': `Recuerdo ${i + 1}` });
  node.append(h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1)));

  const total = animate ? paras.join(' ').split(/\s+/).length : 0;
  const step = Math.min(70, 2200 / Math.max(total, 1));
  let n = 0;
  for (const para of paras) {
    const lines = para.split('\n').flatMap((line, li) => {
      const words = animate
        ? line.split(/(\s+)/).map((tok) => (/^\s+$/.test(tok) || !tok ? tok : h('span', { class: 'w', style: `--d:${Math.round(n++ * step)}ms` }, tok)))
        : [line];
      return li ? [h('br'), ...words] : words;
    });
    node.append(h('p', {}, ...lines));
  }
  if (p.caption) node.append(h('span', { class: 'cap mono' }, p.caption));
  if (animate) {
    node.classList.add('typing');
    node._timer = setTimeout(() => node.classList.replace('typing', 'instant'), n * step + 1100);
  }
  return node;
}

function addEntry(i, animate) {
  const list = $('#entries');
  const node = buildEntry(i, animate);
  // narrative order = order of the photos array, whatever order she taps them in
  list.insertBefore(node, [...list.children].find((c) => +c.dataset.i > i) ?? null);
  $('#panel').classList.add('has-entries');
  return node;
}

function openEntry(entry) {
  if (!entry) return;
  if (!wide.matches) setSheet('open');
  requestAnimationFrame(() => {
    $('#panel-body').scrollTo({ top: Math.max(0, entry.offsetTop - 10), behavior: reduce.matches ? 'auto' : 'smooth' });
  });
  entry.classList.remove('is-flash');
  void entry.offsetWidth;
  entry.classList.add('is-flash');
}

function refreshCounts() {
  if (!sec) return;
  const got = readCount(sec);
  $('.sec-count').textContent = `${got} de ${sec.photos.length} reveladas`;
  $('.sec-hint').classList.toggle('is-gone', got > 0);
  $('#panel-count').textContent = `${got}/${sec.photos.length}`;
  $('#panel').classList.toggle('has-entries', got > 0);
}

init();
