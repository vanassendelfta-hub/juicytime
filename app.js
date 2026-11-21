/* Juicy Time bestelsite
 * Pas hieronder de instellingen aan. Alles werkt zonder server:
 * de bestelling wordt als bericht via WhatsApp of Instagram verstuurd.
 * Vul `orderEndpoint` in zodra er een backend is (bijv. Supabase edge function).
 */
const CONFIG = {
  businessName: 'Juicy Time',
  instagram: 'jjuicytime',
  whatsapp: '',              // bijv. '31612345678' (zonder + en zonder spaties). Leeg = verborgen.
  email: '',                 // optioneel: bestellingen ook via mail
  orderEndpoint: '',         // optioneel: URL die de bestelling als JSON ontvangt (POST)
  priceSingle: 4.5,
  priceTrio: 10,
  bulkThreshold: 20,         // vanaf dit aantal: prijs bespreekbaar
  deliveryFee: null,         // null = "in overleg", of bijv. 2.5
  slotStart: '12:00',
  slotEnd: '22:00',
  slotMinutes: 30,
  leadMinutes: 60,           // minimaal zoveel minuten van tevoren bestellen
  // Per weekdag (0 = maandag): open, van, tot. Leeg = elke dag slotStart–slotEnd. Wordt overschreven vanuit /beheer.
  days: null,
  closed: false,             // tijdelijk gesloten: bestellen kan niet
  closedText: '',
};

const MENU = [
  {
    id: 'juicy-lychee', name: 'Juicy Lychee', img: '/img/juicy-lychee-glas.webp',
    color: '#F49AAE', tag: 'Nieuw',
    desc: 'Zacht en fruitig met lychee, afgemaakt met munt en een eetbaar bloemetje.',
  },
  {
    id: 'sangria', name: 'Sangría', img: '/img/sangria-glas.webp',
    color: '#E8433A',
    desc: 'Rode wijn met sinaasappel en aardbei. Hiervoor hoef je niet naar Spanje.',
  },
  {
    id: 'sex-on-the-beach', name: 'Sex on the Beach', img: '/img/sex-on-the-beach-glas.webp',
    color: '#FF6B3D', tag: 'Favoriet',
    desc: 'De zomerklassieker: vodka, perzik, sinaasappel en cranberry.',
  },
  {
    id: 'pornstar-martini', name: 'Pornstar Martini', img: '/img/pornstar-martini-glas.webp',
    color: '#F59E1B',
    desc: 'Passievrucht en vanille met vodka. Zoet, fris en een tikje exotisch.',
  },
];

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const eur = (n) => '€' + n.toFixed(2).replace('.', ',');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

let cart = store.get('jt_cart', {});
for (const k of Object.keys(cart)) if (!MENU.find((m) => m.id === k)) delete cart[k];

const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
function pricing(n) {
  const trios = Math.floor(n / 3);
  const rest = n % 3;
  const subtotal = trios * CONFIG.priceTrio + rest * CONFIG.priceSingle;
  const full = n * CONFIG.priceSingle;
  const delivery = method() === 'bezorgen' && typeof CONFIG.deliveryFee === 'number' ? CONFIG.deliveryFee : 0;
  return { subtotal, discount: full - subtotal, delivery, total: subtotal + delivery };
}
const method = () => ($('input[name="method"]:checked') || {}).value || 'ophalen';

/* ---------- menu ---------- */
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shown = () => MENU.filter((m) => !m.hidden);
function renderMenu() {
  $('[data-menu]').innerHTML = shown().map((m) => `
    <article class="card${m.soldOut ? ' soldout' : ''}" style="--accent:${m.color}">
      <div class="card-img">
        ${m.tag ? `<span class="tag">${esc(m.tag)}</span>` : ''}
        <img src="${m.img}" alt="${esc(m.name)} illustratie" loading="lazy" width="395" height="425">
      </div>
      <div class="card-body">
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.desc)}</p>
        <div class="card-foot">
          <span class="price">${eur(CONFIG.priceSingle)} <small>· 200 ml</small></span>
          ${m.soldOut ? '<span class="soldout-tag">Uitverkocht</span>' : `<div class="qty" data-qty="${m.id}">
            <button type="button" data-dec="${m.id}" aria-label="Eén ${esc(m.name)} minder">−</button>
            <output data-q="${m.id}" aria-live="polite">0</output>
            <button type="button" data-inc="${m.id}" aria-label="Eén ${esc(m.name)} erbij">+</button>
          </div>`}
        </div>
      </div>
    </article>`).join('');
}

