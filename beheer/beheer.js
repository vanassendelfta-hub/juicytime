/* Juicy Time beheer: bestellingen bekijken en verwerken. Toegang wordt in de database afgedwongen (alleen je eigen bestellingen). */
(function () {
  'use strict';
  var SLUG = 'juicytime';
  var $ = function (id) { return document.getElementById(id); };
  var sb = window.supabase && window.supabase.createClient('https://uywydquzvdbpfjjrwsbt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d3lkcXV6dmRicGZqanJ3c2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMTI5NDEsImV4cCI6MjEwNjg4ODk0MX0.4C76JwtfcRx3d39kvU23NRpKPKt_A5FkmdUpoqDbf5M', {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'jt-beheer' }, db: { schema: 'flowsmid' }
  });
  /* Alle gegevens lopen via dit object, zodat de pagina ook met voorbeelddata kan draaien. */
  var api = window.BS_API || {
    sessie: async function () { var r = await sb.auth.getSession(); return !!r.data.session; },
    inloggen: async function (u, p) { var r = await sb.auth.signInWithPassword({ email: u, password: p }); return r.error ? r.error.message : null; },
    uitloggen: function () { return sb.auth.signOut(); },
    instellingen: async function () { var r = await sb.from('bs_instellingen').select('*').eq('slug', SLUG).maybeSingle(); if (r.error) throw r.error; return r.data; },
    bestellingen: async function () { var r = await sb.from('bs_bestellingen').select('*').order('aangemaakt_op', { ascending: false }).limit(200); if (r.error) throw r.error; return r.data || []; },
    wijzig: async function (id, velden) { var r = await sb.from('bs_bestellingen').update(velden).eq('id', id); if (r.error) throw r.error; },
    bewaarMail: async function (klant, email, aan) { var r = await sb.from('bs_instellingen').update({ melding_email: email || null, mail_actief: aan }).eq('klant_id', klant); if (r.error) throw r.error; }
  };
  var VOLGENDE = { 'Nieuw': ['Bevestigd', 'Bevestigen'], 'Bevestigd': ['Klaar', 'Klaar zetten'], 'Klaar': ['Afgerond', null] };
  var inst = null, lijst = [], filter = 'open', gezien = {}, eerste = true, klok = null;

  function el(tag, attrs, kinderen) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    });
    (kinderen || []).forEach(function (c) { if (c === null || c === undefined || c === false) return; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var tt;
  function toast(t, fout) { var n = $('toast'); n.textContent = t; n.className = 'toast' + (fout ? ' f' : ''); n.hidden = false; clearTimeout(tt); tt = setTimeout(function () { n.hidden = true; }, 3600); }
  function eur(n) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0); }
  function vandaag() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dag(iso) {
    if (iso === vandaag()) return 'Vandaag';
    var d = new Date(iso + 'T12:00:00'), m = new Date(); m.setDate(m.getDate() + 1);
    if (d.toDateString() === m.toDateString()) return 'Morgen';
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function isOpen(b) { return b.status === 'Nieuw' || b.status === 'Bevestigd' || b.status === 'Klaar'; }
  function wa(tel) { var t = String(tel).replace(/[^0-9+]/g, ''); if (t.indexOf('+') === 0) t = t.slice(1); else if (t.indexOf('00') === 0) t = t.slice(2); else if (t.indexOf('0') === 0) t = '31' + t.slice(1); return 'https://wa.me/' + t; }

  function toon(ingelogd) { $('login').hidden = ingelogd; $('app').hidden = !ingelogd; $('uit').hidden = !ingelogd; }

  function kaart(b) {
    var v = VOLGENDE[b.status], nieuw = b.status === 'Nieuw';
    var knop = v ? el('button', { class: 'btn btn-p', type: 'button', onclick: function () { zetStatus(b, v[0], knop); } }, [v[1] || (b.methode === 'bezorgen' ? 'Bezorgd' : 'Opgehaald')]) : null;
    return el('article', { class: 'kaart best' + (nieuw ? ' nieuw' : '') }, [
      el('div', { class: 'bk' }, [el('div', null, [el('b', { text: b.naam }), el('small', { text: b.nummer })]), el('span', { class: 'pil ' + b.status, text: b.status })]),
      el('div', { class: 'wanneer' }, [b.methode === 'bezorgen' ? 'Bezorgen' : 'Ophalen', el('span', { text: dag(b.datum) + ' om ' + b.tijd })]),
      el('ul', { class: 'regels' }, (b.regels || []).map(function (r) { return el('li', null, [el('b', { text: r.aantal + '×' }), r.naam]); })),
      el('div', { class: 'totaal' }, [el('span', { text: b.aantal + (b.aantal === 1 ? ' cocktail' : ' cocktails') + (Number(b.korting) > 0 ? ' · korting ' + eur(b.korting) : '') }), el('span', { text: eur(b.totaal) })]),
      b.op_maat ? el('p', { class: 'extra' }, [el('b', { text: 'Feestbestelling: ' }), 'spreek zelf een prijs op maat af.']) : null,
      b.adres ? el('p', { class: 'extra' }, [el('b', { text: 'Adres: ' }), b.adres]) : null,
      b.opmerking ? el('p', { class: 'extra' }, [el('b', { text: 'Opmerking: ' }), b.opmerking]) : null,
      el('div', { class: 'acties' }, [
        knop,
        el('a', { class: 'btn btn-g btn-k', href: 'tel:' + String(b.telefoon).replace(/[^0-9+]/g, '') }, ['Bel']),
        el('a', { class: 'btn btn-g btn-k', href: wa(b.telefoon), target: '_blank', rel: 'noopener' }, ['WhatsApp']),
        isOpen(b) ? el('button', { class: 'btn btn-t', type: 'button', onclick: function () { if (window.confirm('Bestelling van ' + b.naam + ' annuleren?')) zetStatus(b, 'Geannuleerd'); } }, ['Annuleren']) : null
      ])
    ]);
  }
  function teken() {
    var nu = vandaag();
    $('tNieuw').textContent = lijst.filter(function (b) { return b.status === 'Nieuw'; }).length;
    $('tVandaag').textContent = lijst.filter(function (b) { return b.datum === nu && isOpen(b); }).length;
    $('tOpen').textContent = lijst.filter(isOpen).length;
    var toon = lijst.filter(function (b) { return filter === 'alles' ? true : filter === 'vandaag' ? b.datum === nu && b.status !== 'Geannuleerd' : isOpen(b); });
    if (filter !== 'alles') toon.sort(function (a, b) { return (a.datum + a.tijd).localeCompare(b.datum + b.tijd); });
    var doel = $('lijst');
    if (!toon.length) doel.replaceChildren(el('div', { class: 'leeg' }, [el('b', { text: filter === 'alles' ? 'Nog geen bestellingen' : 'Niets te doen' }), filter === 'alles' ? 'Zodra iemand bestelt, zie je het hier.' : 'Nieuwe bestellingen verschijnen hier vanzelf.']));
    else doel.replaceChildren.apply(doel, toon.map(kaart));
    $('bij').textContent = 'Bijgewerkt om ' + new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) + '. Dit scherm ververst zichzelf.';
  }
  async function laad(stil) {
    try {
      var nieuw = await api.bestellingen(), erbij = 0;
      nieuw.forEach(function (b) { if (!gezien[b.id]) { gezien[b.id] = 1; if (!eerste && b.status === 'Nieuw') erbij++; } });
      lijst = nieuw; eerste = false; teken();
      if (erbij) toast(erbij === 1 ? 'Nieuwe bestelling binnen!' : erbij + ' nieuwe bestellingen binnen!');
    } catch (e) { if (!stil) toast('Laden lukte niet. Controleer je internet.', true); }
  }
  async function zetStatus(b, status, knop) {
    if (knop) knop.disabled = true;
    try { await api.wijzig(b.id, { status: status }); b.status = status; teken(); toast(b.naam + ': ' + status.toLowerCase()); }
    catch (e) { if (knop) knop.disabled = false; toast('Opslaan lukte niet: ' + (e.message || e), true); }
  }
  async function start() {
    try { inst = await api.instellingen(); } catch (e) { inst = null; }
    if (!inst) { await api.uitloggen(); toon(false); $('lfout').textContent = 'Dit account hoort niet bij deze bestelsite.'; $('lfout').hidden = false; return; }
    toon(true);
    $('mEmail').value = inst.melding_email || ''; $('mAan').checked = !!inst.mail_actief;
    await laad();
    clearInterval(klok); klok = setInterval(function () { if (!document.hidden) laad(true); }, 30000);
  }

  $('lform').addEventListener('submit', async function (e) {
    e.preventDefault();
    var u = $('lu').value.toLowerCase().replace(/\s+/g, ''), p = $('lp').value, f = $('lfout'), k = $('lknop');
    if (!u || !p) { f.textContent = 'Vul je gebruikersnaam en wachtwoord in.'; f.hidden = false; return; }
    if (u.indexOf('@') < 0) u += '@login.flowsmid.nl';
    k.disabled = true; f.hidden = true;
    var fout = await api.inloggen(u, p);
    k.disabled = false;
    if (fout) { f.textContent = /invalid login/i.test(fout) ? 'Gebruikersnaam of wachtwoord klopt niet. Let op hoofdletters in het wachtwoord.' : 'Inloggen lukte niet: ' + fout; f.hidden = false; return; }
    $('lp').value = ''; start();
  });
  $('toon').addEventListener('click', function () { var i = $('lp'), aan = i.type === 'password'; i.type = aan ? 'text' : 'password'; this.textContent = aan ? 'Verberg' : 'Toon'; });
  $('uit').addEventListener('click', async function () { clearInterval(klok); await api.uitloggen(); lijst = []; gezien = {}; eerste = true; toon(false); });
  document.querySelectorAll('.chip').forEach(function (c) { c.addEventListener('click', function () { filter = c.getAttribute('data-f'); document.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('aan', x === c); }); teken(); }); });
  $('mOpslaan').addEventListener('click', async function () {
    var email = $('mEmail').value.trim().toLowerCase(), aan = $('mAan').checked;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Dit e-mailadres klopt niet.', true);
    if (aan && !email) return toast('Vul eerst je e-mailadres in.', true);
    this.disabled = true;
    try { await api.bewaarMail(inst.klant_id, email, aan); inst.melding_email = email; inst.mail_actief = aan; toast(aan ? 'Je krijgt nu een mail bij elke bestelling' : 'Opgeslagen. Meldingen staan uit.'); }
    catch (e) { toast('Opslaan lukte niet: ' + (e.message || e), true); }
    this.disabled = false;
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && inst) laad(true); });
  api.sessie().then(function (ja) { if (ja) start(); else toon(false); });
})();
