/* Flowsmid basis beheer voor losse websites.
   Instellingen per site staan in /beheer/site.js (window.FS_BEHEER). Inloggen met het Mijn Flowsmid-account van de zaak.
   De inhoud wordt bewaard in flowsmid.site_inhoud; de website leest hem via /fs-inhoud.js. */
(function () {
  'use strict';
  var C = window.FS_BEHEER;
  var SB_URL = 'https://uywydquzvdbpfjjrwsbt.supabase.co';
  var SB_KEY = 'sb_publishable_J1Ewyl4he9-KRj_jv8fIPA_S8vZ2v5_';
  var LOGIN_DOMEIN = 'login.flowsmid.nl';
  var DAGEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  var SECTIES = {
    overzicht: 'Overzicht', melding: 'Melding op de site', tijden: 'Openingstijden',
    menu: 'Menu', instellingen: 'Prijzen en bezorgen', contact: 'Contact'
  };
  var root = document.getElementById('app');
  if (!C || !window.supabase || !root) { if (root) root.textContent = 'Het beheer kon niet laden. Ververs de pagina.'; return; }
  var sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fs-beheer-' + C.slug }, db: { schema: 'flowsmid' }
  });
  document.title = 'Beheer · ' + C.naam;
  var staat = null, bewaard = '', bijgewerkt = null, gebruiker = null, huidig = 'overzicht', bezig = false;

  /* ---------- hulpjes ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'value') n.value = v;
      else if (k === 'checked') n.checked = !!v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  var teller = 0;
  function uid(p) { teller++; return (p || 'v') + '-' + Date.now().toString(36).slice(-4) + teller; }
  function euroTekst(n) { return n == null || n === '' || isNaN(n) ? '' : Number(n).toFixed(2).replace('.', ','); }
  function euroGetal(t) {
    t = String(t || '').trim().replace(/[€\s]/g, '').replace(',', '.');
    if (!t) return null;
    var n = Number(t); return isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : NaN;
  }
  function slugVan(t) { return String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'item'; }
  function datum(d) { try { return new Date(d).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function toast(t, fout) {
    var n = el('div', { class: 'toast' + (fout ? ' fout' : ''), role: 'status', text: t });
    document.body.appendChild(n); setTimeout(function () { n.remove(); }, fout ? 6000 : 3000);
  }
  function gewijzigd() { return staat && JSON.stringify(staat) !== bewaard; }
  function veld(label, invoer, hulp, id) {
    if (id) invoer.id = id;
    return el('div', { class: 'veld' }, [el('label', { for: invoer.id, text: label }), invoer, hulp ? el('div', { class: 'hulp', text: hulp }) : null]);
  }
  function schakel(label, aan, bij) {
    return el('label', { class: 'schakel' }, [el('input', { type: 'checkbox', checked: aan, onchange: function (e) { bij(e.target.checked); } }), el('span', { text: label })]);
  }
  function invoer(type, waarde, bij, extra) {
    var a = Object.assign({ type: type, value: waarde == null ? '' : waarde, oninput: function (e) { bij(e.target.value); markeer(); } }, extra || {});
    return el(type === 'textarea' ? 'textarea' : 'input', type === 'textarea' ? Object.assign(a, { type: null }) : a);
  }

  /* ---------- inhoud ---------- */
  function samenvoegen(std, opgeslagen) {
    var s = kopie(std || {});
    var o = opgeslagen || {};
    Object.keys(o).forEach(function (k) {
      if (k.charAt(0) === '_') return;
      if (k === 'menu') s[k] = o[k];
      else if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && s[k] && typeof s[k] === 'object') s[k] = Object.assign(s[k], o[k]);
      else s[k] = o[k];
    });
    s.melding = Object.assign({ aan: false, tekst: '' }, s.melding);
    s.tijden = Object.assign({ gesloten: false, geslotenTekst: '', dagen: [] }, s.tijden);
    for (var i = 0; i < 7; i++) s.tijden.dagen[i] = Object.assign({ open: true, van: '12:00', tot: '22:00' }, s.tijden.dagen[i]);
    s.menu = Array.isArray(s.menu) ? s.menu : [];
    s.instellingen = s.instellingen || {};
    s.contact = s.contact || {};
    return s;
  }

  /* ---------- inloggen ---------- */
  function loginScherm(melding) {
    var fout = el('div', { class: 'fout', role: 'alert', hidden: !melding, text: melding || '' });
    var naam = el('input', { type: 'text', id: 'lNaam', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    var ww = el('input', { type: 'password', id: 'lWw', autocomplete: 'current-password', required: true });
    var knop = el('button', { class: 'btn btn-hoofd', type: 'submit', text: 'Inloggen' });
    var form = el('form', { class: 'login-kaart', novalidate: true }, [
      el('div', { class: 'merk' }, [el('i', { 'aria-hidden': 'true' }), 'Flowsmid beheer']),
      el('h1', { text: C.naam }),
      el('p', { text: 'Log in met je Mijn Flowsmid-account om je website bij te werken.' }),
      fout,
      veld('Gebruikersnaam', naam),
      veld('Wachtwoord', ww),
      knop,
      el('p', { class: 'hulp' }, [el('a', { href: C.site || '/', text: '← Terug naar de website' })])
    ]);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var n = naam.value.trim().toLowerCase();
      if (!n || !ww.value) { fout.textContent = 'Vul je gebruikersnaam en wachtwoord in.'; fout.hidden = false; return; }
      knop.disabled = true; knop.textContent = 'Bezig…'; fout.hidden = true;
      var r = await sb.auth.signInWithPassword({ email: n.indexOf('@') > 0 ? n : n + '@' + LOGIN_DOMEIN, password: ww.value });
      if (r.error) {
        knop.disabled = false; knop.textContent = 'Inloggen';
        fout.textContent = /invalid/i.test(r.error.message) ? 'Gebruikersnaam of wachtwoord klopt niet.' : 'Inloggen lukte niet: ' + r.error.message;
        fout.hidden = false; return;
      }
      start();
    });
    root.replaceChildren(el('main', { class: 'login' }, form));
    naam.focus();
  }

  async function uitloggen() {
    if (gewijzigd() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Toch uitloggen?')) return;
    await sb.auth.signOut(); staat = null; bewaard = ''; loginScherm();
  }

  /* ---------- laden en opslaan ---------- */
  async function start() {
    var s = await sb.auth.getSession();
    if (!s.data.session) return loginScherm();
    gebruiker = s.data.session.user;
    root.replaceChildren(el('main', { class: 'login' }, el('p', { text: 'Laden…' })));
    var r = await sb.from('site_inhoud').select('inhoud, bijgewerkt_op').eq('slug', C.slug).maybeSingle();
    if (r.error || !r.data) {
      await sb.auth.signOut();
      return loginScherm(r.error ? 'Laden lukte niet: ' + r.error.message : 'Dit account hoort niet bij ' + C.naam + '. Log in met het account van deze zaak.');
    }
    staat = samenvoegen(C.standaard, r.data.inhoud);
    bewaard = JSON.stringify(staat);
    bijgewerkt = Object.keys(r.data.inhoud || {}).length ? r.data.bijgewerkt_op : null;
    tekenApp();
  }

  function controleer() {
    var f = [];
    (staat.menu || []).forEach(function (c) {
      (c.items || []).forEach(function (i) {
        if (!String(i.naam || '').trim()) f.push('Er is een item zonder naam' + (c.naam ? ' bij ' + c.naam : '') + '.');
        if (i.prijs !== null && i.prijs !== undefined && isNaN(i.prijs)) f.push('De prijs van ' + (i.naam || 'een item') + ' is geen bedrag.');
      });
    });
    (C.instellingen || []).forEach(function (d) {
      var v = staat.instellingen[d.sleutel];
      if (d.soort === 'euro' && v !== null && v !== undefined && isNaN(v)) f.push(d.label + ' is geen bedrag.');
      if (d.verplicht && (v === null || v === undefined || v === '')) f.push(d.label + ' is verplicht.');
    });
    staat.tijden.dagen.forEach(function (d, i) {
      if (d.open && (!d.van || !d.tot || d.van >= d.tot)) f.push(DAGEN[i] + ': de sluitingstijd moet na de openingstijd liggen.');
    });
    if (staat.melding.aan && !String(staat.melding.tekst || '').trim()) f.push('De melding staat aan maar heeft geen tekst.');
    return f;
  }

  async function opslaan() {
    if (bezig || !gewijzigd()) return;
    var f = controleer();
    if (f.length) { toast(f[0], true); return; }
    bezig = true; markeer();
    var r = await sb.from('site_inhoud').update({ inhoud: staat }).eq('slug', C.slug).select('bijgewerkt_op').maybeSingle();
    bezig = false;
    if (r.error || !r.data) { markeer(); toast('Opslaan lukte niet' + (r.error ? ': ' + r.error.message : '. Log opnieuw in.'), true); return; }
    bewaard = JSON.stringify(staat); bijgewerkt = r.data.bijgewerkt_op;
    markeer(); toast('Opgeslagen. Je website toont de wijziging meteen.');
    if (huidig === 'overzicht') toon('overzicht');
  }

  function terugzetten() {
    if (!confirm('Alle wijzigingen sinds de laatste keer opslaan weggooien?')) return;
    staat = JSON.parse(bewaard); toon(huidig); markeer();
  }

  /* ---------- app ---------- */
  var balkTekst, balkOpslaan, balkTerug, hoofd, navKnoppen = {};
  function markeer() {
    if (!balkOpslaan) return;
    var g = gewijzigd();
    balkOpslaan.disabled = !g || bezig;
    balkOpslaan.textContent = bezig ? 'Opslaan…' : 'Opslaan';
    balkTerug.hidden = !g || bezig;
    balkTekst.textContent = g ? 'Niet opgeslagen wijzigingen' : (bijgewerkt ? 'Alles opgeslagen · ' + datum(bijgewerkt) : 'Alles opgeslagen');
  }

  function tekenApp() {
    var secties = C.secties || Object.keys(SECTIES);
    var nav = el('nav', { class: 'nav', 'aria-label': 'Beheer' }, secties.map(function (k) {
      navKnoppen[k] = el('button', { type: 'button', text: (C.titels && C.titels[k]) || SECTIES[k], onclick: function () { toon(k); } });
      return navKnoppen[k];
    }));
    hoofd = el('section', { class: 'hoofd', 'aria-live': 'polite' });
    balkTekst = el('span'); balkTerug = el('button', { class: 'btn', type: 'button', text: 'Ongedaan maken', onclick: terugzetten });
    balkOpslaan = el('button', { class: 'btn btn-hoofd', type: 'button', text: 'Opslaan', onclick: opslaan });
    root.replaceChildren(el('div', { class: 'app' }, [
      el('aside', { class: 'zij' }, [
        el('div', { class: 'merk' }, [el('i', { 'aria-hidden': 'true' }), 'Flowsmid']),
        el('div', { class: 'zaak' }, [C.naam, el('small', { text: 'Beheer van je website' })]),
        nav,
        el('div', { class: 'zij-voet' }, [
          el('a', { class: 'btn btn-klein site-link', href: C.site || '/', target: '_blank', rel: 'noopener', text: 'Bekijk website ↗' }),
          el('button', { class: 'btn btn-klein', type: 'button', text: 'Uitloggen', onclick: uitloggen }),
          el('div', { class: 'wie', text: String(gebruiker.email || '').replace('@' + LOGIN_DOMEIN, '') })
        ])
      ]),
      hoofd,
      el('div', { class: 'balk' }, [balkTekst, balkTerug, balkOpslaan])
    ]));
    var h = (location.hash || '').slice(1);
    toon(secties.indexOf(h) >= 0 ? h : secties[0]);
    markeer();
  }

  function toon(k) {
    huidig = k;
    Object.keys(navKnoppen).forEach(function (n) { if (n === k) navKnoppen[n].setAttribute('aria-current', 'page'); else navKnoppen[n].removeAttribute('aria-current'); });
    try { history.replaceState(null, '', '#' + k); } catch (e) { /* ignore */ }
    hoofd.replaceChildren.apply(hoofd, (WEERGAVE[k] || WEERGAVE.overzicht)());
    hoofd.focus && window.scrollTo(0, 0);
  }

  function kop(titel, uitleg) { return el('div', { class: 'kop' }, [el('div', {}, [el('h1', { text: titel }), uitleg ? el('p', { text: uitleg }) : null])]); }

  var WEERGAVE = {
    overzicht: function () {
      var t = staat.tijden, vandaag = (new Date().getDay() + 6) % 7, d = t.dagen[vandaag];
      var items = 0, uit = 0;
      staat.menu.forEach(function (c) { (c.items || []).forEach(function (i) { if (!i.verborgen) items++; if (i.uitverkocht) uit++; }); });
      var heeft = function (s) { return (C.secties || []).indexOf(s) >= 0; };
      var ww1 = el('input', { type: 'password', id: 'nWw1', autocomplete: 'new-password', minlength: 8 });
      var ww2 = el('input', { type: 'password', id: 'nWw2', autocomplete: 'new-password', minlength: 8 });
      var wwKnop = el('button', { class: 'btn', type: 'submit', text: 'Wachtwoord wijzigen' });
      var wwForm = el('form', { class: 'kaart', novalidate: true }, [
        el('h2', { text: 'Wachtwoord' }),
        el('p', { class: 'hulp', text: 'Dit is hetzelfde wachtwoord als voor Mijn Flowsmid.' }),
        el('div', { class: 'rij' }, [veld('Nieuw wachtwoord', ww1, 'Minimaal 8 tekens.'), veld('Herhaal nieuw wachtwoord', ww2)]),
        el('div', {}, wwKnop)
      ]);
      wwForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (ww1.value.length < 8) return toast('Kies een wachtwoord van minimaal 8 tekens.', true);
        if (ww1.value !== ww2.value) return toast('De twee wachtwoorden zijn niet gelijk.', true);
        wwKnop.disabled = true;
        var r = await sb.auth.updateUser({ password: ww1.value });
        wwKnop.disabled = false;
        if (r.error) return toast('Wijzigen lukte niet: ' + r.error.message, true);
        ww1.value = ww2.value = ''; toast('Je wachtwoord is gewijzigd.');
      });
      return [
        kop('Welkom terug', 'Hier pas je de belangrijkste dingen op je website zelf aan. Klik op Opslaan en het staat meteen online.'),
        el('div', { class: 'kaart' }, [
          el('div', { class: 'rij' }, [
            heeft('tijden') ? el('div', { class: 'stat' }, [
              el('span', { text: 'Vandaag' }),
              t.gesloten ? el('b', {}, el('span', { class: 'pil rood', text: 'Tijdelijk gesloten' }))
                : el('b', { text: d.open ? d.van + ' – ' + d.tot : 'Gesloten' })
            ]) : null,
            heeft('menu') ? el('div', { class: 'stat' }, [el('span', { text: 'Op het menu' }), el('b', { text: items + (uit ? ' · ' + uit + ' uitverkocht' : '') })]) : null,
            heeft('melding') ? el('div', { class: 'stat' }, [el('span', { text: 'Melding op de site' }), el('b', {}, el('span', { class: 'pil ' + (staat.melding.aan ? 'geel' : ''), text: staat.melding.aan ? 'Staat aan' : 'Uit' }))]) : null,
            el('div', { class: 'stat' }, [el('span', { text: 'Laatst opgeslagen' }), el('b', { text: bijgewerkt ? datum(bijgewerkt) : 'Nog niet' })])
          ])
        ]),
        el('div', { class: 'kaart' }, [
          el('h2', { text: 'Snel naar' }),
          el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' }, (C.secties || []).filter(function (s) { return s !== 'overzicht'; }).map(function (s) {
            return el('button', { class: 'btn', type: 'button', text: (C.titels && C.titels[s]) || SECTIES[s], onclick: function () { toon(s); } });
          }).concat([el('a', { class: 'btn', href: C.site || '/', target: '_blank', rel: 'noopener', text: 'Bekijk website ↗' })]))
        ]),
        wwForm
      ];
    },

    melding: function () {
      var m = staat.melding;
      return [
        kop((C.titels && C.titels.melding) || SECTIES.melding, 'Een korte balk bovenaan je website, bijvoorbeeld voor vakantie, een actie of een nieuw product.'),
        el('div', { class: 'kaart' }, [
          schakel('Melding tonen op de website', m.aan, function (v) { m.aan = v; markeer(); }),
          veld('Tekst', invoer('textarea', m.tekst, function (v) { m.tekst = v; }, { maxlength: 220, rows: 3, placeholder: 'Bijv. Van 24 t/m 28 december zijn we gesloten. Fijne feestdagen!' }), 'Maximaal 220 tekens.', 'mTekst'),
          veld('Link (optioneel)', invoer('url', m.link, function (v) { m.link = v.trim(); }, { placeholder: 'https://… of #menu', maxlength: 300 }), 'Waar de melding naartoe gaat als iemand erop tikt.', 'mLink')
        ])
      ];
    },

    tijden: function () {
      var t = staat.tijden;
      var tijdRij = function (d, i) {
        var van = invoer('time', d.van, function (v) { d.van = v; }, { 'aria-label': DAGEN[i] + ' vanaf', disabled: !d.open, step: 900 });
        var tot = invoer('time', d.tot, function (v) { d.tot = v; }, { 'aria-label': DAGEN[i] + ' tot', disabled: !d.open, step: 900 });
        return el('div', { class: 'dag' }, [
          el('b', { text: DAGEN[i] }),
          schakel(d.open ? 'Open' : 'Gesloten', d.open, function (v) { d.open = v; markeer(); toon('tijden'); }),
          el('div', { class: 'tijden' }, [van, el('span', { text: 'tot' }), tot])
        ]);
      };
      return [
        kop((C.titels && C.titels.tijden) || SECTIES.tijden, (C.tijden && C.tijden.uitleg) || 'Wanneer je open bent. Je website gebruikt deze tijden.'),
        el('div', { class: 'kaart' }, [el('div', { class: 'dagen' }, t.dagen.map(tijdRij))]),
        el('div', { class: 'kaart' }, [
          el('h2', { text: 'Tijdelijk gesloten' }),
          schakel('Tijdelijk gesloten (bijv. vakantie)', t.gesloten, function (v) { t.gesloten = v; markeer(); }),
          veld('Wat zie je op de website?', invoer('text', t.geslotenTekst, function (v) { t.geslotenTekst = v; }, { maxlength: 160, placeholder: 'Bijv. We zijn op vakantie tot 6 januari.' }), (C.tijden && C.tijden.geslotenHulp) || null, 'tGesloten')
        ])
      ];
    },

    menu: function () {
      var M = C.menu || {};
      var kaarten = staat.menu.map(function (c, ci) {
        var kopRij = M.categorieen
          ? el('div', { class: 'cat-kop' }, [invoer('text', c.naam, function (v) { c.naam = v; }, { 'aria-label': 'Naam categorie', maxlength: 40 })])
          : (staat.menu.length > 1 || c.naam ? el('div', { class: 'cat-kop' }, [el('b', { text: c.naam || 'Menu' })]) : null);
        var items = (c.items || []).map(function (it, ii) {
          var prijs = invoer('text', euroTekst(it.prijs), function (v) { it.prijs = euroGetal(v); }, { inputmode: 'decimal', placeholder: M.prijsLeeg || 'Leeg = geen prijs', maxlength: 9 });
          return el('div', { class: 'item' + (it.uitverkocht || it.verborgen ? ' uit' : '') }, [
            veld('Naam', invoer('text', it.naam, function (v) { it.naam = v; }, { maxlength: 60 }), null, 'n' + ci + '-' + ii),
            M.prijs === false ? el('div') : veld('Prijs (€)', prijs, null, 'p' + ci + '-' + ii),
            M.omschrijving === false ? null : el('div', { class: 'breed' }, veld('Omschrijving', invoer('textarea', it.omschrijving, function (v) { it.omschrijving = v; }, { maxlength: 240, rows: 2 }), null, 'o' + ci + '-' + ii)),
            M.label ? el('div', { class: 'breed' }, veld('Label (optioneel)', invoer('text', it.label, function (v) { it.label = v; }, { maxlength: 20, placeholder: 'Bijv. Nieuw of Favoriet' }), null, 'l' + ci + '-' + ii)) : null,
            el('div', { class: 'item-acties' }, [
              schakel('Uitverkocht', it.uitverkocht, function (v) { it.uitverkocht = v; markeer(); toon('menu'); }),
              schakel('Verbergen', it.verborgen, function (v) { it.verborgen = v; markeer(); toon('menu'); }),
              el('div', { class: 'rechts' }, [
                ii > 0 ? el('button', { class: 'btn btn-klein', type: 'button', 'aria-label': 'Omhoog', title: 'Omhoog', text: '↑', onclick: function () { c.items.splice(ii - 1, 0, c.items.splice(ii, 1)[0]); markeer(); toon('menu'); } }) : null,
                ii < c.items.length - 1 ? el('button', { class: 'btn btn-klein', type: 'button', 'aria-label': 'Omlaag', title: 'Omlaag', text: '↓', onclick: function () { c.items.splice(ii + 1, 0, c.items.splice(ii, 1)[0]); markeer(); toon('menu'); } }) : null,
                M.toevoegen && it.eigen ? el('button', { class: 'btn btn-klein btn-gevaar', type: 'button', text: 'Verwijderen', onclick: function () { if (confirm((it.naam || 'Dit item') + ' verwijderen?')) { c.items.splice(ii, 1); markeer(); toon('menu'); } } }) : null
              ])
            ])
          ]);
        });
        var voet = M.toevoegen ? el('div', { class: 'cat-voet' }, el('button', { class: 'btn btn-klein', type: 'button', text: '+ Item toevoegen' + (c.naam ? ' aan ' + c.naam : ''), onclick: function () {
          c.items = c.items || []; c.items.push({ id: slugVan(c.naam || 'item') + '-' + uid('n'), naam: '', omschrijving: '', prijs: null, eigen: true }); markeer(); toon('menu');
          var ns = hoofd.querySelectorAll('#n' + ci + '-' + (c.items.length - 1)); if (ns[0]) ns[0].focus();
        } })) : null;
        return el('div', { class: 'cat' }, [kopRij].concat(items, [voet]));
      });
      return [kop((C.titels && C.titels.menu) || SECTIES.menu, M.uitleg || 'Pas namen, omschrijvingen en prijzen aan. Uitverkocht = zichtbaar maar niet te bestellen; verbergen = tijdelijk van de site.'),
        el('div', { class: 'kaart' }, kaarten)];
    },

    instellingen: function () {
      var velden = (C.instellingen || []).map(function (d) {
        var v = staat.instellingen[d.sleutel];
        var inp = d.soort === 'euro'
          ? invoer('text', euroTekst(v), function (x) { staat.instellingen[d.sleutel] = euroGetal(x); }, { inputmode: 'decimal', placeholder: d.leeg || '', maxlength: 9 })
          : d.soort === 'getal'
            ? invoer('number', v, function (x) { staat.instellingen[d.sleutel] = x === '' ? null : Number(x); }, { min: d.min, max: d.max, step: d.stap || 1 })
            : invoer('text', v, function (x) { staat.instellingen[d.sleutel] = x; }, { maxlength: 120 });
        return veld(d.label + (d.soort === 'euro' ? ' (€)' : ''), inp, d.hulp, 'i-' + d.sleutel);
      });
      return [kop((C.titels && C.titels.instellingen) || SECTIES.instellingen, C.instellingenUitleg || null), el('div', { class: 'kaart' }, [el('div', { class: 'rij' }, velden)])];
    },

    contact: function () {
      var velden = (C.contact || []).map(function (d) {
        return veld(d.label, invoer(d.soort || 'text', staat.contact[d.sleutel], function (x) { staat.contact[d.sleutel] = x.trim(); }, { maxlength: 160, placeholder: d.voorbeeld || '', inputmode: d.soort === 'tel' ? 'tel' : null }), d.hulp, 'c-' + d.sleutel);
      });
      return [kop((C.titels && C.titels.contact) || SECTIES.contact, 'Deze gegevens staan op je website. Laat een veld leeg om het te verbergen, waar dat kan.'), el('div', { class: 'kaart' }, [el('div', { class: 'rij' }, velden)])];
    }
  };

  window.addEventListener('beforeunload', function (e) { if (gewijzigd()) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 's' && staat) { e.preventDefault(); opslaan(); } });
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && staat) { staat = null; loginScherm('Je bent uitgelogd. Log opnieuw in.'); } });
  start().catch(function (e) { loginScherm('Er ging iets mis: ' + (e && e.message || e)); });
})();