/* ---------- cart ---------- */
function setQty(id, q) {
  const item = MENU.find((m) => m.id === id);
  if (!item || item.hidden || (item.soldOut && q > (cart[id] || 0))) return;
  q = Math.max(0, Math.min(500, q | 0));
  if (q === 0) delete cart[id]; else cart[id] = q;
  store.set('jt_cart', cart);
  render();
}

function render() {
  const n = count();
  const p = pricing(n);
  $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.classList.toggle('show', n > 0); });
  MENU.forEach((m) => {
    const o = $(`[data-q="${m.id}"]`);
    if (o) { o.textContent = cart[m.id] || 0; o.closest('.qty').classList.toggle('has', !!cart[m.id]); }
  });

  const lines = shown().filter((m) => cart[m.id]);
  $('[data-cart-lines]').innerHTML = lines.map((m) => `
    <div class="line">
      <img src="${m.img}" alt="" width="56" height="60">
      <div class="line-info"><strong>${esc(m.name)}</strong><span>${eur(CONFIG.priceSingle)} p.st.</span></div>
      <div class="qty has">
        <button type="button" data-dec="${m.id}" aria-label="Eén ${esc(m.name)} minder">−</button>
        <output>${cart[m.id]}</output>
        <button type="button" data-inc="${m.id}" aria-label="Eén ${esc(m.name)} erbij">+</button>
      </div>
    </div>`).join('');

  $('[data-cart-empty]').hidden = n > 0;
  $('[data-totals]').hidden = n === 0;
  $('[data-form]').hidden = n === 0;
  $('[data-t-count]').textContent = `${n} × ${eur(CONFIG.priceSingle)} = ${eur(n * CONFIG.priceSingle)}`;
  $('[data-t-deal-row]').hidden = p.discount <= 0;
  $('[data-t-deal]').textContent = '−' + eur(p.discount);
  const isDel = method() === 'bezorgen';
  $('[data-t-delivery-row]').hidden = !isDel;
  $('[data-t-delivery]').textContent = typeof CONFIG.deliveryFee === 'number' ? eur(CONFIG.deliveryFee) : 'in overleg';
  $('[data-t-total]').textContent = eur(p.total);
  $('[data-bulk-note]').hidden = n < CONFIG.bulkThreshold;

  const nudge = $('[data-nudge]');
  const r = n % 3;
  if (n > 0 && r !== 0) {
    const extra3 = (r === 2 ? 1 : 2);
    const cost = pricing(n + extra3).subtotal - pricing(n).subtotal;
    nudge.textContent = `Tip: nog ${extra3} erbij kost maar ${eur(cost)} extra (3 voor ${eur(CONFIG.priceTrio).replace(',00', '')}).`;
    nudge.hidden = false;
  } else nudge.hidden = true;

  $('[data-submit]').textContent = n >= CONFIG.bulkThreshold ? 'Feestbestelling aanvragen' : `Bestelling plaatsen · ${eur(p.total)}`;
  $('[data-submit]').disabled = !!CONFIG.closed;
  let cn = $('[data-closed-note]');
  if (CONFIG.closed) {
    if (!cn) { cn = document.createElement('p'); cn.className = 'closed-note'; cn.setAttribute('data-closed-note', ''); cn.setAttribute('role', 'alert'); $('[data-form]').prepend(cn); }
    cn.textContent = CONFIG.closedText || 'We nemen op dit moment geen bestellingen aan.';
  } else if (cn) cn.remove();
  const bar = $('[data-mobile-bar]');
  bar.hidden = n === 0;
  $('[data-mb-count]').textContent = n === 1 ? '1 cocktail' : `${n} cocktails`;
  $('[data-mb-total]').textContent = eur(p.total);
  document.body.classList.toggle('has-bar', n > 0);
}

