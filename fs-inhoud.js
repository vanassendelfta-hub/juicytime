/* Flowsmid: haalt de inhoud op die de zaak in /beheer heeft ingesteld en past de algemene delen toe.
   Zet vóór dit script: window.FS_SITE = { slug: 'naam', melding: { achtergrond, kleur } }.
   De site zelf luistert naar het event 'fs:inhoud' (detail = inhoud) voor menu, prijzen, tijden en contact.
   Zonder verbinding blijft de site gewoon zoals hij in de HTML staat. */
(function () {
  'use strict';
  var C = window.FS_SITE;
  if (!C || !C.slug) return;
  var URL = 'https://uywydquzvdbpfjjrwsbt.supabase.co/rest/v1/rpc/site_inhoud_publiek';
  var KEY = 'sb_publishable_J1Ewyl4he9-KRj_jv8fIPA_S8vZ2v5_';
  var CACHE = 'fs_inhoud_' + C.slug;

  function klaar(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function melding(d) {
    var m = d && d.melding, oud = document.getElementById('fsMelding');
    if (oud) oud.remove();
    if (!m || !m.aan || !String(m.tekst || '').trim()) return;
    var s = C.melding || {};
    var link = /^(https?:\/\/|#|\/)/.test(m.link || '') ? m.link : null;
    var n = document.createElement(link ? 'a' : 'div');
    n.id = 'fsMelding'; n.setAttribute('role', 'status'); n.textContent = String(m.tekst).trim();
    if (link) { n.href = link; if (/^https?:/.test(link)) { n.target = '_blank'; n.rel = 'noopener'; } }
    n.style.cssText = 'display:block;position:relative;z-index:60;padding:10px 16px;text-align:center;font:600 15px/1.4 ' + (s.font || 'inherit') +
      ';background:' + (s.achtergrond || '#13111C') + ';color:' + (s.kleur || '#fff') + ';text-decoration:none;' + (s.extra || '');
    document.body.insertBefore(n, document.body.firstChild);
  }

  function toepassen(d) {
    window.FS_INHOUD = d;
    klaar(function () {
      melding(d);
      try { document.dispatchEvent(new CustomEvent('fs:inhoud', { detail: d })); } catch (e) { /* oude browser */ }
    });
  }

  /* Eerst de laatst bekende inhoud (snel), daarna de actuele. */
  try { var c = sessionStorage.getItem(CACHE); if (c) toepassen(JSON.parse(c)); } catch (e) { /* ignore */ }
  fetch(URL, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: KEY, 'Content-Type': 'application/json', 'Content-Profile': 'flowsmid', Accept: 'application/json' },
    body: JSON.stringify({ p_slug: C.slug })
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    var t = JSON.stringify(d);
    try { if (sessionStorage.getItem(CACHE) === t) return; sessionStorage.setItem(CACHE, t); } catch (e) { /* ignore */ }
    toepassen(d);
  }).catch(function () { /* site blijft zoals hij is */ });
})();
