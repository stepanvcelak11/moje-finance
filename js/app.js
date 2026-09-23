/* ---------------------------------------------------------------
   app.js – obrazovky, formuláře a obsluha
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var D = global.FData;
  var G = global.FGrafy;
  var esc = G.esc;

  var VERZE = '2.1';

  /* ---------- krátké pomůcky ---------- */

  function $(id) { return document.getElementById(id); }
  function vse(sel, korn) { return Array.prototype.slice.call((korn || document).querySelectorAll(sel)); }

  function naSlys(el, udalost, fn) { if (el) el.addEventListener(udalost, fn); }

  /* ---------- stav obrazovky ---------- */

  var pohled = 'prehled';
  var rok, mesic;
  var mesicVGrafu = 5;              // který sloupec se právě čte
  var filtr = { typ: 'vse', rozsah: 'mesic', text: '', kat: null, ucet: null };
  var katTypVEditoru = 'vydaj';
  var zaznam = null;                // rozpracovaný formulář

  /* ---------- čísla a měna ---------- */

  var formatCele = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
  var formatDesetinne = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function mena() { return (D.stav().nastaveni.mena || 'Kč'); }

  function cislo(c) {
    var n = Number(c) || 0;
    return (Math.abs(n % 1) > 0.004 ? formatDesetinne : formatCele).format(n);
  }

  function kc(c) { return cislo(c) + ' ' + mena(); }

  function kcZnak(c) {
    var n = Number(c) || 0;
    return (n > 0 ? '+' : (n < 0 ? '−' : '')) + cislo(Math.abs(n)) + ' ' + mena();
  }

  /** Přijme „1 234,50“ i drobný počet: „250+80“. */
  function parsujCastku(text) {
    var s = String(text || '').replace(/\s| /g, '').replace(/,/g, '.');
    if (!s) return NaN;
    if (/^[0-9.]+$/.test(s)) return Number(s);
    if (!/^[0-9.+\-*/()]+$/.test(s)) return NaN;
    try {
      var v = Function('"use strict";return (' + s + ')')();
      return (typeof v === 'number' && isFinite(v)) ? v : NaN;
    } catch (e) { return NaN; }
  }

  /* ---------- hlášky a dialogy ---------- */

  var casovacHlasky = null;

  /** Hláška dole; s `akce` = {popis, fn} přibude tlačítko (třeba „Zpět“). */
  function hlaska(text, akce) {
    var el = $('hlaska');
    el.textContent = '';
    var t = document.createElement('span');
    t.textContent = text;
    el.appendChild(t);
    if (akce) {
      var b = document.createElement('button');
      b.className = 'hlaska-zpet';
      b.textContent = akce.popis;
      b.addEventListener('click', function () {
        el.hidden = true;
        if (casovacHlasky) clearTimeout(casovacHlasky);
        akce.fn();
      });
      el.appendChild(b);
    }
    el.hidden = false;
    if (casovacHlasky) clearTimeout(casovacHlasky);
    casovacHlasky = setTimeout(function () { el.hidden = true; }, akce ? 6000 : 2200);
  }

  var dialogPotvrd = null;

  function dialog(volby) {
    $('dialog-titulek').textContent = volby.titulek || '';
    $('dialog-telo').innerHTML = volby.telo || '';
    $('dialog-ano').textContent = volby.ano || 'OK';
    $('dialog-ne').textContent = volby.ne || 'Zrušit';
    $('dialog-ano').className = 'tl ' + (volby.nebezpeci ? 'tl-nebezpeci' : 'tl-hlavni');
    $('dialog-ne').hidden = !!volby.bezZruseni;
    dialogPotvrd = volby.potvrd || null;
    $('prekryv-dialog').hidden = false;
    if (volby.zamer) setTimeout(function () {
      var p = $('dialog-telo').querySelector('input,select');
      if (p) { p.focus(); if (p.select) p.select(); }
    }, 60);
  }

  function zavriDialog() {
    $('prekryv-dialog').hidden = true;
    dialogPotvrd = null;
    vyberRok = null;
    vyberImport = null;
  }

  /* =================================================================
     PŘEPÍNÁNÍ OBRAZOVEK
     ================================================================= */

  var POHLEDY = ['prehled', 'historie', 'grafy', 'ucty', 'nastaveni'];

  function jdi(kam) {
    pohled = kam;
    POHLEDY.forEach(function (p) {
      $('pohled-' + p).hidden = (p !== kam);
    });
    vse('.nav-tl').forEach(function (b) {
      b.classList.toggle('nav-akt', b.getAttribute('data-jdi') === kam);
    });
    var sHlavickou = (kam === 'prehled' || kam === 'historie' || kam === 'grafy');
    $('hlavicka').classList.toggle('skryta', !sHlavickou);
    document.body.classList.toggle('bez-hlavicky', !sHlavickou);
    vykresli();
    global.scrollTo(0, 0);
  }

  function vykresli() {
    aktualizujHlavicku();
    if (pohled === 'prehled') vykresliPrehled();
    else if (pohled === 'historie') vykresliHistorii();
    else if (pohled === 'grafy') vykresliGrafy();
    else if (pohled === 'ucty') vykresliUcty();
    else if (pohled === 'nastaveni') vykresliNastaveni();
  }

  /** Doplní vektorové ikony do všech míst označených v HTML. */
  function doplnIkony(korn) {
    vse('[data-ikona]', korn).forEach(function (el) {
      if (!el.firstChild) el.innerHTML = ik(el.getAttribute('data-ikona'));
    });
  }

  function ik(klic, trida) { return global.FIkony.svg(klic, trida); }

  /** Ikona v barevném poli – používá se u kategorií, účtů i položek. */
  function ikonaVPoli(klic, barvaSlot, trida) {
    var b = G.barva(barvaSlot);
    return '<span class="' + (trida || '') + '" style="color:' + b +
      ';background:color-mix(in srgb,' + b + ' 18%, var(--surface-2))">' + ik(klic) + '</span>';
  }

  function aktualizujHlavicku() {
    $('mesic-nazev').textContent = D.MESICE[mesic] + ' ' + rok;
    var dnes = new Date();
    var budouci = (rok > dnes.getFullYear()) ||
      (rok === dnes.getFullYear() && mesic >= dnes.getMonth());
    $('mesic-vpred').style.opacity = budouci ? '.3' : '1';
  }

  function posunMesic(o) {
    var d = new Date(rok, mesic + o, 1);
    rok = d.getFullYear(); mesic = d.getMonth();
    mesicVGrafu = 5;
    vykresli();
  }

  /* =================================================================
     PŘEHLED
     ================================================================= */

  function vykresliPrehled() {
    var s = D.stav();
    var vMesici = D.vMesici(rok, mesic);
    var souhrn = D.souhrn(vMesici);
    var prazdno = s.transakce.length === 0;

    // úplný začátek: dvě cesty místo prázdných grafů
    $('karta-start').hidden = !prazdno;
    $('karta-hero').hidden = prazdno;
    $('karta-kategorie').hidden = prazdno;
    $('karta-pohyby').hidden = prazdno;

    // hlavní číslo: kolik odešlo tento měsíc
    var dnes = new Date();
    var jeAktualni = dnes.getFullYear() === rok && dnes.getMonth() === mesic;
    $('hero-popis').textContent = 'Utraceno ' + (jeAktualni ? 'tento měsíc' : 'v ' + D.MESICE_V[mesic].toLowerCase());
    $('hero-utraceno').textContent = kc(Math.round(souhrn.vydaje));
    $('hero-prijmy').innerHTML = souhrn.prijmy
      ? 'z příjmů <b>' + esc(kc(Math.round(souhrn.prijmy))) + '</b>'
      : 'příjem tento měsíc zatím nezapsaný';

    // srovnání s minulým měsícem (do stejného dne)
    var sr = D.srovnaniSMinulym(rok, mesic);
    var elSr = $('hero-srovnani');
    if (sr.podil !== null && sr.ted > 0 && Math.abs(sr.podil) >= 0.03) {
      var mene = sr.podil < 0;
      elSr.className = 'hero-srovnani ' + (mene ? 'lepsi' : 'horsi');
      elSr.innerHTML = (mene ? '↓ ' : '↑ ') + Math.round(Math.abs(sr.podil) * 100) + ' % ' +
        (mene ? 'méně' : 'víc') + ' než ' + (sr.doDne ? 'touhle dobou ' : '') + 'v ' +
        esc(D.MESICE_V[sr.mesic].toLowerCase());
      elSr.hidden = false;
    } else elSr.hidden = true;
    $('hero-zustatek').textContent = kc(D.celkovyZustatek());

    // dnes a tento týden
    var dnesS = D.souhrnDnes(), tydenS = D.souhrnTydne();
    $('hero-dnes').lastElementChild.textContent = kc(dnesS.vydaje);
    $('hero-tyden').lastElementChild.textContent = kc(tydenS.vydaje);

    // prstenec: kolik procent příjmů je pryč
    var podilUtraty = souhrn.prijmy > 0 ? souhrn.vydaje / souhrn.prijmy : (souhrn.vydaje > 0 ? 1 : 0);
    var procenta = Math.round(podilUtraty * 100);
    var barvaPrstence, stred, podStredem;
    if (!souhrn.prijmy && !souhrn.vydaje) {
      barvaPrstence = 'rgba(255,255,255,.5)'; stred = '—'; podStredem = 'zatím nic';
    } else if (!souhrn.prijmy) {
      barvaPrstence = '#ffb3b3'; stred = '—'; podStredem = 'bez příjmu';
    } else {
      barvaPrstence = podilUtraty >= 1 ? '#ffb3b3'
        : (podilUtraty >= 0.8 ? '#ffd27a' : '#ffffff');
      stred = procenta + ' %'; podStredem = 'z příjmů';
    }
    $('prstenec').innerHTML = G.prstenec(podilUtraty, barvaPrstence, stred, podStredem);

    var pod = '';
    if (souhrn.prijmy > 0 && souhrn.rozdil >= 0) {
      pod = 'Zbývá <b>' + esc(kc(Math.round(souhrn.rozdil))) + '</b>';
      var dni = pocetDniZbyva();
      if (dni > 0) pod += ' · ' + dni + ' ' + tvarDni(dni) + ' do konce měsíce, to je <b>' +
        esc(kc(Math.floor(souhrn.rozdil / dni))) + '</b> na den';
    } else if (souhrn.prijmy > 0) {
      pod = 'Výdaje jsou o <b>' + esc(kc(Math.round(-souhrn.rozdil))) + '</b> vyšší než příjmy.';
    }
    $('souhrn-rozdil-pod').innerHTML = pod;
    $('souhrn-rozdil-pod').hidden = !pod;

    vykresliRychle();
    vykresliPripominkuImportu();
    vykresliObchody(vMesici);
    vykresliPredplatne();

    // kategorie
    var kategorie = D.podleKategorii(vMesici, 'vydaj');
    var jsou = kategorie.length > 0;
    var trendy = jsou ? D.trendyKategorii(rok, mesic) : {};
    $('kategorie-prazdno').hidden = jsou;
    $('graf-podil').innerHTML = jsou ? G.pruhPodilu(kategorie, kc) : '';
    $('graf-kategorie').innerHTML = jsou ? G.seznamKategorii(kategorie, kc, trendy) : '';

    // rozpočty
    var rozpocty = D.stavRozpoctu(rok, mesic);
    $('karta-rozpocty').hidden = rozpocty.length === 0;
    $('seznam-rozpoctu').innerHTML = rozpocty.map(rozpocetHtml).join('');

    // poslední pohyby
    var posledni = D.serazene().filter(function (t) { return t.datum.slice(0, 7) === D.klicMesice(rok, mesic); }).slice(0, 5);
    if (!posledni.length) posledni = D.serazene().slice(0, 5);
    $('posledni-pohyby').innerHTML = posledni.length
      ? '<div class="skupina-karta">' + posledni.map(polozkaHtml).join('') + '</div>'
      : '<p class="prazdno">Zatím nic. Přidejte první záznam tlačítkem +.</p>';
  }

  /** Kde nejvíc utrácíte – obchody za vybraný měsíc. */
  function vykresliObchody(vMesici) {
    var obchody = D.podleObchodu(vMesici);
    var karta = $('karta-obchody');
    // má smysl až od pár pojmenovaných nákupů
    karta.hidden = obchody.length < 3;
    if (karta.hidden) return;
    var max = obchody[0].castka || 1;
    $('obchody-doplnek').textContent = obchody.length + ' ' + (obchody.length < 5 ? 'obchody' : 'obchodů');
    $('seznam-obchodu').innerHTML = obchody.slice(0, 5).map(function (o) {
      var b = G.barva(o.barva);
      return '<button class="kat-radek obchod-radek" data-obchod="' + esc(o.nazev) + '">' +
        '<span class="obchod-ikona" style="color:' + b + ';background:color-mix(in srgb,' + b +
          ' 16%, var(--surface-2))">' + ik(o.ikona) + '</span>' +
        '<span><span class="kat-jmeno">' + esc(o.nazev) + '</span>' +
          '<span class="kat-pruh"><span class="kat-vypln" style="width:' +
          (o.castka / max * 100).toFixed(1) + '%;background:' + b + '"></span></span></span>' +
        '<span><span class="kat-castka">' + esc(kc(Math.round(o.castka))) + '</span>' +
          '<span class="kat-procenta">' + o.pocet + '× nákup</span></span>' +
      '</button>';
    }).join('');
  }

  /** Pravidelně odchází – předplatné, nájem, inkasa poznaná z historie. */
  function vykresliPredplatne() {
    var seznam = D.pravidelnePlatby();
    var karta = $('karta-predplatne');
    karta.hidden = seznam.length === 0;
    if (karta.hidden) return;
    var soucet = seznam.reduce(function (a, p) { return a + p.castka; }, 0);
    $('predplatne-soucet').textContent = '≈ ' + kc(Math.round(soucet)) + ' měsíčně';
    $('seznam-predplatneho').innerHTML = seznam.slice(0, 6).map(function (p) {
      var b = G.barva(p.barva);
      return '<div class="predplatne-radek">' +
        '<span class="obchod-ikona" style="color:' + b + ';background:color-mix(in srgb,' + b +
          ' 16%, var(--surface-2))">' + ik(p.ikona) + '</span>' +
        '<span><span class="kat-jmeno">' + esc(p.nazev) + '</span>' +
          '<span class="predplatne-pod">další asi ' + esc(D.popisDne(p.dalsi).split(' · ')[0]) + '</span></span>' +
        '<span class="kat-castka">' + esc(kc(p.castka)) + '</span>' +
      '</div>';
    }).join('') + (seznam.length > 6
      ? '<p class="napoveda" style="margin:4px 0 0">a ještě ' + (seznam.length - 6) + ' další</p>' : '');
  }

  function tvarDni(n) { return n === 1 ? 'den' : (n >= 2 && n <= 4 ? 'dny' : 'dní'); }

  /** Pás „Rychle zapsat“ – nejčastější ruční zápisy, jedno klepnutí. */
  function vykresliRychle() {
    var seznam = D.sablony(6);
    ulozeneSablony = seznam;
    $('rychle-pas').hidden = seznam.length === 0;
    $('rychle-chipy').innerHTML = seznam.map(function (z, i) {
      return '<button class="rychly-chip" data-rychly="' + i + '" style="--kat-barva:' + G.barva(z.barva) + '">' +
        ik(z.ikona) + '<span>' + esc(z.poznamka || z.nazev) + '</span><b>' +
        esc(cislo(z.castka)) + '</b></button>';
    }).join('');
  }

  var DEN_MS = 86400000;

  function vykresliPripominkuImportu() {
    var n = D.stav().nastaveni;
    var el = $('karta-import');
    if (!n.posledniImport) { el.hidden = true; return; }
    var dni = Math.floor((D.zISO(D.dnesISO()) - D.zISO(n.posledniImport)) / DEN_MS);
    el.hidden = dni < 7;
    if (dni >= 7) {
      $('import-pripominka').innerHTML = 'Od posledního výpisu z banky uběhlo <b>' + dni + ' ' +
        tvarDni(dni) + '</b>.';
    }
  }

  /** Pondělí tohoto týdne (týden u nás začíná pondělkem). */
  function pondeliTydne() {
    var d = new Date();
    var k = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    k.setDate(k.getDate() - ((k.getDay() + 6) % 7));
    return k;
  }

  function pocetDniZbyva() {
    var dnes = new Date();
    if (dnes.getFullYear() !== rok || dnes.getMonth() !== mesic) return 0;
    return new Date(rok, mesic + 1, 0).getDate() - dnes.getDate();
  }

  function rozpocetHtml(r) {
    var podil = Math.min(100, r.podil * 100);
    var barva = r.podil >= 1 ? 'var(--vydaj)' : (r.podil >= 0.8 ? 'var(--varovani)' : G.barva(r.barva));
    var stav = r.zbyva >= 0
      ? '<span>zbývá <b>' + esc(kc(r.zbyva)) + '</b></span>'
      : '<span class="prekroceno">překročeno o ' + esc(kc(-r.zbyva)) + '</span>';
    if (r.podil >= 0.8 && r.podil < 1) {
      stav = '<span class="blizko">zbývá ' + esc(kc(r.zbyva)) + '</span>';
    }
    return '<div class="rozpocet-radek">' +
      '<div class="rozpocet-hlava"><span class="rozpocet-jmeno">' + ik(r.ikona) +
        esc(r.nazev) + '</span>' +
      '<b>' + esc(kc(r.utraceno)) + ' / ' + esc(kc(r.limit)) + '</b></div>' +
      '<div class="rozpocet-pruh"><div class="rozpocet-vypln" style="width:' + podil.toFixed(1) +
        '%;background:' + barva + '"></div></div>' +
      '<div class="rozpocet-pod"><span>' + Math.round(r.podil * 100) + ' % limitu</span>' + stav + '</div>' +
    '</div>';
  }

  function ctiMesic(mesice, i) {
    var el = $('mesice-cteni');
    if (!el || !mesice[i]) return;
    var m = mesice[i];
    el.innerHTML = '<b>' + D.MESICE[m.mesic] + ' ' + m.rok + ':</b> příjmy <b>' + esc(kc(m.prijmy)) +
      '</b>, výdaje <b>' + esc(kc(m.vydaje)) + '</b>, rozdíl <b>' + esc(kcZnak(m.rozdil)) + '</b>';
  }

  /* ---------- řádek transakce ---------- */

  /** Drobné značky u záznamu: rozepsaný nákup a přiložená účtenka. */
  function znackyZaznamu(t) {
    var html = '';
    if (t.polozky && t.polozky.length) {
      html += '<span class="polozky-znacka">' + ik('ui-historie') + t.polozky.length + '</span>';
    }
    if (t.fotka) html += '<span class="polozky-znacka">' + ik('ui-obrazek') + '</span>';
    return html;
  }

  function polozkaHtml(t) {
    var zn, castka, ikona, nazev, pod, barvaIkony;
    if (t.typ === 'prevod') {
      zn = ''; castka = kc(t.castka); ikona = 'ui-prevod';
      nazev = 'Převod';
      pod = D.ucet(t.ucet).nazev + ' → ' + D.ucet(t.ucetDo).nazev;
      barvaIkony = 'var(--ink-3)';
    } else {
      var k = D.kategorie(t.kat);
      ikona = k.ikona; nazev = k.nazev;
      zn = t.typ === 'prijem' ? 'prijem' : 'vydaj';
      castka = (t.typ === 'prijem' ? '+' : '−') + cislo(t.castka) + ' ' + mena();
      pod = D.ucet(t.ucet).nazev;
      barvaIkony = G.barva(k.barva);
    }
    // z výpisu: nahoře obchod, dole kategorie – čte se to líp než „NAKUP LIDL…“ v šedém řádku
    if (t.imp && t.pozn && t.typ !== 'prevod') { pod = nazev + ' · ' + pod; nazev = D.hezkyNazev(t.pozn); }
    else if (t.pozn) pod = t.pozn + ' · ' + pod;
    return '<button class="polozka" data-transakce="' + esc(t.id) + '">' +
      '<span class="polozka-ikona" style="color:' + barvaIkony + ';background:color-mix(in srgb,' +
        barvaIkony + ' 18%, var(--surface-2))">' + ik(ikona) + '</span>' +
      '<span><span class="polozka-nazev">' + esc(nazev) + znackyZaznamu(t) + '</span>' +
      '<span class="polozka-pod">' + esc(pod) + '</span></span>' +
      '<span class="polozka-castka ' + zn + '">' + esc(castka) + '</span>' +
    '</button>';
  }

  /* =================================================================
     HISTORIE
     ================================================================= */

  function filtrovane() {
    var vsechny = D.serazene();
    var hledane = filtr.text.trim().toLowerCase();
    var klic = D.klicMesice(rok, mesic);
    var dnes = D.dnesISO();
    var odTydne = filtr.rozsah === 'tyden' ? D.naISO(pondeliTydne()) : null;
    return vsechny.filter(function (t) {
      if (filtr.rozsah === 'mesic' && t.datum.slice(0, 7) !== klic) return false;
      if (filtr.rozsah === 'rok' && t.datum.slice(0, 4) !== String(rok)) return false;
      if (filtr.rozsah === 'dnes' && t.datum !== dnes) return false;
      if (filtr.rozsah === 'tyden' && (t.datum < odTydne || t.datum > dnes)) return false;
      if (filtr.typ !== 'vse' && t.typ !== filtr.typ) return false;
      if (filtr.kat && t.kat !== filtr.kat) return false;
      if (filtr.ucet && t.ucet !== filtr.ucet && t.ucetDo !== filtr.ucet) return false;
      if (hledane) {
        var kupa = (t.pozn || '') + ' ' + (t.typ === 'prevod' ? 'převod' : D.kategorie(t.kat).nazev) +
          ' ' + D.ucet(t.ucet).nazev + ' ' + String(t.castka);
        if (kupa.toLowerCase().indexOf(hledane) < 0) return false;
      }
      return true;
    });
  }

  function vykresliHistorii() {
    var seznam = filtrovane();

    // aktivní upřesnění
    var znacky = [];
    if (filtr.rozsah === 'dnes' || filtr.rozsah === 'tyden') {
      znacky.push('<button class="znacka-filtru" data-zrus="rozsah">' +
        (filtr.rozsah === 'dnes' ? 'Jen dnešek' : 'Tento týden') + ik('ui-zavrit') + '</button>');
    }
    if (filtr.kat) znacky.push('<button class="znacka-filtru" data-zrus="kat">' +
      ik(D.kategorie(filtr.kat).ikona) + esc(D.kategorie(filtr.kat).nazev) +
      ik('ui-zavrit') + '</button>');
    if (filtr.ucet) znacky.push('<button class="znacka-filtru" data-zrus="ucet">' +
      ik(D.ucet(filtr.ucet).ikona) + esc(D.ucet(filtr.ucet).nazev) +
      ik('ui-zavrit') + '</button>');
    $('filtr-aktivni').hidden = znacky.length === 0;
    $('filtr-aktivni').innerHTML = znacky.join('');

    var s = D.souhrn(seznam);
    $('souhrn-filtru').innerHTML =
      '<span>' + seznam.length + ' ' + tvarZaznamu(seznam.length) + '</span>' +
      '<span>příjmy <b class="prijem">' + esc(kc(s.prijmy)) + '</b> · výdaje <b class="vydaj">' +
      esc(kc(s.vydaje)) + '</b> · <b>' + esc(kcZnak(s.rozdil)) + '</b></span>';

    $('historie-prazdno').hidden = seznam.length > 0;

    // seskupení po dnech
    var html = '', denAktualni = null, davka = [];
    function uzavriDen() {
      if (!davka.length) return;
      var soucet = davka.reduce(function (a, t) {
        return a + (t.typ === 'prijem' ? t.castka : (t.typ === 'vydaj' ? -t.castka : 0));
      }, 0);
      html += '<div class="den-nadpis"><span>' + esc(D.popisDne(denAktualni)) + '</span>' +
        '<span class="den-soucet">' + esc(kcZnak(soucet)) + '</span></div>' +
        '<div class="skupina-karta">' + davka.map(polozkaHtml).join('') + '</div>';
      davka = [];
    }
    seznam.forEach(function (t) {
      if (t.datum !== denAktualni) { uzavriDen(); denAktualni = t.datum; }
      davka.push(t);
    });
    uzavriDen();
    $('seznam-transakci').innerHTML = html;
  }

  function tvarZaznamu(n) {
    if (n === 1) return 'záznam';
    if (n >= 2 && n <= 4) return 'záznamy';
    return 'záznamů';
  }

  /* =================================================================
     ÚČTY
     ================================================================= */

  function vykresliUcty() {
    var s = D.stav();
    $('ucty-celkem').textContent = kc(D.celkovyZustatek());
    $('seznam-uctu').innerHTML = s.ucty.map(function (u) {
      var z = D.zustatekUctu(u.id);
      var pocet = s.transakce.filter(function (t) { return t.ucet === u.id || t.ucetDo === u.id; }).length;
      return '<button class="ucet-karta" data-ucet="' + esc(u.id) + '">' +
        '<span class="ucet-ikona" style="color:' + G.barva(u.barva) +
          ';background:color-mix(in srgb,' + G.barva(u.barva) + ' 18%, var(--surface-2))">' +
          ik(u.ikona) + '</span>' +
        '<span><span class="ucet-jmeno">' + esc(u.nazev) + '</span>' +
        '<span class="ucet-pod">' + pocet + ' ' + tvarZaznamu(pocet) + ' · počátek ' + esc(kc(u.pocatek)) + '</span></span>' +
        '<span class="ucet-castka' + (z < 0 ? ' vydaj' : '') + '">' + esc(kc(z)) + '</span>' +
      '</button>';
    }).join('');
  }

  function dialogUctu(id) {
    var u = id ? D.najdi(D.stav().ucty, id) : null;
    volba = { ikona: u ? u.ikona : 'karta', barva: u ? (u.barva || 1) : (D.stav().ucty.length % 8) + 1 };
    dialog({
      titulek: u ? 'Upravit účet' : 'Nový účet',
      telo:
        '<label>Název</label><input class="pole" id="d-nazev" value="' + esc(u ? u.nazev : '') + '" placeholder="např. Peněženka">' +
        '<label>Ikona</label>' + mrizkaIkon() +
        '<label>Barva</label>' + radekBarev() +
        '<label>' + (u ? 'Kolik na něm je teď' : 'Kolik na něm je') + ' (' + esc(mena()) + ')</label>' +
        '<input class="pole" id="d-pocatek" inputmode="decimal" value="' +
          (u ? Math.round(D.zustatekUctu(u.id) * 100) / 100 : 0) + '">' +
        (u ? '<p class="napoveda" style="margin:-4px 0 8px;padding:0">Napište zůstatek podle banky – appka si srovná počáteční stav.</p>' : '') +
        (u ? '<button class="tl tl-nebezpeci tl-siroke" id="d-smaz">Smazat účet</button>' : ''),
      ano: 'Uložit',
      zamer: true,
      potvrd: function () {
        var nazev = $('d-nazev').value.trim();
        if (!nazev) { hlaska('Zadejte název účtu.'); return false; }
        var pocatek = parsujCastku($('d-pocatek').value);
        if (isNaN(pocatek)) pocatek = 0;
        var s = D.stav();
        if (u) {
          // zadává se dnešní zůstatek, počátek se dopočítá z pohybů
          var pohyby = D.zustatekUctu(u.id) - (Number(u.pocatek) || 0);
          u.nazev = nazev; u.ikona = volba.ikona; u.barva = volba.barva;
          u.pocatek = Math.round((pocatek - pohyby) * 100) / 100;
        } else {
          s.ucty.push({ id: D.noveId('u'), nazev: nazev, ikona: volba.ikona, pocatek: pocatek,
            barva: volba.barva });
        }
        D.ulozHned();
        hlaska('Uloženo.');
        return true;
      }
    });
    var tlSmaz = $('d-smaz');
    if (tlSmaz) naSlys(tlSmaz, 'click', function () {
      var s = D.stav();
      if (s.ucty.length <= 1) { hlaska('Musí zůstat aspoň jeden účet.'); return; }
      var pocet = s.transakce.filter(function (t) { return t.ucet === id || t.ucetDo === id; }).length;
      zavriDialog();
      dialog({
        titulek: 'Smazat účet?',
        telo: '<p>Účet <b>' + esc(u.nazev) + '</b> má ' + pocet + ' ' + tvarZaznamu(pocet) +
          '. Záznamy zůstanou, ale budou u neznámého účtu. Tohle nejde vrátit zpět.</p>',
        ano: 'Smazat', nebezpeci: true,
        potvrd: function () {
          var i = s.ucty.indexOf(u);
          if (i >= 0) s.ucty.splice(i, 1);
          D.ulozHned(); hlaska('Účet smazán.'); return true;
        }
      });
    });
  }

  function dialogPrevodu() {
    if (D.stav().ucty.length < 2) {
      hlaska('Na převod potřebujete aspoň dva účty.');
      return;
    }
    zaloz('prevod');
    otevriZaznam();
  }

  /* =================================================================
     VÍC / NASTAVENÍ
     ================================================================= */

  function vykresliNastaveni() {
    var s = D.stav();

    // rozpočty
    $('editor-rozpoctu').innerHTML = D.kategorieTypu('vydaj').map(function (k) {
      var v = s.rozpocty[k.id];
      return '<div class="editor-radek">' +
        '<span class="kat-ikona" style="color:' + G.barva(k.barva) + '">' + ik(k.ikona) + '</span>' +
        '<span>' + esc(k.nazev) + '</span>' +
        '<input class="pole" inputmode="decimal" data-rozpocet="' + esc(k.id) + '" placeholder="—" value="' +
          (v ? esc(String(v)) : '') + '">' +
      '</div>';
    }).join('');

    var hlidanych = Object.keys(s.rozpocty).filter(function (k) { return Number(s.rozpocty[k]) > 0; }).length;
    $('rozpocty-souhrn').textContent = hlidanych ? 'hlídáte ' + hlidanych : 'nic nehlídáte';
    $('kategorie-souhrn').textContent = s.kategorie.length + ' kategorií';

    // kategorie
    vse('#chipy-kat-typ .chip').forEach(function (b) {
      b.classList.toggle('chip-akt', b.getAttribute('data-kattyp') === katTypVEditoru);
    });
    $('editor-kategorii').innerHTML = D.kategorieTypu(katTypVEditoru).map(function (k) {
      var pocet = s.transakce.filter(function (t) { return t.kat === k.id; }).length;
      return '<div class="editor-radek" style="grid-template-columns:26px 1fr auto">' +
        '<span class="kat-ikona" style="color:' + G.barva(k.barva) + '">' + ik(k.ikona) + '</span>' +
        '<span><span>' + esc(k.nazev) + '</span><span class="pravidelna-pod"> · ' + pocet + '×</span></span>' +
        '<span><button class="odkaz" data-upravkat="' + esc(k.id) + '">Upravit</button></span>' +
      '</div>';
    }).join('');

    // pravidelné
    $('seznam-pravidelnych').innerHTML = s.pravidelne.length
      ? s.pravidelne.map(function (p) {
          var k = D.kategorie(p.kat);
          return '<div class="pravidelna-radek">' +
            '<span><span class="rozpocet-jmeno">' + ik(k.ikona) +
            esc(p.nazev || k.nazev) + '</span>' +
            '<span class="pravidelna-pod">každého ' + p.den + '. · ' + esc(D.ucet(p.ucet).nazev) +
            ' · ' + (p.typ === 'prijem' ? 'příjem' : 'výdaj') + '</span></span>' +
            '<span class="pravidelna-castka">' + esc(kc(p.castka)) + '</span>' +
            '<button class="smaz-x" data-smazpravidelnou="' + esc(p.id) + '" aria-label="Smazat">✕</button>' +
          '</div>';
        }).join('')
      : '<p class="napoveda" style="padding:6px 0 0">Zatím nic. Nájem nebo předplatné se pak zapíše samo.</p>';

    // zabezpečení
    vykresliZabezpeceni();

    // vzhled
    vse('#chipy-tema .chip').forEach(function (b) {
      b.classList.toggle('chip-akt', b.getAttribute('data-tema') === (s.nastaveni.tema || 'auto'));
    });
    $('pole-mena').value = mena();

    // výpis z banky
    var pocetPravidel = Object.keys(s.pravidla || {}).length;
    var z = s.nastaveni.posledniImport;
    $('stav-pravidel').innerHTML =
      (z ? 'Poslední výpis načten: <b>' + esc(D.popisDne(z).split(' · ')[0]) + '</b><br>' : '') +
      (pocetPravidel ? 'Naučeno obchodů: <b>' + pocetPravidel + '</b> · ' +
        '<button class="odkaz" id="tl-zapomen-pravidla" style="padding:0;font-size:12px">zapomenout</button>' : '');

    // statistika
    var od = s.transakce.reduce(function (a, t) { return (!a || t.datum < a) ? t.datum : a; }, null);
    $('statistika').innerHTML =
      'Záznamů: <b>' + s.transakce.length + '</b><br>' +
      'Účtů: <b>' + s.ucty.length + '</b> · kategorií: <b>' + s.kategorie.length + '</b><br>' +
      (od ? 'Nejstarší záznam: <b>' + esc(od) + '</b><br>' : '') +
      'Velikost dat: <b>' + Math.round(JSON.stringify(s).length / 1024) + ' kB</b>';
    $('verze').textContent = VERZE;
  }

  function dialogKategorie(id) {
    var s = D.stav();
    var k = id ? D.najdi(s.kategorie, id) : null;
    volba = { ikona: k ? k.ikona : 'stitek', barva: k ? (k.barva || 1) : (s.kategorie.length % 8) + 1 };
    dialog({
      titulek: k ? 'Upravit kategorii' : 'Nová kategorie',
      telo:
        '<label>Název</label><input class="pole" id="d-nazev" value="' + esc(k ? k.nazev : '') + '" placeholder="např. Kadeřník">' +
        '<label>Ikona</label>' + mrizkaIkon() +
        '<label>Barva</label>' + radekBarev() +
        (k ? '' : '<label>Typ</label><select class="pole" id="d-typ"><option value="vydaj">Výdaj</option><option value="prijem">Příjem</option></select>') +
        (k ? '<button class="tl tl-nebezpeci tl-siroke" id="d-smaz">Smazat kategorii</button>' : ''),
      ano: 'Uložit',
      zamer: true,
      potvrd: function () {
        var nazev = $('d-nazev').value.trim();
        if (!nazev) { hlaska('Zadejte název.'); return false; }
        if (k) { k.nazev = nazev; k.ikona = volba.ikona; k.barva = volba.barva; }
        else {
          var typ = $('d-typ').value;
          s.kategorie.push({ id: D.noveId('k'), nazev: nazev, ikona: volba.ikona, typ: typ,
            barva: volba.barva });
          katTypVEditoru = typ;
        }
        D.ulozHned(); hlaska('Uloženo.'); return true;
      }
    });
    if (!k) { var sel = $('d-typ'); if (sel) sel.value = katTypVEditoru; }
    var tlSmaz = $('d-smaz');
    if (tlSmaz) naSlys(tlSmaz, 'click', function () {
      var pocet = s.transakce.filter(function (t) { return t.kat === id; }).length;
      zavriDialog();
      dialog({
        titulek: 'Smazat kategorii?',
        telo: '<p>' + (pocet
          ? 'Kategorii <b>' + esc(k.nazev) + '</b> používá ' + pocet + ' ' + tvarZaznamu(pocet) +
            '. Ty zůstanou, ale ztratí zařazení.'
          : 'Kategorie <b>' + esc(k.nazev) + '</b> se nikde nepoužívá.') + '</p>',
        ano: 'Smazat', nebezpeci: true,
        potvrd: function () {
          var i = s.kategorie.indexOf(k);
          if (i >= 0) s.kategorie.splice(i, 1);
          delete s.rozpocty[id];
          D.ulozHned(); hlaska('Kategorie smazána.'); return true;
        }
      });
    });
  }

  function dialogPravidelne() {
    var s = D.stav();
    var moznostiKat = D.kategorieTypu('vydaj').concat(D.kategorieTypu('prijem')).map(function (k) {
      return '<option value="' + esc(k.id) + '">' + esc(k.nazev) +
        (k.typ === 'prijem' ? ' (příjem)' : '') + '</option>';
    }).join('');
    var moznostiUctu = s.ucty.map(function (u) {
      return '<option value="' + esc(u.id) + '">' + esc(u.nazev) + '</option>';
    }).join('');
    dialog({
      titulek: 'Pravidelná platba',
      telo:
        '<label>Popis</label><input class="pole" id="d-nazev" placeholder="např. Nájem">' +
        '<label>Částka (' + esc(mena()) + ')</label><input class="pole" id="d-castka" inputmode="decimal" placeholder="0">' +
        '<label>Kategorie</label><select class="pole" id="d-kat">' + moznostiKat + '</select>' +
        '<label>Účet</label><select class="pole" id="d-ucet">' + moznostiUctu + '</select>' +
        '<label>Den v měsíci</label><input class="pole" id="d-den" inputmode="numeric" value="1">',
      ano: 'Přidat',
      zamer: true,
      potvrd: function () {
        var castka = parsujCastku($('d-castka').value);
        if (!(castka > 0)) { hlaska('Zadejte částku.'); return false; }
        var katId = $('d-kat').value;
        var den = Math.min(31, Math.max(1, parseInt($('d-den').value, 10) || 1));
        var dnes = new Date();
        s.pravidelne.push({
          id: D.noveId('p'), nazev: $('d-nazev').value.trim(), castka: castka,
          typ: D.kategorie(katId).typ, kat: katId, ucet: $('d-ucet').value, den: den,
          pozn: $('d-nazev').value.trim(),
          od: D.klicMesice(dnes.getFullYear(), dnes.getMonth()), posledni: null
        });
        D.ulozHned();
        var pridano = D.dopisPravidelne();
        hlaska(pridano ? 'Přidáno, zapsáno ' + pridano + '×.' : 'Přidáno.');
        return true;
      }
    });
  }

  /* =================================================================
     FORMULÁŘ ZÁZNAMU
     ================================================================= */

  function zaloz(typ, predloha) {
    var s = D.stav();
    var n = s.nastaveni;
    var vychoziUcet = (n.posledniUcet && D.najdi(s.ucty, n.posledniUcet)) ? n.posledniUcet : s.ucty[0].id;
    var vychoziKat = {};
    ['vydaj', 'prijem'].forEach(function (t) {
      var ulozena = n.posledniKat && n.posledniKat[t];
      var seznam = D.kategorieTypu(t);
      vychoziKat[t] = (ulozena && D.najdi(seznam, ulozena)) ? ulozena : (seznam[0] ? seznam[0].id : null);
    });
    zaznam = {
      id: null,
      typ: typ || 'vydaj',
      castka: '',
      kat: vychoziKat,
      ucet: vychoziUcet,
      ucetDo: s.ucty[1] ? s.ucty[1].id : s.ucty[0].id,
      datum: vybranyDenNeboDnesek(),
      pozn: '',
      polozky: [],
      rezimPolozek: false,
      katProPolozku: null,
      fotkaUrl: null,
      fotkaBajty: null,
      meloFotku: false
    };
    if (predloha) Object.assign(zaznam, predloha);
  }

  /** V jiném než aktuálním měsíci nabídne jeho první den, jinak dnešek. */
  function vybranyDenNeboDnesek() {
    var dnes = new Date();
    if (dnes.getFullYear() === rok && dnes.getMonth() === mesic) return D.dnesISO();
    return D.klicMesice(rok, mesic) + '-01';
  }

  function zalozZTransakce(t) {
    var s = D.stav();
    zaznam = {
      id: t.id,
      typ: t.typ,
      castka: String(t.castka),
      kat: { vydaj: null, prijem: null },
      ucet: t.ucet,
      ucetDo: t.ucetDo || (s.ucty[1] ? s.ucty[1].id : s.ucty[0].id),
      datum: t.datum,
      pozn: t.pozn || '',
      polozky: (t.polozky || []).map(function (p) {
        return { nazev: p.nazev || '', castka: p.castka, kat: p.kat };
      }),
      rezimPolozek: !!(t.polozky && t.polozky.length),
      katProPolozku: null,
      fotkaUrl: null,
      fotkaBajty: null,
      meloFotku: !!t.fotka
    };
    if (t.typ === 'vydaj' || t.typ === 'prijem') zaznam.kat[t.typ] = t.kat;
    ['vydaj', 'prijem'].forEach(function (typ) {
      if (!zaznam.kat[typ]) {
        var seznam = D.kategorieTypu(typ);
        zaznam.kat[typ] = seznam[0] ? seznam[0].id : null;
      }
    });
  }

  function otevriZaznam() {
    $('zaznam-titulek').textContent = zaznam.id ? 'Upravit záznam' : 'Nový záznam';
    $('zaznam-smazat').hidden = !zaznam.id;
    $('castka-mena').textContent = mena();
    $('pole-castka').value = zaznam.castka;
    $('pole-datum').value = zaznam.datum;
    $('pole-pozn').value = zaznam.pozn;
    // u opravy nebo převodu jsou podrobnosti potřeba hned, u nového zápisu jen zdržují
    $('zapis-podrobnosti').open = !!zaznam.id || zaznam.typ === 'prevod';
    obnovTypZaznamu();
    vykresliUctenku();
    $('prekryv-zaznam').hidden = false;
    // iPhone ukáže klávesnici jen při zaměření přímo v obsluze klepnutí, ne se zpožděním
    if (!zaznam.rezimPolozek && !zaznam.id) {
      try { $('pole-castka').focus({ preventScroll: true }); } catch (e) { $('pole-castka').focus(); }
    }

    // uloženou účtenku doneseme až po otevření, ať se list neopozdí
    if (zaznam.meloFotku && zaznam.id) {
      var proId = zaznam.id;
      D.nactiFotku(proId).then(function (bajty) {
        if (!zaznam || zaznam.id !== proId || !bajty) return;
        zaznam.fotkaUrl = bajtyNaUrl(bajty);
        vykresliUctenku();
      }).catch(function () { /* fotka nešla přečíst */ });
    }
  }

  function zavriZaznam() {
    zapomenFotku();
    $('prekryv-zaznam').hidden = true;
    zaznam = null;
  }

  function obnovTypZaznamu() {
    var typ = zaznam.typ;
    vse('#prepinac-typ button').forEach(function (b) {
      b.classList.toggle('prep-akt', b.getAttribute('data-typ') === typ);
    });
    var jePrevod = (typ === 'prevod');
    var proPolozku = (zaznam.katProPolozku !== null && zaznam.katProPolozku !== undefined);
    // při rozepsaném nákupu se kategorie vybírá u položek, ne u celku
    var ukazKategorie = !jePrevod && (proPolozku || !zaznam.rezimPolozek);

    $('skupina-kategorie').hidden = !ukazKategorie;
    $('skupina-ucet-do').hidden = !jePrevod;
    $('popis-ucet').textContent = jePrevod ? 'Odkud' : 'Účet';
    $('popis-kategorie').textContent = proPolozku ? 'Kategorie položky' : 'Kategorie';

    if (ukazKategorie) {
      var vybrana = proPolozku
        ? (zaznam.polozky[zaznam.katProPolozku] || {}).kat
        : zaznam.kat[typ];
      var seznam = D.kategoriePodlePouziti(typ);
      var videt = seznam;
      if (!zaznam.vsechnyKat && !proPolozku && seznam.length > NA_OCI + 1) {
        videt = seznam.slice(0, NA_OCI);
        // vybraná kategorie musí být vidět, i když se používá málo
        if (vybrana && !videt.some(function (k) { return k.id === vybrana; })) {
          var v = D.najdi(seznam, vybrana);
          if (v) videt = videt.slice(0, NA_OCI - 1).concat([v]);
        }
      }
      $('vyber-kategorie').innerHTML = videt.map(function (k) {
        return '<button class="kat-tl' + (k.id === vybrana ? ' vybrano' : '') +
          '" data-vyberkat="' + esc(k.id) + '" style="--kat-barva:' + G.barva(k.barva) + '">' +
          ik(k.ikona) + '<span>' + esc(k.nazev) + '</span></button>';
      }).join('') + (videt.length < seznam.length
        ? '<button class="kat-tl kat-dalsi" id="kat-dalsi">' + ik('ui-dolu') +
          '<span>Další (' + (seznam.length - videt.length) + ')</span></button>'
        : '');
    }
    $('zapis-napoveda').hidden = !rychlyZapis();
    vykresliSouhrnPodrobnosti();
    vykresliPolozky();
    var ucty = D.stav().ucty;
    $('vyber-uctu').innerHTML = ucty.map(function (u) {
      return '<button class="chip' + (u.id === zaznam.ucet ? ' chip-akt' : '') +
        '" data-vyberucet="' + esc(u.id) + '">' + ik(u.ikona) + esc(u.nazev) + '</button>';
    }).join('');
    $('vyber-uctu-do').innerHTML = ucty.map(function (u) {
      return '<button class="chip' + (u.id === zaznam.ucetDo ? ' chip-akt' : '') +
        '" data-vyberucetdo="' + esc(u.id) + '">' + ik(u.ikona) + esc(u.nazev) + '</button>';
    }).join('');
  }

  var NA_OCI = 7;   // kolik kategorií je vidět bez rozbalení (+ tlačítko Další = 2 řady)

  /** Nový výdaj či příjem: klepnutí na kategorii rovnou ukládá. */
  function rychlyZapis() {
    return zaznam && !zaznam.id && zaznam.typ !== 'prevod' && !zaznam.rezimPolozek &&
      (zaznam.katProPolozku === null || zaznam.katProPolozku === undefined);
  }

  function vykresliSouhrnPodrobnosti() {
    var casti = [D.ucet(zaznam.ucet).nazev];
    var d = $('pole-datum').value || zaznam.datum;
    casti.push(d === D.dnesISO() ? 'dnes' : D.popisDne(d).split(' · ')[0].toLowerCase());
    var pozn = $('pole-pozn').value.trim();
    if (pozn) casti.push('„' + pozn + '“');
    $('podrobnosti-souhrn').textContent = casti.join(' · ');
  }

  function ulozZaznam() {
    var typ = zaznam.typ;
    var polozky = null;
    var castka;

    if (zaznam.rezimPolozek && typ !== 'prevod') {
      sesbirejPolozky();
      polozky = zaznam.polozky.filter(function (p) { return p.castka > 0; });
      if (!polozky.length) {
        hlaska('Vyplňte aspoň jednu položku s částkou.'); return;
      }
      polozky = polozky.map(function (p) {
        return { nazev: p.nazev || '', castka: p.castka, kat: p.kat || zaznam.kat[typ] };
      });
      castka = Math.round(D.soucetPolozek(polozky) * 100) / 100;
    } else {
      castka = parsujCastku($('pole-castka').value);
      if (!(castka > 0)) { hlaska('Zadejte částku větší než nula.'); $('pole-castka').focus(); return; }
      castka = Math.round(castka * 100) / 100;
    }

    var datum = $('pole-datum').value || D.dnesISO();
    var pozn = $('pole-pozn').value.trim();

    if (typ === 'prevod' && zaznam.ucet === zaznam.ucetDo) {
      hlaska('Vyberte dva různé účty.'); return;
    }

    // hlavní kategorie = ta s největší položkou, ať má záznam kam patřit
    var hlavniKat = zaznam.kat[typ];
    if (polozky && polozky.length) {
      hlavniKat = polozky.reduce(function (a, p) {
        return (!a || p.castka > a.castka) ? p : a;
      }, null).kat;
    }

    var data = {
      datum: datum, castka: castka, typ: typ,
      kat: typ === 'prevod' ? null : hlavniKat,
      ucet: zaznam.ucet,
      ucetDo: typ === 'prevod' ? zaznam.ucetDo : null,
      pozn: pozn,
      polozky: polozky && polozky.length ? polozky : null,
      fotka: !!(zaznam.fotkaBajty || (zaznam.meloFotku && zaznam.fotkaUrl))
    };

    var idZaznamu;
    if (zaznam.id) {
      idZaznamu = zaznam.id;
      var puvodni = D.najdi(D.stav().transakce, zaznam.id);
      // oprava kategorie u pohybu z výpisu = appka se to naučí na příště
      if (puvodni && puvodni.klic && data.kat && puvodni.kat !== data.kat && typ !== 'prevod') {
        D.stav().pravidla[puvodni.klic] = data.kat;
      }
      D.upravTransakci(zaznam.id, data);
      hlaska('Změny uloženy.');
    } else {
      var nova = D.pridejTransakci(data);
      idZaznamu = nova.id;
      var popisZapisu = typ === 'prevod' ? 'Převod ' + cislo(castka) + ' ' + mena()
        : D.kategorie(hlavniKat).nazev + ' ' + (typ === 'prijem' ? '+' : '−') + cislo(castka) + ' ' + mena();
      hlaska(popisZapisu + ' zapsáno', {
        popis: 'Zpět',
        fn: function () { D.smazTransakci(nova.id); vykresli(); hlaska('Vráceno.'); }
      });
    }

    // účtenka
    if (zaznam.fotkaBajty) {
      D.ulozFotku(idZaznamu, zaznam.fotkaBajty).catch(function () {
        hlaska('Účtenku se nepovedlo uložit.');
      });
    } else if (zaznam.meloFotku && !zaznam.fotkaUrl) {
      D.smazFotku(idZaznamu);
    }

    // zapamatuj poslední volbu
    var n = D.stav().nastaveni;
    n.posledniUcet = zaznam.ucet;
    if (typ !== 'prevod') {
      n.posledniKat = n.posledniKat || {};
      n.posledniKat[typ] = zaznam.kat[typ];
    }
    D.ulozHned();

    // přeskoč na měsíc uloženého záznamu, aby byl vidět
    var r = +datum.slice(0, 4), m = +datum.slice(5, 7) - 1;
    if (r !== rok || m !== mesic) { rok = r; mesic = m; }

    zavriZaznam();
    vykresli();
  }

  function smazZaznam() {
    var id = zaznam.id;
    dialog({
      titulek: 'Smazat záznam?',
      telo: '<p>Tohle nejde vrátit zpět.</p>',
      ano: 'Smazat', nebezpeci: true,
      potvrd: function () {
        D.smazTransakci(id);
        zavriZaznam();
        vykresli();
        hlaska('Záznam smazán.');
        return true;
      }
    });
  }

  /* =================================================================
     ZÁLOHA A EXPORT
     ================================================================= */

  function stahni(nazev, obsah, typ) {
    try {
      var blob = new Blob([obsah], { type: typ });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nazev;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      return true;
    } catch (e) {
      hlaska('Stažení se nepovedlo.');
      return false;
    }
  }

  function razitko() {
    var d = new Date();
    return d.getFullYear() + D.dvojcisli(d.getMonth() + 1) + D.dvojcisli(d.getDate());
  }

  /* =================================================================
     GRAFY
     ================================================================= */

  function vykresliGrafy() {
    var vM = D.vMesici(rok, mesic);
    var dnes = new Date();
    var jeAktualni = (dnes.getFullYear() === rok && dnes.getMonth() === mesic);
    var poslDen = new Date(rok, mesic + 1, 0).getDate();
    var doDne = jeAktualni ? dnes.getDate() : poslDen;

    var mesice = D.poslednichMesicu(rok, mesic, 6);
    $('graf-mesice').innerHTML = G.grafMesicu(mesice, mesicVGrafu);
    ctiMesic(mesice, mesicVGrafu);

    $('graf-dny').innerHTML = G.sloupceDnu(D.dennitrata(rok, mesic),
      jeAktualni ? dnes.getDate() : 0, kc);
    $('graf-kumulativne').innerHTML = G.caraKumulativne(D.kumulativne(rok, mesic), doDne, kc);
    $('graf-tyden').innerHTML = G.sloupceTydne(D.podleDneVTydnu(rok, mesic), kc);
    $('graf-zustatek').innerHTML = G.caraZustatku(D.zustatkyMesicu(rok, mesic, 12), kc);

    var ucty = D.podleUctu(vM);
    $('ucty-prazdno').hidden = ucty.length > 0;
    $('graf-ucty').innerHTML = ucty.length ? G.seznamKategorii(ucty, kc) : '';

    var prijmy = D.podleKategorii(vM, 'prijem');
    $('prijmy-prazdno').hidden = prijmy.length > 0;
    $('graf-prijmy').innerHTML = prijmy.length ? G.seznamKategorii(prijmy, kc) : '';
  }

  /* =================================================================
     VÝBĚR IKONY A BARVY
     ================================================================= */

  var volba = { ikona: 'stitek', barva: 1 };

  function mrizkaIkon() {
    return '<div class="ikony-mrizka">' + global.FIkony.NABIDKA.map(function (kl) {
      return '<button type="button" class="ikona-tl' + (kl === volba.ikona ? ' vybrano' : '') +
        '" data-ikona-volba="' + kl + '" aria-label="' + kl + '">' + ik(kl) + '</button>';
    }).join('') + '</div>';
  }

  function radekBarev() {
    var html = '<div class="barvy-radek">';
    for (var i = 1; i <= 8; i++) {
      html += '<button type="button" class="barva-tl' + (i === volba.barva ? ' vybrano' : '') +
        '" data-barva-volba="' + i + '" style="background:' + G.barva(i) +
        '" aria-label="Barva ' + i + '"></button>';
    }
    return html + '</div>';
  }

  function klikVeVyberuIkony(e) {
    var i = e.target.closest('[data-ikona-volba]');
    if (i) {
      volba.ikona = i.getAttribute('data-ikona-volba');
      vse('[data-ikona-volba]', $('dialog-telo')).forEach(function (b) {
        b.classList.toggle('vybrano', b === i);
      });
      return;
    }
    var b = e.target.closest('[data-barva-volba]');
    if (b) {
      volba.barva = Number(b.getAttribute('data-barva-volba'));
      vse('[data-barva-volba]', $('dialog-telo')).forEach(function (x) {
        x.classList.toggle('vybrano', x === b);
      });
    }
  }

  /* =================================================================
     POLOŽKY NÁKUPU
     ================================================================= */

  function vykresliPolozky() {
    var jePrevod = (zaznam.typ === 'prevod');
    var rezim = !!zaznam.rezimPolozek && !jePrevod;

    $('tl-polozky').hidden = rezim || jePrevod;
    $('polozky-blok').hidden = !rezim;
    $('pole-castka').readOnly = rezim;

    if (!rezim) { $('polozky-soucet').textContent = ''; return; }

    var vychoziKat = zaznam.kat[zaznam.typ];
    $('seznam-polozek').innerHTML = zaznam.polozky.map(function (p, i) {
      var k = D.kategorie(p.kat || vychoziKat);
      return '<div class="polozka-radek">' +
        '<button type="button" class="polozka-kat" data-polozka-kat="' + i +
          '" style="color:' + G.barva(k.barva) + '" aria-label="Kategorie položky">' +
          ik(k.ikona) + '</button>' +
        '<input class="pole" data-polozka-nazev="' + i + '" value="' + esc(p.nazev || '') +
          '" placeholder="co to bylo" autocomplete="off">' +
        '<input class="pole polozka-castka-pole" inputmode="decimal" data-polozka-castka="' + i +
          '" value="' + (p.castka ? esc(String(p.castka)) : '') + '" placeholder="0">' +
        '<button type="button" class="polozka-pryc" data-polozka-pryc="' + i +
          '" aria-label="Odebrat položku">' + ik('ui-zavrit') + '</button>' +
      '</div>';
    }).join('');

    var soucet = D.soucetPolozek(zaznam.polozky);
    $('polozky-soucet').textContent = soucet ? kc(soucet) : '';
    $('pole-castka').value = soucet ? String(Math.round(soucet * 100) / 100) : '';
  }

  function zapnuPolozky() {
    zaznam.rezimPolozek = true;
    if (!zaznam.polozky.length) {
      var start = parsujCastku($('pole-castka').value);
      zaznam.polozky = [
        { nazev: '', castka: isNaN(start) || !start ? '' : start, kat: zaznam.kat[zaznam.typ] },
        { nazev: '', castka: '', kat: zaznam.kat[zaznam.typ] }
      ];
    }
    obnovTypZaznamu();
  }

  function vypniPolozky() {
    var soucet = D.soucetPolozek(zaznam.polozky);
    zaznam.rezimPolozek = false;
    zaznam.polozky = [];
    obnovTypZaznamu();
    $('pole-castka').value = soucet ? String(Math.round(soucet * 100) / 100) : '';
  }

  function sesbirejPolozky() {
    vse('[data-polozka-nazev]').forEach(function (el) {
      var i = Number(el.getAttribute('data-polozka-nazev'));
      if (zaznam.polozky[i]) zaznam.polozky[i].nazev = el.value.trim();
    });
    vse('[data-polozka-castka]').forEach(function (el) {
      var i = Number(el.getAttribute('data-polozka-castka'));
      if (!zaznam.polozky[i]) return;
      var c = parsujCastku(el.value);
      zaznam.polozky[i].castka = isNaN(c) ? 0 : Math.round(c * 100) / 100;
    });
  }

  /* =================================================================
     ÚČTENKA
     ================================================================= */

  var MAX_HRANA = 1400;

  /** Zmenší a překóduje fotku, ať účtenky nenafouknou úložiště. */
  function zmensObrazek(soubor) {
    return new Promise(function (splnit, zamitnout) {
      var url = URL.createObjectURL(soubor);
      var obr = new Image();
      obr.onload = function () {
        var nejvetsi = Math.max(obr.width, obr.height);
        var k = nejvetsi > MAX_HRANA ? MAX_HRANA / nejvetsi : 1;
        var platno = document.createElement('canvas');
        platno.width = Math.max(1, Math.round(obr.width * k));
        platno.height = Math.max(1, Math.round(obr.height * k));
        platno.getContext('2d').drawImage(obr, 0, 0, platno.width, platno.height);
        URL.revokeObjectURL(url);
        platno.toBlob(function (blob) {
          if (!blob) { zamitnout(new Error('bez dat')); return; }
          if (blob.arrayBuffer) blob.arrayBuffer().then(splnit, zamitnout);
          else {
            var ctecka = new FileReader();
            ctecka.onload = function () { splnit(ctecka.result); };
            ctecka.onerror = zamitnout;
            ctecka.readAsArrayBuffer(blob);
          }
        }, 'image/jpeg', 0.72);
      };
      obr.onerror = function () { URL.revokeObjectURL(url); zamitnout(new Error('nelze načíst')); };
      obr.src = url;
    });
  }

  function bajtyNaUrl(bajty) {
    return URL.createObjectURL(new Blob([bajty], { type: 'image/jpeg' }));
  }

  function vykresliUctenku() {
    var obal = $('uctenka-obal');
    if (zaznam.fotkaUrl) {
      obal.innerHTML = '<div class="uctenka-nahled">' +
        '<img src="' + zaznam.fotkaUrl + '" alt="Účtenka" data-uctenka-velka="1">' +
        '<button type="button" class="uctenka-pryc" data-uctenka-pryc="1" ' +
        'aria-label="Odebrat účtenku">' + ik('ui-zavrit') + '</button></div>';
    } else {
      obal.innerHTML = '<button type="button" class="uctenka-pridat" data-uctenka-pridat="1">' +
        ik('ui-fotoaparat') + ' Vyfotit nebo vybrat účtenku</button>';
    }
  }

  function zapomenFotku() {
    if (zaznam && zaznam.fotkaUrl) { try { URL.revokeObjectURL(zaznam.fotkaUrl); } catch (e) { /* ok */ } }
  }

  /* =================================================================
     ŠABLONY – dlouhý stisk na +
     ================================================================= */

  var casovacStisku = null;
  var bylDlouhy = false;

  function hlidejDlouhyStisk(el, akce) {
    function zacatek() {
      bylDlouhy = false;
      if (casovacStisku) clearTimeout(casovacStisku);
      casovacStisku = setTimeout(function () {
        bylDlouhy = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* nevadí */ } }
        akce();
      }, 450);
    }
    function konec() { if (casovacStisku) { clearTimeout(casovacStisku); casovacStisku = null; } }
    el.addEventListener('touchstart', zacatek, { passive: true });
    el.addEventListener('touchend', konec);
    el.addEventListener('touchcancel', konec);
    el.addEventListener('touchmove', konec, { passive: true });
    el.addEventListener('mousedown', zacatek);
    el.addEventListener('mouseup', konec);
    el.addEventListener('mouseleave', konec);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function otevriSablony() {
    var seznam = D.sablony(4);
    if (!seznam.length) {
      hlaska('Šablony se objeví, až budete mít víc podobných záznamů.');
      return;
    }
    $('seznam-sablon').innerHTML = seznam.map(function (s, i) {
      return '<button class="sablona" data-sablona="' + i + '">' +
        '<span class="sablona-ikona" style="color:' + G.barva(s.barva) +
          ';background:color-mix(in srgb,' + G.barva(s.barva) + ' 18%, var(--surface-2))">' +
          ik(s.ikona) + '</span>' +
        '<span><span class="sablona-nazev">' + esc(s.nazev) + '</span>' +
        '<span class="sablona-pod">' + esc(D.ucet(s.ucet).nazev) + ' · zapsáno ' + s.pocet + '×</span></span>' +
        '<span class="sablona-castka ' + (s.typ === 'prijem' ? 'prijem' : 'vydaj') + '">' +
          (s.typ === 'prijem' ? '+' : '−') + esc(cislo(s.castka) + ' ' + mena()) + '</span>' +
      '</button>';
    }).join('');
    ulozeneSablony = seznam;
    $('prekryv-sablony').hidden = false;
  }

  var ulozeneSablony = [];

  function zapisZeSablony(i) {
    var s = ulozeneSablony[i];
    if (!s) return;
    $('prekryv-sablony').hidden = true;
    var datum = D.dnesISO();
    var t = D.pridejTransakci({
      datum: datum, castka: s.castka, typ: s.typ, kat: s.kat,
      ucet: s.ucet, ucetDo: null, pozn: s.poznamka || ''
    });
    var dnes = new Date();
    rok = dnes.getFullYear(); mesic = dnes.getMonth();
    vykresli();
    hlaska((s.poznamka || s.nazev) + ' ' + cislo(s.castka) + ' ' + mena() + ' zapsáno', {
      popis: 'Zpět',
      fn: function () {
        D.smazTransakci(t.id);
        vykresli();
        hlaska('Vráceno.');
      }
    });
  }

  /* =================================================================
     VÝPIS Z BANKY
     Soubor → rozbor (FImport) → kontrola v seznamu → zápis.
     Opravená kategorie platí hned pro všechny řádky téhož obchodu
     a appka si ji zapamatuje na příští výpis.
     ================================================================= */

  var imp = null;
  var vyberImport = null;   // index řádku, kterému se právě vybírá kategorie

  function tvarPohybu(n) {
    if (n === 1) return 'pohyb';
    if (n >= 2 && n <= 4) return 'pohyby';
    return 'pohybů';
  }

  /** Účet, kam výpis nejspíš patří: minule použitý, jinak první „kartový“. */
  function vychoziUcetImportu() {
    var s = D.stav();
    var minule = s.nastaveni.importUcet;
    if (minule && D.najdi(s.ucty, minule)) return minule;
    var karta = s.ucty.filter(function (u) { return u.ikona === 'karta' || u.ikona === 'banka'; })[0];
    return (karta || s.ucty.filter(function (u) { return u.ikona !== 'hotovost'; })[0] || s.ucty[0]).id;
  }

  function uctyHotovosti() {
    var s = D.stav();
    var h = D.najdi(s.ucty, 'u-hotovost') ||
      s.ucty.filter(function (u) { return u.ikona === 'hotovost'; })[0];
    return h && h.id !== imp.ucet ? h : null;
  }

  function otevriImport() {
    imp = { ucet: vychoziUcetImportu(), vynucene: null, nauceno: {}, banka: D.stav().nastaveni.banka || null };
    vykresliImportUvod();
    $('prekryv-import').hidden = false;
  }

  function zavriImport() {
    $('prekryv-import').hidden = true;
    imp = null;
  }

  // Kde export v bankovnictví obvykle je. Menu se u bank mění, proto „obvykle“.
  var BANKY = [
    ['fio', 'Fio', 'Internetbanking → Pohyby na účtu → dole <b>Export</b> → CSV (nebo GPC).'],
    ['cs', 'Česká spořitelna', 'George → účet → Transakce → <b>Export</b> (ikona stažení) → CSV nebo Excel.'],
    ['kb', 'Komerční banka', 'Internetové bankovnictví → účet → Historie transakcí → <b>Export</b> → CSV.'],
    ['csob', 'ČSOB', 'Internetbanking → Pohyby na účtu → <b>Export</b> → CSV.'],
    ['rb', 'Raiffeisen', 'Online banking → Pohyby na účtu → <b>Exportovat</b> → CSV.'],
    ['air', 'Air Bank', 'Internetové bankovnictví → Historie plateb → <b>Exportovat</b> → CSV.'],
    ['mbank', 'mBank', 'Historie transakcí → <b>Stáhnout</b> → CSV.'],
    ['moneta', 'Moneta', 'Internet Banka → Historie → <b>Export</b> → CSV nebo Excel.'],
    ['uni', 'UniCredit', 'Online banking → Pohyby → <b>Export</b> → CSV.'],
    ['partners', 'Partners, Creditas', 'Pohyby na účtu → <b>Export</b> → CSV nebo Excel.'],
    ['revolut', 'Revolut', 'Aplikace → účet → ⋯ → <b>Výpis</b> (Statement) → Excel/CSV → období.'],
    ['n26', 'N26, Wise', 'Web nebo aplikace → <b>Výpisy</b> (Statements) → CSV.'],
    ['jina', 'Jiná', 'Hledejte <b>Export</b>, <b>Stáhnout</b> nebo <b>Výpis pohybů</b>. Bere se CSV, Excel (.xlsx) a GPC.']
  ];

  function vykresliImportUvod(chyba) {
    $('import-pata').hidden = true;
    var ucty = D.stav().ucty;
    $('import-telo').innerHTML =
      (chyba ? '<div class="karta imp-souhrn"><div class="imp-chyba">' + esc(chyba) + '</div></div>' : '') +
      '<div class="imp-kroky">' +
        '<div class="imp-krok"><b>1</b><span>V internetovém bankovnictví otevřete pohyby na účtu a dejte ' +
          '<i>Export</i> nebo <i>Stáhnout</i> → <b>CSV</b> (bere se i Excel .xlsx a GPC). Níž vyberte banku a řeknu vám, kde to obvykle je.</span></div>' +
        '<div class="imp-krok"><b>2</b><span>Tady soubor vyberte. Appka pohyby sama roztřídí do kategorií a ukáže vám je ke kontrole.</span></div>' +
        '<div class="imp-krok"><b>3</b><span>Co opravíte, si zapamatuje. Příště už jen potvrdíte.</span></div>' +
      '</div>' +
      '<div class="skupina-nadpis">Vaše banka</div>' +
      '<div class="chipy chipy-obal banky">' + BANKY.map(function (b) {
        return '<button class="chip' + (imp.banka === b[0] ? ' chip-akt' : '') + '" data-impbanka="' + b[0] + '">' +
          esc(b[1]) + '</button>';
      }).join('') + '</div>' +
      (imp.banka ? '<p class="banka-rada">Obvykle: ' + BANKY.filter(function (b) { return b[0] === imp.banka; })[0][2] +
        '<br><span>Menu se občas mění – když to nesedí, hledejte slovo Export.</span></p>' : '') +
      '<div class="skupina-nadpis" style="margin-top:14px">Do kterého účtu</div>' +
      '<div class="chipy chipy-obal">' + ucty.map(function (u) {
        return '<button class="chip' + (u.id === imp.ucet ? ' chip-akt' : '') + '" data-impucet="' +
          esc(u.id) + '">' + ik(u.ikona) + esc(u.nazev) + '</button>';
      }).join('') + '</div>' +
      '<button class="tl tl-hlavni tl-siroke tl-radek" id="import-vybrat">' + ik('ui-nahrat') +
        ' Vybrat soubor s výpisem</button>' +
      '<p class="napoveda">Soubor se čte jen tady v telefonu, nikam se neposílá. Stejný výpis můžete ' +
        'načíst klidně znovu – co už v appce je, se podruhé nezapíše.</p>';
  }

  function nactiSouborVypisu(soubor) {
    var ctecka = new FileReader();
    ctecka.onload = function () {
      if (!imp) return;
      imp.nazev = soubor.name;
      global.FImport.prectiSoubor(ctecka.result).then(function (v) {
        if (!imp) return;
        imp.text = v.text;
        imp.format = v.format;
        imp.vynucene = null;
        zpracujImport();
      }).catch(function (e) {
        if (!imp) return;
        vykresliImportUvod((e && e.message) || 'Soubor se nepovedlo přečíst.');
      });
    };
    ctecka.onerror = function () { hlaska('Soubor se nepovedlo přečíst.'); };
    ctecka.readAsArrayBuffer(soubor);
  }

  function zpracujImport() {
    var FI = global.FImport;
    var s = D.stav();
    var r;
    try { r = FI.rozeber(imp.text, imp.vynucene, imp.format); }
    catch (e) { r = { pohyby: [], chyba: 'Tomuhle souboru nerozumím.', hlavicka: [] }; }
    imp.rozbor = r;

    var hotovost = uctyHotovosti();
    FI.zatrid(r.pohyby, s.pravidla, function (id, typ) {
      var k = D.najdi(s.kategorie, id);
      return !!k && k.typ === typ;
    }, hotovost ? hotovost.id : null);
    FI.otisky(r.pohyby);

    // co už v appce je: stejný otisk = stejný řádek ze staršího výpisu
    var zname = {};
    s.transakce.forEach(function (t) { if (t.imp) zname[t.imp] = true; });
    // a co jste možná zapsali ručně: stejná částka ±3 dny na stejném účtu
    var rucni = s.transakce.filter(function (t) { return !t.imp && t.ucet === imp.ucet && t.typ !== 'prevod'; });
    var pouzite = {};
    r.pohyby.forEach(function (p) {
      p.uz = !!zname[p.otisk];
      p.vybrano = !p.uz;
      p.mozna = null;
      if (p.uz || p.prevod) return;
      for (var i = 0; i < rucni.length; i++) {
        var t = rucni[i];
        if (pouzite[t.id] || t.typ !== p.typ || Math.abs(t.castka - p.suma) > 0.01) continue;
        if (Math.abs(D.zISO(t.datum) - D.zISO(p.datum)) > 3 * DEN_MS) continue;
        pouzite[t.id] = true;
        p.mozna = t; p.vybrano = false;
        break;
      }
    });
    r.pohyby.sort(function (a, b) { return a.datum < b.datum ? 1 : (a.datum > b.datum ? -1 : 0); });
    imp.pohyby = r.pohyby;
    vykresliImportSeznam();
  }

  function potrebujePomoc(p) {
    return !p.prevod && !p.zdrojKat && !p.rucne;
  }

  function radekImportu(p, i) {
    var zn = p.typ === 'prijem' ? 'prijem' : 'vydaj';
    var katHtml;
    if (p.prevod) {
      var h = uctyHotovosti();
      katHtml = ik('ui-prevod') + '<span>Výběr → ' + esc(h ? h.nazev : 'hotovost') + '</span>';
    } else {
      var k = D.kategorie(p.kat);
      katHtml = ik(k.ikona) + '<span>' + esc(p.kat ? k.nazev : 'Vybrat kategorii') + '</span>';
    }
    var barva = p.prevod ? 'var(--ink-3)' : G.barva(D.kategorie(p.kat).barva);
    var pod = D.popisDne(p.datum).split(' · ')[0];
    if (p.mozna) pod += ' · už zapsáno ručně' + (p.mozna.pozn ? ' („' + esc(p.mozna.pozn) + '“)' : '') + '?';
    return '<div class="imp-radek' + (p.vybrano ? '' : ' vypnuto') + '">' +
      '<button class="imp-check" data-impprepni="' + i + '" aria-label="Zapsat tento pohyb">' +
        (p.vybrano ? ik('ui-ok') : '') + '</button>' +
      '<span class="imp-text"><span class="imp-popis">' + esc(p.popis) + '</span>' +
        '<span class="imp-pod">' + pod + '</span></span>' +
      '<span class="imp-castka ' + zn + '">' + (p.typ === 'prijem' ? '+' : '−') + esc(cislo(p.suma)) + '</span>' +
      '<button class="imp-kat' + (potrebujePomoc(p) ? ' imp-kat-chybi' : '') + '" data-impkat="' + i +
        '" style="--kat-barva:' + barva + '">' + katHtml + ik('ui-dolu') + '</button>' +
    '</div>';
  }

  function vykresliImportSeznam() {
    var r = imp.rozbor;
    var pohyby = imp.pohyby;
    var nove = pohyby.filter(function (p) { return !p.uz; });
    var uzPocet = pohyby.length - nove.length;
    var u = D.ucet(imp.ucet);

    var html = '<div class="karta imp-souhrn">' +
      '<div class="imp-soubor">' + ik('dokument') + '<b>' + esc(imp.nazev || 'výpis') + '</b></div>';
    if (pohyby.length) {
      var od = pohyby[pohyby.length - 1].datum, doKdy = pohyby[0].datum;
      html += '<div>' + pohyby.length + ' ' + tvarPohybu(pohyby.length) + ' · ' +
        esc(D.popisDne(od).split(' · ')[0]) + ' – ' + esc(D.popisDne(doKdy).split(' · ')[0]) +
        ' · do účtu <b>' + esc(u.nazev) + '</b></div>';
      if (uzPocet) html += '<div class="imp-uz">' + uzPocet + ' ' + tvarPohybu(uzPocet) +
        ' už v appce je, ty se znovu nezapíšou.</div>';
    }
    if (r.chyba) html += '<div class="imp-chyba">' + esc(r.chyba) + '</div>';
    html += '</div>';

    // ruční přiřazení sloupců, kdyby odhad nesedl
    if (r.format !== 'GPC' && r.hlavicka && r.hlavicka.length) {
      var volby = function (vybrany, prazdna) {
        return (prazdna ? '<option value="">— nic —</option>' : '') + r.hlavicka.map(function (h, i) {
          return '<option value="' + i + '"' + (i === vybrany ? ' selected' : '') + '>' +
            esc(h || ('Sloupec ' + (i + 1))) + '</option>';
        }).join('');
      };
      var sl = r.sloupce || {};
      html += '<details class="podrobnosti imp-sloupce"' + (r.chyba ? ' open' : '') + '>' +
        '<summary><span>Sloupce ze souboru</span><span class="podrobnosti-souhrn">kdyby něco nesedělo</span></summary>' +
        '<label class="radek-pole"><span>Datum</span><select class="pole" data-impsloupec="datum">' + volby(sl.datum, false) + '</select></label>' +
        '<label class="radek-pole"><span>Částka</span><select class="pole" data-impsloupec="castka">' + volby(sl.castka, false) + '</select></label>' +
        '<label class="radek-pole"><span>Kdo / co</span><select class="pole" data-impsloupec="nazev">' + volby(sl.nazev, true) + '</select></label>' +
        '<label class="radek-pole"><span>Zpráva</span><select class="pole" data-impsloupec="zprava">' + volby(sl.zprava, true) + '</select></label>' +
      '</details>';
    }

    var pomoc = [], hotove = [], mozna = [];
    pohyby.forEach(function (p, i) {
      if (p.uz) return;
      if (p.mozna) mozna.push(radekImportu(p, i));
      else if (potrebujePomoc(p)) pomoc.push(radekImportu(p, i));
      else hotove.push(radekImportu(p, i));
    });
    if (pomoc.length) {
      html += '<div class="den-nadpis"><span>Nevím, kam patří (' + pomoc.length + ')</span></div>' +
        '<p class="napoveda imp-rada">Klepněte na kategorii. Stejný obchod se zařadí i jinde a příště už to appka bude vědět.</p>' +
        '<div class="skupina-karta">' + pomoc.join('') + '</div>';
    }
    if (hotove.length) {
      html += '<div class="den-nadpis"><span>Roztříděno samo (' + hotove.length + ')</span></div>' +
        '<div class="skupina-karta">' + hotove.join('') + '</div>';
    }
    if (mozna.length) {
      html += '<div class="den-nadpis"><span>Možná už zapsané ručně (' + mozna.length + ')</span></div>' +
        '<p class="napoveda imp-rada">Tyhle se nezapíšou, dokud je nezaškrtnete.</p>' +
        '<div class="skupina-karta">' + mozna.join('') + '</div>';
    }
    if (!nove.length && pohyby.length) {
      html += '<p class="prazdno">Všechno z tohohle výpisu už v appce je.</p>';
    }
    html += '<button class="tl tl-siroke" id="import-jiny">Vybrat jiný soubor</button>';

    $('import-telo').innerHTML = html;
    obnovPatuImportu();
  }

  function obnovPatuImportu() {
    var n = imp.pohyby.filter(function (p) { return p.vybrano && !p.uz; }).length;
    $('import-pata').hidden = !imp.pohyby.length;
    $('import-zapsat').disabled = n === 0;
    $('import-zapsat').textContent = n ? 'Zapsat ' + n + ' ' + tvarPohybu(n) : 'Není co zapsat';
  }

  function vyberKategoriiImportu(i) {
    var p = imp.pohyby[i];
    if (!p) return;
    vyberImport = i;
    var hotovost = p.typ === 'vydaj' ? uctyHotovosti() : null;
    dialog({
      titulek: 'Kam to patří?',
      telo: '<p><b>' + esc(p.popis) + '</b> · ' + esc(cislo(p.suma)) + ' ' + esc(mena()) + '</p>' +
        '<div class="kat-mrizka">' + D.kategoriePodlePouziti(p.typ).map(function (k) {
          return '<button class="kat-tl' + (!p.prevod && k.id === p.kat ? ' vybrano' : '') +
            '" data-impvyber="' + esc(k.id) + '" style="--kat-barva:' + G.barva(k.barva) + '">' +
            ik(k.ikona) + '<span>' + esc(k.nazev) + '</span></button>';
        }).join('') + '</div>' +
        (hotovost ? '<button class="tl tl-siroke tl-radek" style="margin-top:0" data-impvyber="__prevod">' +
          ik('ui-prevod') + ' Výběr hotovosti → ' + esc(hotovost.nazev) + '</button>' : ''),
      ano: 'Zavřít', bezZruseni: true
    });
  }

  function nastavKategoriiImportu(i, kat) {
    var p = imp.pohyby[i];
    var prevod = kat === '__prevod';
    function prirad(x) {
      x.prevod = prevod;
      x.kat = prevod ? null : kat;
      x.rucne = true;
      if (!x.uz && !x.mozna) x.vybrano = true;
    }
    prirad(p);
    var dalsi = 0;
    if (p.klic) {
      if (!prevod) imp.nauceno[p.klic] = kat;
      imp.pohyby.forEach(function (x) {
        if (x === p || x.rucne || x.klic !== p.klic || x.typ !== p.typ) return;
        prirad(x);
        dalsi++;
      });
    }
    zavriDialog();
    vykresliImportSeznam();
    if (dalsi) hlaska('Zařazeno i u ' + dalsi + ' dalších ' + (dalsi === 1 ? 'platby' : 'plateb') + ' stejného obchodu.');
  }

  function zapisImport() {
    var s = D.stav();
    var hotovost = uctyHotovosti();
    var vybrane = imp.pohyby.filter(function (p) { return p.vybrano && !p.uz; });
    if (!vybrane.length) return;
    vybrane.forEach(function (p) {
      var prevod = p.prevod && hotovost;
      D.pridejTransakci({
        datum: p.datum, castka: p.suma,
        typ: prevod ? 'prevod' : p.typ,
        kat: prevod ? null : p.kat,
        ucet: imp.ucet,
        ucetDo: prevod ? hotovost.id : null,
        pozn: p.popis,
        imp: p.otisk,
        klic: p.klic || null
      });
    });
    Object.keys(imp.nauceno).forEach(function (k) { s.pravidla[k] = imp.nauceno[k]; });
    s.nastaveni.posledniImport = D.dnesISO();
    s.nastaveni.importUcet = imp.ucet;
    D.ulozHned();

    var ucetId = imp.ucet;
    var n = vybrane.length;
    // ukázat měsíc, kam spadá nejnovější pohyb
    var nej = vybrane.reduce(function (a, p) { return p.datum > a ? p.datum : a; }, '');
    rok = +nej.slice(0, 4); mesic = +nej.slice(5, 7) - 1;
    zavriImport();
    jdi('prehled');

    var u = D.ucet(ucetId);
    var z = Math.round(D.zustatekUctu(ucetId) * 100) / 100;
    dialog({
      titulek: 'Zapsáno ' + n + ' ' + tvarPohybu(n),
      telo: '<p>Ještě zůstatek: podle appky je teď na účtu <b>' + esc(u.nazev) + '</b> ' +
        esc(kc(z)) + '. Když banka ukazuje jinou částku, přepište ji.</p>' +
        '<input class="pole" id="d-zustatek" inputmode="decimal" value="' + z + '">',
      ano: 'Uložit', ne: 'Sedí',
      potvrd: function () {
        var nova = parsujCastku($('d-zustatek').value);
        if (isNaN(nova)) { hlaska('Tohle není částka.'); return false; }
        if (Math.abs(nova - z) > 0.004) {
          var uc = D.najdi(D.stav().ucty, ucetId);
          if (uc) uc.pocatek = Math.round(((Number(uc.pocatek) || 0) + nova - z) * 100) / 100;
          D.ulozHned();
          hlaska('Zůstatek srovnán s bankou.');
        }
        return true;
      }
    });
  }

  function zapojImport() {
    naSlys($('import-zavrit'), 'click', zavriImport);
    naSlys($('import-zapsat'), 'click', zapisImport);
    naSlys($('pole-vypis'), 'change', function () {
      var soubor = this.files && this.files[0];
      this.value = '';
      if (soubor && imp) nactiSouborVypisu(soubor);
    });
    naSlys($('import-telo'), 'click', function (e) {
      if (!imp) return;
      var u = e.target.closest('[data-impucet]');
      if (u) { imp.ucet = u.getAttribute('data-impucet'); vykresliImportUvod(); return; }
      var bk = e.target.closest('[data-impbanka]');
      if (bk) {
        imp.banka = bk.getAttribute('data-impbanka');
        D.stav().nastaveni.banka = imp.banka; D.uloz();
        vykresliImportUvod(); return;
      }
      if (e.target.closest('#import-vybrat') || e.target.closest('#import-jiny')) {
        $('pole-vypis').click(); return;
      }
      var pr = e.target.closest('[data-impprepni]');
      if (pr) {
        var p = imp.pohyby[Number(pr.getAttribute('data-impprepni'))];
        if (p) { p.vybrano = !p.vybrano; vykresliImportSeznam(); }
        return;
      }
      var k = e.target.closest('[data-impkat]');
      if (k) vyberKategoriiImportu(Number(k.getAttribute('data-impkat')));
    });
    naSlys($('import-telo'), 'change', function (e) {
      var sel = e.target.closest('[data-impsloupec]');
      if (!sel || !imp) return;
      imp.vynucene = {};
      vse('[data-impsloupec]', $('import-telo')).forEach(function (x) {
        imp.vynucene[x.getAttribute('data-impsloupec')] = x.value;
      });
      zpracujImport();
    });
    naSlys($('dialog-telo'), 'click', function (e) {
      if (vyberImport === null || !imp) return;
      var b = e.target.closest('[data-impvyber]');
      if (b) nastavKategoriiImportu(vyberImport, b.getAttribute('data-impvyber'));
    });
  }


  /* =================================================================
     ZABEZPEČENÍ
     ================================================================= */

  function vykresliZabezpeceni() {
    var Z = global.FZamek;
    var html = '';

    if (!Z.podporovano()) {
      html = '<p class="napoveda napoveda-nahore">Zámek potřebuje zabezpečené připojení (https) ' +
        'nebo localhost. Tady teď běží aplikace bez něj, takže se šifrovat nedá. ' +
        'Přes adresu na GitHub Pages zámek funguje.</p>';
      $('stav-zamku').innerHTML = html;
      return;
    }

    if (!Z.jeZapnut()) {
      html = '<p class="napoveda napoveda-nahore">Zámek je vypnutý – data leží v telefonu ' +
        'nezašifrovaná. Po zapnutí se zamknou PINem.</p>' +
        '<button class="tl tl-hlavni tl-siroke" style="margin-top:0" id="tl-zapni-zamek">Zapnout zámek</button>';
      $('stav-zamku').innerHTML = html;
      return;
    }

    var maBio = Z.maBiometriku();
    var prodleva = D.stav().nastaveni.zamekPo;
    if (typeof prodleva !== 'number') prodleva = 60000;

    html =
      '<div class="zamek-radek"><span><b>PIN</b><i>Zamyká a šifruje data v telefonu.</i></span>' +
        '<button class="tl" data-zamek="pin">Změnit</button></div>';

    if (Z.biometrikaMozna()) {
      html += '<div class="zamek-radek"><span><b>Otisk nebo obličej</b><i>' +
        (maBio ? 'Zapnuto – PIN zůstává jako záloha.' : 'Rychlejší odemykání, PIN zůstává.') +
        '</i></span><button class="tl" data-zamek="' + (maBio ? 'bio-pryc' : 'bio') + '">' +
        (maBio ? 'Vypnout' : 'Zapnout') + '</button></div>';
    }

    html += '<div class="zamek-radek"><span><b>Zamknout po</b><i>Když je aplikace na pozadí.</i></span>' +
      '<select class="pole" id="pole-zamekpo">' +
        [[0, 'hned'], [30000, '30 s'], [60000, '1 min'], [300000, '5 min'], [1800000, '30 min']]
          .map(function (v) {
            return '<option value="' + v[0] + '"' + (prodleva === v[0] ? ' selected' : '') +
              '>' + v[1] + '</option>';
          }).join('') +
      '</select></div>';

    html += '<div class="tlacitka-radek" style="margin-top:12px">' +
      '<button class="tl" data-zamek="ted">Zamknout teď</button>' +
      '<button class="tl tl-nebezpeci" data-zamek="vypnout">Vypnout zámek</button></div>' +
      '<p class="napoveda">⚠ Zapomenutý PIN nejde obnovit – data by byla nenávratně pryč. ' +
      'Držte si zálohu.</p>';

    $('stav-zamku').innerHTML = html;
  }

  function dialogZmenyPinu() {
    var Z = global.FZamek;
    dialog({
      titulek: 'Změnit PIN',
      telo:
        '<label>Současný PIN</label><input class="pole" id="d-stary" type="password" inputmode="numeric" maxlength="' + Z.DELKA_MAX + '">' +
        '<label>Nový PIN (' + Z.DELKA_MIN + ' až ' + Z.DELKA_MAX + ' číslic)</label><input class="pole" id="d-novy" type="password" inputmode="numeric" maxlength="' + Z.DELKA_MAX + '">' +
        '<label>Nový PIN znovu</label><input class="pole" id="d-novy2" type="password" inputmode="numeric" maxlength="' + Z.DELKA_MAX + '">',
      ano: 'Změnit',
      zamer: true,
      potvrd: function () {
        var stary = $('d-stary').value, novy = $('d-novy').value, novy2 = $('d-novy2').value;
        if (novy.length < Z.DELKA_MIN || !/^[0-9]+$/.test(novy)) {
          hlaska('Nový PIN musí mít aspoň ' + Z.DELKA_MIN + ' číslice.'); return false;
        }
        if (novy !== novy2) { hlaska('Nové PINy se neshodují.'); return false; }
        Z.zmenPin(stary, novy).then(function () {
          hlaska('PIN změněn.');
        }).catch(function () {
          hlaska('Současný PIN nesedí.');
        });
        return true;
      }
    });
  }

  function obsluhaZabezpeceni(co) {
    var Z = global.FZamek;
    if (co === 'pin') { dialogZmenyPinu(); return; }
    if (co === 'ted') { Z.zamkni(); return; }
    if (co === 'bio') {
      hlaska('Potvrďte otiskem nebo obličejem…');
      Z.zapniBiometriku().then(function () {
        vykresliZabezpeceni();
        hlaska('Hotovo, teď půjde odemknout otiskem.');
      }).catch(function (e) {
        hlaska(String(e && e.message) === 'NEPODPORUJE'
          ? 'Tenhle telefon odemykání otiskem pro aplikaci v prohlížeči nepodporuje.'
          : 'Nepovedlo se, zůstává PIN.');
      });
      return;
    }
    if (co === 'bio-pryc') {
      Z.vypniBiometriku().then(function () {
        vykresliZabezpeceni();
        hlaska('Odemykání otiskem vypnuto.');
      });
      return;
    }
    if (co === 'vypnout') {
      dialog({
        titulek: 'Vypnout zámek?',
        telo: '<p>Data se uloží <b>nezašifrovaná</b> a aplikace se přestane ptát na PIN. ' +
          'Kdokoli, kdo se dostane k telefonu, uvidí vaše finance.</p>',
        ano: 'Vypnout', nebezpeci: true,
        potvrd: function () {
          Z.vypniZamek().then(function () {
            vykresliNastaveni();
            hlaska('Zámek vypnutý.');
          });
          return true;
        }
      });
    }
  }

  /* =================================================================
     TÉMA
     ================================================================= */

  function nastavTema(tema) {
    if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', tema);
    var tmave = tema === 'dark' ||
      (tema !== 'light' && global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tmave ? '#2b3597' : '#4b5ff0');
  }

  /* =================================================================
     OBSLUHA UDÁLOSTÍ
     ================================================================= */

  function zapojUdalosti() {

    // spodní lišta a odkazy „Vše / Upravit“
    document.addEventListener('click', function (e) {
      var cil = e.target.closest ? e.target.closest('[data-jdi]') : null;
      if (cil) { jdi(cil.getAttribute('data-jdi')); }
    });

    // měsíc
    naSlys($('mesic-zpet'), 'click', function () { posunMesic(-1); });
    naSlys($('mesic-vpred'), 'click', function () { posunMesic(1); });
    naSlys($('mesic-nazev'), 'click', otevriVyberMesice);

    // přidat – klepnutí otevře formulář, dlouhý stisk nabídne šablony
    naSlys($('tl-pridat'), 'click', function () {
      if (bylDlouhy) { bylDlouhy = false; return; }
      zaloz('vydaj'); otevriZaznam();
    });
    hlidejDlouhyStisk($('tl-pridat'), otevriSablony);

    naSlys($('sablony-zrusit'), 'click', function () { $('prekryv-sablony').hidden = true; });
    naSlys($('sablony-prazdny'), 'click', function () {
      $('prekryv-sablony').hidden = true;
      zaloz('vydaj'); otevriZaznam();
    });
    naSlys($('prekryv-sablony'), 'click', function (e) {
      if (e.target === $('prekryv-sablony')) $('prekryv-sablony').hidden = true;
    });
    naSlys($('seznam-sablon'), 'click', function (e) {
      var b = e.target.closest('[data-sablona]');
      if (b) zapisZeSablony(Number(b.getAttribute('data-sablona')));
    });

    // dnes a tento týden -> historie za to období
    naSlys($('hero-dnes'), 'click', function () { rozsahDoHistorie('dnes'); });
    naSlys($('hero-tyden'), 'click', function () { rozsahDoHistorie('tyden'); });

    // formulář záznamu
    naSlys($('zaznam-zrusit'), 'click', zavriZaznam);
    naSlys($('zaznam-ulozit'), 'click', ulozZaznam);
    naSlys($('zaznam-smazat'), 'click', smazZaznam);
    naSlys($('prekryv-zaznam'), 'click', function (e) {
      if (e.target === $('prekryv-zaznam')) zavriZaznam();
    });
    naSlys($('pole-castka'), 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ulozZaznam(); }
    });
    naSlys($('pole-pozn'), 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ulozZaznam(); }
    });
    naSlys($('pole-pozn'), 'input', function () { if (zaznam) vykresliSouhrnPodrobnosti(); });
    naSlys($('pole-datum'), 'change', function () { if (zaznam) vykresliSouhrnPodrobnosti(); });

    // start, připomínka a tlačítka „Načíst výpis“
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-akce]') : null;
      if (!a) return;
      var co = a.getAttribute('data-akce');
      if (co === 'import') otevriImport();
      else if (co === 'pridat') { zaloz('vydaj'); otevriZaznam(); }
    });
    naSlys($('rychle-chipy'), 'click', function (e) {
      var b = e.target.closest('[data-rychly]');
      if (b) zapisZeSablony(Number(b.getAttribute('data-rychly')));
    });

    naSlys($('prepinac-typ'), 'click', function (e) {
      var b = e.target.closest('[data-typ]');
      if (!b || !zaznam) return;
      zaznam.typ = b.getAttribute('data-typ');
      if (zaznam.typ === 'prevod') $('zapis-podrobnosti').open = true;
      obnovTypZaznamu();
    });

    naSlys($('vyber-kategorie'), 'click', function (e) {
      if (!zaznam) return;
      if (e.target.closest('#kat-dalsi')) { zaznam.vsechnyKat = true; obnovTypZaznamu(); return; }
      var b = e.target.closest('[data-vyberkat]');
      if (!b) return;
      var vybrana = b.getAttribute('data-vyberkat');
      if (rychlyZapis()) {
        zaznam.kat[zaznam.typ] = vybrana;
        var c = parsujCastku($('pole-castka').value);
        if (c > 0) { ulozZaznam(); return; }
        obnovTypZaznamu();
        hlaska('Napište nejdřív částku.');
        $('pole-castka').focus();
        return;
      }
      if (zaznam.katProPolozku !== null && zaznam.katProPolozku !== undefined) {
        sesbirejPolozky();
        if (zaznam.polozky[zaznam.katProPolozku]) {
          zaznam.polozky[zaznam.katProPolozku].kat = vybrana;
        }
        zaznam.katProPolozku = null;
      } else {
        zaznam.kat[zaznam.typ] = vybrana;
      }
      obnovTypZaznamu();
    });
    naSlys($('vyber-uctu'), 'click', function (e) {
      var b = e.target.closest('[data-vyberucet]');
      if (!b || !zaznam) return;
      zaznam.ucet = b.getAttribute('data-vyberucet');
      obnovTypZaznamu();
    });
    naSlys($('vyber-uctu-do'), 'click', function (e) {
      var b = e.target.closest('[data-vyberucetdo]');
      if (!b || !zaznam) return;
      zaznam.ucetDo = b.getAttribute('data-vyberucetdo');
      obnovTypZaznamu();
    });

    // dialog
    naSlys($('dialog-ano'), 'click', function () {
      if (!dialogPotvrd) { zavriDialog(); return; }
      var vysledek = dialogPotvrd();
      if (vysledek !== false) { zavriDialog(); vykresli(); }
    });
    naSlys($('dialog-ne'), 'click', zavriDialog);
    naSlys($('dialog-telo'), 'click', klikVeVyberuMesice);
    naSlys($('dialog-telo'), 'click', klikVeVyberuIkony);

    // položky nákupu
    naSlys($('tl-polozky'), 'click', function () { if (zaznam) zapnuPolozky(); });
    naSlys($('tl-zrusit-polozky'), 'click', function () { if (zaznam) vypniPolozky(); });
    naSlys($('tl-pridat-polozku'), 'click', function () {
      if (!zaznam) return;
      sesbirejPolozky();
      zaznam.polozky.push({ nazev: '', castka: '', kat: zaznam.kat[zaznam.typ] });
      vykresliPolozky();
      var pole = vse('[data-polozka-nazev]');
      if (pole.length) pole[pole.length - 1].focus();
    });
    naSlys($('seznam-polozek'), 'click', function (e) {
      if (!zaznam) return;
      var kat = e.target.closest('[data-polozka-kat]');
      if (kat) {
        sesbirejPolozky();
        zaznam.katProPolozku = Number(kat.getAttribute('data-polozka-kat'));
        obnovTypZaznamu();
        $('skupina-kategorie').scrollIntoView({ block: 'nearest' });
        return;
      }
      var pryc = e.target.closest('[data-polozka-pryc]');
      if (pryc) {
        sesbirejPolozky();
        zaznam.polozky.splice(Number(pryc.getAttribute('data-polozka-pryc')), 1);
        if (!zaznam.polozky.length) {
          zaznam.polozky.push({ nazev: '', castka: '', kat: zaznam.kat[zaznam.typ] });
        }
        vykresliPolozky();
      }
    });
    naSlys($('seznam-polozek'), 'input', function (e) {
      if (!zaznam || !e.target.hasAttribute('data-polozka-castka')) return;
      sesbirejPolozky();
      var soucet = D.soucetPolozek(zaznam.polozky);
      $('polozky-soucet').textContent = soucet ? kc(soucet) : '';
      $('pole-castka').value = soucet ? String(Math.round(soucet * 100) / 100) : '';
    });

    // účtenka
    naSlys($('uctenka-obal'), 'click', function (e) {
      if (!zaznam) return;
      if (e.target.closest('[data-uctenka-pridat]')) { $('pole-fotka').click(); return; }
      if (e.target.closest('[data-uctenka-pryc]')) {
        zapomenFotku();
        zaznam.fotkaUrl = null;
        zaznam.fotkaBajty = null;
        vykresliUctenku();
        return;
      }
      if (e.target.closest('[data-uctenka-velka]')) ukazFotku(zaznam.fotkaUrl);
    });
    naSlys($('pole-fotka'), 'change', function () {
      var soubor = this.files && this.files[0];
      this.value = '';
      if (!soubor || !zaznam) return;
      hlaska('Zpracovávám fotku…');
      zmensObrazek(soubor).then(function (bajty) {
        if (!zaznam) return;
        zapomenFotku();
        zaznam.fotkaBajty = bajty;
        zaznam.fotkaUrl = bajtyNaUrl(bajty);
        vykresliUctenku();
        hlaska('Účtenka připravena, uloží se se záznamem.');
      }).catch(function () { hlaska('Fotku se nepovedlo načíst.'); });
    });
    naSlys($('fotka-zavrit'), 'click', schovejFotku);
    naSlys($('prekryv-fotka'), 'click', function (e) {
      if (e.target === $('prekryv-fotka')) schovejFotku();
    });

    zapojImport();

    // grafy
    naSlys($('graf-ucty'), 'click', function (e) {
      var b = e.target.closest('[data-kat]');
      if (!b) return;
      filtr.ucet = b.getAttribute('data-kat');
      filtr.typ = 'vydaj'; filtr.rozsah = 'mesic'; filtr.kat = null; filtr.text = '';
      obnovChipy();
      jdi('historie');
    });
    naSlys($('graf-prijmy'), 'click', function (e) {
      var b = e.target.closest('[data-kat]');
      if (!b || b.getAttribute('data-kat') === '__ostatni') return;
      filtr.kat = b.getAttribute('data-kat');
      filtr.typ = 'prijem'; filtr.rozsah = 'mesic'; filtr.ucet = null; filtr.text = '';
      obnovChipy();
      jdi('historie');
    });
    naSlys($('graf-dny'), 'click', function (e) {
      var b = e.target.closest('[data-den]');
      if (b) hlaska(b.getAttribute('title'));
    });
    naSlys($('prekryv-dialog'), 'click', function (e) {
      if (e.target === $('prekryv-dialog')) zavriDialog();
    });

    // přehled: klepnutí do grafu
    naSlys($('graf-kategorie'), 'click', function (e) {
      var b = e.target.closest('[data-kat]');
      if (!b) return;
      var kat = b.getAttribute('data-kat');
      if (kat === '__ostatni') return;
      filtr.kat = kat; filtr.typ = 'vydaj'; filtr.rozsah = 'mesic'; filtr.text = '';
      obnovChipy();
      jdi('historie');
    });
    naSlys($('graf-mesice'), 'click', function (e) {
      var b = e.target.closest('[data-mesic]');
      if (!b) return;
      mesicVGrafu = Number(b.getAttribute('data-mesic'));
      vse('.mesic-sloupec').forEach(function (s) {
        s.classList.toggle('akt', s === b);
      });
      ctiMesic(D.poslednichMesicu(rok, mesic, 6), mesicVGrafu);
    });
    naSlys($('posledni-pohyby'), 'click', klikNaTransakci);
    naSlys($('seznam-obchodu'), 'click', function (e) {
      var b = e.target.closest('[data-obchod]');
      if (!b) return;
      filtr = { typ: 'vydaj', rozsah: 'mesic', text: b.getAttribute('data-obchod').toLowerCase(), kat: null, ucet: null };
      obnovChipy();
      jdi('historie');
    });
    naSlys($('seznam-transakci'), 'click', klikNaTransakci);
    naSlys($('seznam-rozpoctu'), 'click', function () { jdi('nastaveni'); });

    // historie: filtry
    naSlys($('hledani'), 'input', function () {
      filtr.text = this.value;
      vykresliHistorii();
    });
    naSlys($('chipy-typ'), 'click', function (e) {
      var b = e.target.closest('[data-typ]');
      if (!b) return;
      filtr.typ = b.getAttribute('data-typ');
      obnovChipy(); vykresliHistorii();
    });
    naSlys($('chipy-rozsah'), 'click', function (e) {
      var b = e.target.closest('[data-rozsah]');
      if (!b) return;
      filtr.rozsah = b.getAttribute('data-rozsah');
      obnovChipy(); vykresliHistorii();
    });
    naSlys($('filtr-aktivni'), 'click', function (e) {
      var b = e.target.closest('[data-zrus]');
      if (!b) return;
      var co = b.getAttribute('data-zrus');
      if (co === 'rozsah') { filtr.rozsah = 'mesic'; obnovChipy(); }
      else filtr[co] = null;
      vykresliHistorii();
    });

    // účty
    naSlys($('seznam-uctu'), 'click', function (e) {
      var b = e.target.closest('[data-ucet]');
      if (!b) return;
      dialogUctu(b.getAttribute('data-ucet'));
    });
    naSlys($('tl-novy-ucet'), 'click', function () { dialogUctu(null); });
    naSlys($('tl-prevod'), 'click', dialogPrevodu);

    // nastavení
    naSlys($('editor-rozpoctu'), 'change', function (e) {
      var p = e.target.closest('[data-rozpocet]');
      if (!p) return;
      var s = D.stav();
      var v = parsujCastku(p.value);
      if (!(v > 0)) { delete s.rozpocty[p.getAttribute('data-rozpocet')]; p.value = ''; }
      else s.rozpocty[p.getAttribute('data-rozpocet')] = Math.round(v * 100) / 100;
      D.ulozHned();
    });
    naSlys($('chipy-kat-typ'), 'click', function (e) {
      var b = e.target.closest('[data-kattyp]');
      if (!b) return;
      katTypVEditoru = b.getAttribute('data-kattyp');
      vykresliNastaveni();
    });
    naSlys($('editor-kategorii'), 'click', function (e) {
      var b = e.target.closest('[data-upravkat]');
      if (!b) return;
      dialogKategorie(b.getAttribute('data-upravkat'));
    });
    naSlys($('tl-nova-kategorie'), 'click', function () { dialogKategorie(null); });
    naSlys($('tl-nova-pravidelna'), 'click', dialogPravidelne);
    naSlys($('stav-pravidel'), 'click', function (e) {
      if (e.target.id !== 'tl-zapomen-pravidla') return;
      dialog({
        titulek: 'Zapomenout naučené obchody?',
        telo: '<p>Zapsané záznamy zůstanou. Jen příští výpis se bude třídit znovu podle vestavěného slovníku.</p>',
        ano: 'Zapomenout', nebezpeci: true,
        potvrd: function () { D.stav().pravidla = {}; D.ulozHned(); hlaska('Zapomenuto.'); return true; }
      });
    });
    naSlys($('seznam-pravidelnych'), 'click', function (e) {
      var b = e.target.closest('[data-smazpravidelnou]');
      if (!b) return;
      var id = b.getAttribute('data-smazpravidelnou');
      var s = D.stav();
      var i = s.pravidelne.map(function (p) { return p.id; }).indexOf(id);
      if (i >= 0) s.pravidelne.splice(i, 1);
      D.ulozHned();
      vykresliNastaveni();
      hlaska('Pravidelná platba zrušena. Zapsané záznamy zůstávají.');
    });
    naSlys($('chipy-tema'), 'click', function (e) {
      var b = e.target.closest('[data-tema]');
      if (!b) return;
      D.stav().nastaveni.tema = b.getAttribute('data-tema');
      D.ulozHned();
      nastavTema(D.stav().nastaveni.tema);
      vykresliNastaveni();
    });
    // zabezpečení
    naSlys($('stav-zamku'), 'click', function (e) {
      var b = e.target.closest('[data-zamek]');
      if (b) { obsluhaZabezpeceni(b.getAttribute('data-zamek')); return; }
      if (e.target.id === 'tl-zapni-zamek') global.FZamek.zapniZamek();
    });
    naSlys($('stav-zamku'), 'change', function (e) {
      if (e.target.id !== 'pole-zamekpo') return;
      D.stav().nastaveni.zamekPo = Number(e.target.value);
      D.ulozHned();
      hlaska('Uloženo.');
    });

    naSlys($('pole-mena'), 'change', function () {
      D.stav().nastaveni.mena = this.value.trim() || 'Kč';
      D.ulozHned();
      vykresli();
    });

    // data
    naSlys($('tl-zaloha'), 'click', function () {
      if (stahni('moje-finance-' + razitko() + '.json', D.doJson(), 'application/json')) {
        hlaska('Záloha stažena.');
      }
    });
    naSlys($('tl-csv'), 'click', function () {
      if (!D.stav().transakce.length) { hlaska('Není co exportovat.'); return; }
      if (stahni('moje-finance-' + razitko() + '.csv', D.doCsv(), 'text/csv;charset=utf-8')) {
        hlaska('CSV staženo.');
      }
    });
    naSlys($('tl-obnova'), 'click', function () { $('pole-soubor').click(); });
    naSlys($('pole-soubor'), 'change', function () {
      var soubor = this.files && this.files[0];
      if (!soubor) return;
      var ctecka = new FileReader();
      ctecka.onload = function () {
        dialog({
          titulek: 'Načíst zálohu?',
          telo: '<p>Současná data budou <b>nahrazena</b> obsahem souboru <b>' + esc(soubor.name) + '</b>.</p>',
          ano: 'Načíst', nebezpeci: true,
          potvrd: function () {
            try {
              var pocet = D.nactiZalohu(String(ctecka.result));
              nastavTema(D.stav().nastaveni.tema || 'auto');
              hlaska('Načteno ' + pocet + ' ' + tvarZaznamu(pocet) + '.');
            } catch (err) {
              hlaska('Soubor se nepovedlo přečíst.');
            }
            return true;
          }
        });
      };
      ctecka.readAsText(soubor);
      this.value = '';
    });
    naSlys($('tl-vymaz'), 'click', function () {
      dialog({
        titulek: 'Smazat všechna data?',
        telo: '<p>Zmizí všechny záznamy, účty i kategorie a vrátí se výchozí nastavení. ' +
          'Tohle <b>nejde vrátit zpět</b> – nejdřív si stáhněte zálohu.</p>',
        ano: 'Smazat vše', nebezpeci: true,
        potvrd: function () {
          D.vymazVse();
          nastavTema('auto');
          hlaska('Hotovo, začínáme načisto.');
          jdi('prehled');
          return true;
        }
      });
    });

    // klávesa Escape
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('prekryv-fotka').hidden) schovejFotku();
      else if (!$('prekryv-dialog').hidden) zavriDialog();
      else if (!$('prekryv-import').hidden) zavriImport();
      else if (!$('prekryv-sablony').hidden) $('prekryv-sablony').hidden = true;
      else if (!$('prekryv-zaznam').hidden) zavriZaznam();
    });
  }

  function klikNaTransakci(e) {
    var b = e.target.closest('[data-transakce]');
    if (!b) return;
    var t = D.najdi(D.stav().transakce, b.getAttribute('data-transakce'));
    if (!t) return;
    zalozZTransakce(t);
    otevriZaznam();
  }

  function ukazFotku(url) {
    if (!url) return;
    $('fotka-velka').src = url;
    $('prekryv-fotka').hidden = false;
  }

  function schovejFotku() {
    $('prekryv-fotka').hidden = true;
    $('fotka-velka').removeAttribute('src');
  }

  function rozsahDoHistorie(r) {
    filtr.rozsah = r; filtr.typ = 'vse'; filtr.kat = null; filtr.ucet = null; filtr.text = '';
    obnovChipy();
    jdi('historie');
  }

  function obnovChipy() {
    vse('#chipy-typ .chip').forEach(function (b) {
      b.classList.toggle('chip-akt', b.getAttribute('data-typ') === filtr.typ);
    });
    vse('#chipy-rozsah .chip').forEach(function (b) {
      b.classList.toggle('chip-akt', b.getAttribute('data-rozsah') === filtr.rozsah);
    });
    $('hledani').value = filtr.text;
  }

  /** Rok právě listovaný ve výběru měsíce; null = výběr není otevřený. */
  var vyberRok = null;

  function otevriVyberMesice() {
    vyberRok = rok;
    dialog({
      titulek: 'Vybrat měsíc',
      telo: '<div class="hlavicka-radek" style="height:auto;margin-bottom:10px">' +
        '<button class="mesic-sip" data-rok="-1">‹</button>' +
        '<span class="mesic-nazev" id="d-rok"></span>' +
        '<button class="mesic-sip" data-rok="1">›</button></div>' +
        '<div class="kat-mrizka" id="d-mesice" style="grid-template-columns:repeat(3,1fr)"></div>',
      ano: 'Hotovo', bezZruseni: true
    });
    prekresliVyberMesice();
  }

  function prekresliVyberMesice() {
    if (vyberRok === null || !$('d-rok')) return;
    var dnes = new Date();
    $('d-rok').textContent = vyberRok;
    $('d-mesice').innerHTML = D.MESICE.map(function (m, i) {
      var jeBudouci = vyberRok > dnes.getFullYear() ||
        (vyberRok === dnes.getFullYear() && i > dnes.getMonth());
      return '<button class="kat-tl' + (vyberRok === rok && i === mesic ? ' vybrano' : '') +
        '" data-m="' + i + '" style="' + (jeBudouci ? 'opacity:.45' : '') +
        '"><span style="font-size:13px">' + esc(m.slice(0, 3)) + '</span></button>';
    }).join('');
  }

  function klikVeVyberuMesice(e) {
    if (vyberRok === null) return;
    var r = e.target.closest('[data-rok]');
    if (r) { vyberRok += Number(r.getAttribute('data-rok')); prekresliVyberMesice(); return; }
    var m = e.target.closest('[data-m]');
    if (m) {
      rok = vyberRok; mesic = Number(m.getAttribute('data-m'));
      mesicVGrafu = 5;
      zavriDialog();
      vykresli();
    }
  }

  /* =================================================================
     START
     ================================================================= */

  global.F = {
    chybaUlozeni: function () {
      hlaska('Úložiště telefonu je plné, data se neuložila.');
    },
    // volá zámek po každém dalším odemčení
    poOdemceni: function () { spustAplikaci(); }
  };

  var zapojeno = false;

  /** Běží po odemčení – tehdy jsou teprve data v paměti. */
  function spustAplikaci() {
    var s = D.stav();
    nastavTema(s.nastaveni.tema || 'auto');

    var dnes = new Date();
    rok = dnes.getFullYear();
    mesic = dnes.getMonth();
    mesicVGrafu = 5;
    filtr = { typ: 'vse', rozsah: 'mesic', text: '', kat: null, ucet: null };

    var pridano = D.dopisPravidelne();

    if (!zapojeno) { zapojUdalosti(); zapojeno = true; }
    doplnIkony();
    obnovChipy();
    jdi('prehled');

    if (pridano) hlaska('Zapsáno ' + pridano + ' pravidelných plateb.');
  }

  /**
   * Výška oken podle skutečně viditelné plochy. `vh` v Safari počítá
   * i s lištou a klávesnicí, takže list o výšce 94vh utekl nahoru.
   */
  function sledujViditelnouPlochu() {
    var vv = global.visualViewport;
    var koren = document.documentElement.style;
    function obnov() {
      var vyska = vv ? vv.height : global.innerHeight;
      koren.setProperty('--plocha-vyska', Math.round(vyska) + 'px');
      koren.setProperty('--plocha-shora', Math.round(vv ? vv.offsetTop : 0) + 'px');
    }
    obnov();
    if (vv) { vv.addEventListener('resize', obnov); vv.addEventListener('scroll', obnov); }
    global.addEventListener('resize', obnov);
  }

  function start() {
    sledujViditelnouPlochu();
    // servisní vrstva pro běh bez signálu
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    // data jsou zamčená; aplikace se rozjede až po zadání PINu
    global.FZamek.start(spustAplikaci);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