/* ---------- drawer ---------- */
let lastFocus = null;
function openCart() {
  lastFocus = document.activeElement;
  $('#cart').classList.add('open');
  $('#cart').setAttribute('aria-hidden', 'false');
  $('.drawer-backdrop').hidden = false;
  document.body.classList.add('lock');
  setTimeout(() => $('#cart .icon-btn').focus(), 50);
}
function closeCart() {
  $('#cart').classList.remove('open');
  $('#cart').setAttribute('aria-hidden', 'true');
  $('.drawer-backdrop').hidden = true;
  document.body.classList.remove('lock');
  if (lastFocus) lastFocus.focus();
}

/* ---------- date / time ---------- */
const pad = (n) => String(n).padStart(2, '0');
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function localISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function hoursOn(d) {           // tijden voor een datum, of null als we dan dicht zijn
  const day = CONFIG.days && CONFIG.days[(d.getDay() + 6) % 7];
  if (!day) return { start: CONFIG.slotStart, end: CONFIG.slotEnd };
  return day.open && day.van && day.tot ? { start: day.van, end: day.tot } : null;
}
const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
function setupDate() {
  const input = $('input[name="date"]');
  const now = new Date();
  const first = new Date(now);
  const nowMin = now.getHours() * 60 + now.getMinutes() + CONFIG.leadMinutes;
  for (let i = 0; i < 14; i++) {     // eerste dag waarop nog een tijd te kiezen is
    const h = hoursOn(first);
    if (h && (i > 0 || nowMin <= toMin(h.end))) break;
    first.setDate(first.getDate() + 1);
  }
  if (input.value && input.value < localISO(first)) input.value = '';
  input.min = localISO(first);
  const max = new Date(now); max.setDate(max.getDate() + 60);
  input.max = localISO(max);
  if (!input.value) input.value = input.min;
  fillSlots();
}
function fillSlots() {
  const sel = $('select[name="time"]');
  const date = $('input[name="date"]').value;
  const now = new Date();
  const isToday = date === localISO(now);
  const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + CONFIG.leadMinutes : 0;
  const prev = sel.value;
  const opts = [];
  const h = date ? hoursOn(fromISO(date)) : null;
  if (!h) { sel.innerHTML = '<option value="">Gesloten op deze dag</option>'; return; }
  for (let t = toMin(h.start); t <= toMin(h.end); t += CONFIG.slotMinutes) {
    if (t < earliest) continue;
    const v = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    opts.push(`<option value="${v}">${v}</option>`);
  }
  sel.innerHTML = opts.length ? opts.join('') : '<option value="">Geen tijden meer vandaag</option>';
  if (prev && opts.some((o) => o.includes(`"${prev}"`))) sel.value = prev;
}

/* ---------- order ---------- */
function orderId() {
  const d = new Date();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JT-${pad(d.getDate())}${pad(d.getMonth() + 1)}-${rnd}`;
}
function niceDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function validate(f) {
  const errs = [];
  const get = (n) => (f.elements[n].value || '').trim();
  if (CONFIG.closed) errs.push(CONFIG.closedText || 'We nemen op dit moment geen bestellingen aan.');
  if (!get('date')) errs.push('Kies een datum.');
  else if (!hoursOn(fromISO(get('date')))) errs.push('Op die dag zijn we gesloten. Kies een andere dag.');
  if (!get('time')) errs.push('Kies een tijd.');
  if (get('name').length < 2) errs.push('Vul je naam in.');
  if (get('phone').replace(/\D/g, '').length < 9) errs.push('Vul een geldig telefoonnummer in.');
  if (get('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email'))) errs.push('Controleer je e-mailadres.');
  if (method() === 'bezorgen') {
    if (get('street').length < 3) errs.push('Vul je straat en huisnummer in.');
    if (!/^\d{4}\s?[a-zA-Z]{2}$/.test(get('postcode'))) errs.push('Vul een geldige postcode in (bijv. 3011 AB).');
    if (!get('city')) errs.push('Vul je plaats in.');
  }
  if (!f.elements.age.checked) errs.push('Bevestig dat je 18 jaar of ouder bent.');
  return errs;
}

function buildOrder(f) {
  const v = (n) => (f.elements[n].value || '').trim();
  const n = count();
  const p = pricing(n);
  return {
    id: orderId(),
    createdAt: new Date().toISOString(),
    items: shown().filter((m) => cart[m.id]).map((m) => ({ id: m.id, name: m.name, qty: cart[m.id] })),
    count: n,
    subtotal: p.subtotal, discount: p.discount, delivery: p.delivery, total: p.total,
    bulk: n >= CONFIG.bulkThreshold,
    method: method(),
    date: v('date'), time: v('time'),
    customer: { name: v('name'), phone: v('phone'), email: v('email') },
    address: method() === 'bezorgen' ? { street: v('street'), postcode: v('postcode').toUpperCase(), city: v('city') } : null,
    note: v('note'),
  };
}

function orderText(o) {
  const L = [];
  L.push(`Hoi ${CONFIG.businessName}! Ik wil graag bestellen 🍹`);
  L.push(`Bestelnr: ${o.id}`);
  L.push('');
  o.items.forEach((i) => L.push(`${i.qty}× ${i.name}`));
  L.push('');
  L.push(`Totaal: ${eur(o.total)}${o.discount > 0 ? ` (incl. ${eur(o.discount)} korting)` : ''}${o.method === 'bezorgen' && typeof CONFIG.deliveryFee !== 'number' ? ' + bezorgkosten' : ''}`);
  if (o.bulk) L.push('20+ cocktails: graag een prijs op maat.');
  L.push(`${o.method === 'bezorgen' ? 'Bezorgen' : 'Ophalen'}: ${niceDate(o.date)} om ${o.time}`);
  if (o.address) L.push(`Adres: ${o.address.street}, ${o.address.postcode} ${o.address.city}`);
  L.push(`Naam: ${o.customer.name}`);
  L.push(`Tel: ${o.customer.phone}`);
  if (o.customer.email) L.push(`E-mail: ${o.customer.email}`);
  if (o.note) L.push(`Opmerking: ${o.note}`);
  L.push('Ik ben 18+ ✅');
  return L.join('\n');
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove(); return ok;
  }
}

function showDone(o, text, posted) {
  $('[data-summary]').textContent = text;
  const btns = [];
  if (CONFIG.whatsapp) btns.push(`<a class="btn btn-wa btn-block" href="https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Verstuur via WhatsApp</a>`);
  btns.push(`<button class="btn btn-ig btn-block" type="button" data-ig>Kopieer en stuur via Instagram</button>`);
  if (CONFIG.email) btns.push(`<a class="btn btn-ghost btn-block" href="mailto:${CONFIG.email}?subject=${encodeURIComponent('Bestelling ' + o.id)}&body=${encodeURIComponent(text)}">Verstuur per e-mail</a>`);
  $('[data-send-btns]').innerHTML = posted ? '' : btns.join('');
  $('[data-done-text]').textContent = posted
    ? `Je bestelling ${o.id} is ontvangen. We sturen je zo snel mogelijk een bevestiging met het betaalverzoek.`
    : 'Verstuur je bestelling hieronder naar ons. Je ontvangt daarna een bevestiging met het betaalverzoek.';
  const ig = $('[data-ig]');
  if (ig) ig.addEventListener('click', async () => {
    const ok = await copy(text);
    ig.textContent = ok ? 'Gekopieerd! Plak het in de chat ✨' : 'Kopieer de tekst hierboven';
    window.open(`https://ig.me/m/${CONFIG.instagram}`, '_blank', 'noopener');
  });
  $('[data-modal]').hidden = false;
  document.body.classList.add('lock');
}

async function submit(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const err = $('[data-form-error]');
  const errs = validate(f);
  if (errs.length) { err.textContent = errs.join(' '); err.hidden = false; return; }
  err.hidden = true;
  const o = buildOrder(f);
  const text = orderText(o);
  let posted = false;
  if (CONFIG.orderEndpoint) {
    const btn = $('[data-submit]'); btn.disabled = true; btn.textContent = 'Versturen…';
    try {
      const res = await fetch(CONFIG.orderEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
      posted = res.ok;
    } catch { posted = false; }
    btn.disabled = false;
  }
  store.set('jt_customer', { name: o.customer.name, phone: o.customer.phone, email: o.customer.email });
  closeCart();
  showDone(o, text, posted);
  cart = {}; store.set('jt_cart', cart);
  f.elements.note.value = '';
  render();
}

/* ---------- wiring ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  if (t.dataset.inc) setQty(t.dataset.inc, (cart[t.dataset.inc] || 0) + 1);
  else if (t.dataset.dec) setQty(t.dataset.dec, (cart[t.dataset.dec] || 0) - 1);
  else if (t.hasAttribute('data-open-cart')) openCart();
  else if (t.hasAttribute('data-close-cart')) closeCart();
  else if (t.hasAttribute('data-close-modal')) { $('[data-modal]').hidden = true; document.body.classList.remove('lock'); }
  else if (t.hasAttribute('data-party')) {
    if (count() < CONFIG.bulkThreshold) {
      const note = $('textarea[name="note"]');
      if (!note.value) note.value = 'Feestje! Graag een prijs op maat voor ±25 cocktails.';
    }
    if (count() === 0) { document.getElementById('menu').scrollIntoView({ behavior: 'smooth' }); return; }
    openCart();
  }
});
$('.drawer-backdrop').addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('[data-modal]').hidden) { $('[data-modal]').hidden = true; document.body.classList.remove('lock'); }
  else if ($('#cart').classList.contains('open')) closeCart();
});
$$('input[name="method"]').forEach((r) => r.addEventListener('change', () => {
  $('[data-delivery]').hidden = method() !== 'bezorgen';
  render();
}));
$('input[name="date"]').addEventListener('change', fillSlots);
$('[data-form]').addEventListener('submit', submit);

/* ---------- inhoud uit het beheer (/beheer) ---------- */
function applyInhoud(d) {
  const i = d.instellingen || {}, c = d.contact || {}, t = d.tijden;
  const num = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
  CONFIG.priceSingle = num(i.prijs1, CONFIG.priceSingle);
  CONFIG.priceTrio = num(i.prijs3, CONFIG.priceTrio);
  if ('bezorgkosten' in i) CONFIG.deliveryFee = typeof i.bezorgkosten === 'number' ? i.bezorgkosten : null;
  CONFIG.bulkThreshold = num(i.feestVanaf, CONFIG.bulkThreshold);
  CONFIG.leadMinutes = num(i.voorbereiding, CONFIG.leadMinutes);
  CONFIG.slotMinutes = Math.max(15, num(i.tijdvak, CONFIG.slotMinutes));
  if ('whatsapp' in c) { let w = String(c.whatsapp || '').replace(/\D/g, ''); if (w.startsWith('06')) w = '31' + w.slice(1); CONFIG.whatsapp = w; }
  if (c.instagram) CONFIG.instagram = String(c.instagram).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
  if ('email' in c) CONFIG.email = c.email || '';
  if (t && Array.isArray(t.dagen) && t.dagen.length === 7) CONFIG.days = t.dagen;
  if (t) { CONFIG.closed = !!t.gesloten; CONFIG.closedText = t.geslotenTekst || ''; }
  const items = d.menu && d.menu[0] && d.menu[0].items;
  if (Array.isArray(items)) {
    const order = items.map((x) => x.id);
    MENU.forEach((m) => {
      const x = items.find((y) => y.id === m.id);
      if (!x) return;
      if (x.naam) m.name = x.naam;
      if ('omschrijving' in x) m.desc = x.omschrijving || '';
      if ('label' in x) m.tag = x.label || '';
      m.soldOut = !!x.uitverkocht; m.hidden = !!x.verborgen;
    });
    MENU.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  }
  for (const k of Object.keys(cart)) { const m = MENU.find((x) => x.id === k); if (!m || m.hidden || m.soldOut) delete cart[k]; }
  store.set('jt_cart', cart);
  const short = (n) => eur(n).replace(',00', '');
  $$('[data-fs-p1]').forEach((e) => { e.textContent = short(CONFIG.priceSingle); });
  $$('[data-fs-p3]').forEach((e) => { e.textContent = short(CONFIG.priceTrio); });
  $$('[data-fs-feest]').forEach((e) => { e.textContent = CONFIG.bulkThreshold; });
  if (c.gebied) $$('[data-fs-gebied]').forEach((e) => { e.textContent = c.gebied; });
  $$('[data-fs-ig]').forEach((e) => { e.href = `https://www.instagram.com/${CONFIG.instagram}/`; e.textContent = `@${CONFIG.instagram} op Instagram`; });
  renderMenu(); setupDate(); render();
}
document.addEventListener('fs:inhoud', (e) => applyInhoud(e.detail || {}));

(function init() {
  renderMenu();
  setupDate();
  const c = store.get('jt_customer', null);
  if (c) { const f = $('[data-form]'); f.elements.name.value = c.name || ''; f.elements.phone.value = c.phone || ''; f.elements.email.value = c.email || ''; }
  render();
  if (window.FS_INHOUD) applyInhoud(window.FS_INHOUD);
})();

/* ---------- intro ---------- */
(function intro() {
  const root = document.documentElement;
  const el = document.getElementById('intro');
  if (!el || !root.classList.contains('intro-on')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phases = ['s1', 's2', 's3', 's4'];
  let timers = [], shown = false, gone = false;
  const rest = [document.querySelector('.topbar'), document.querySelector('main'), document.querySelector('.footer')];
  rest.forEach((n) => { if (n) n.inert = true; });

  function finish() {           // spring naar het eindbeeld met de knoppen
    if (shown) return; shown = true;
    timers.forEach(clearTimeout);
    el.classList.add(...phases);
    const b = el.querySelector('[data-intro-go="menu"]');
    if (b) setTimeout(() => b.focus({ preventScroll: true }), reduce ? 0 : 500);
  }
  function remove(target) {
    el.remove();
    rest.forEach((n) => { if (n) n.inert = false; });
    root.classList.remove('intro-on');
    if (target === 'menu') document.getElementById('menu').scrollIntoView({ behavior: 'instant', block: 'start' });
    else scrollTo({ top: 0, behavior: 'instant' });
  }
  function leave(target) {
    if (gone) return; gone = true;
    finish();
    try { sessionStorage.setItem('jt_intro', '1'); } catch (e) { /* ignore */ }
    if (reduce) { remove(target); root.classList.remove('intro-leaving'); return; }
    root.classList.add('intro-leaving');
    setTimeout(() => remove(target), 820);          // scherm is nu helemaal bedekt
    setTimeout(() => { root.classList.remove('intro-leaving'); const p = document.getElementById('introPour'); if (p) p.remove(); }, 1800);
  }

  if (reduce) finish();
  else [[150, 's1'], [2300, 's2'], [3500, 's3'], [4300, 's4']].forEach(([t, c]) =>
    timers.push(setTimeout(() => { el.classList.add(c); if (c === 's4') finish(); }, t)));

  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-intro-go]');
    if (go) return leave(go.dataset.introGo);
    if (e.target.closest('[data-intro-skip]')) finish();
  });
  addEventListener('keydown', (e) => {
    if (gone) return;
    if (!shown && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); finish(); }
    else if (shown && e.key === 'Escape') leave('top');
  });
})();
