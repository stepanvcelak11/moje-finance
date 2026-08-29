/* ---------------------------------------------------------------
   app.js – obrazovky, formuláře a obsluha
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var D = global.FData;
  var G = global.FGrafy;
  var esc = G.esc;

  var VERZE = '1.0';

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

  function hlaska(text) {
    var el = $('hlaska');
    el.textContent = text;
    el.hidden = false;
    if (casovacHlasky) clearTimeout(casovacHlasky);
    casovacHlasky = setTimeout(function () { el.hidden = true; }, 2200);
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
  }

  /* =================================================================
     PŘEPÍNÁNÍ OBRAZOVEK
     ================================================================= */

  function jdi(kam) {
    pohled = kam;
    ['prehled', 'historie', 'ucty', 'nastaveni'].forEach(function (p) {
      $('pohled-' + p).hidden = (p !== kam);
    });
    vse('.nav-tl').forEach(function (b) {
      b.classList.toggle('nav-akt', b.getAttribute('data-jdi') === kam);
    });
    var sHlavickou = (kam === 'prehled' || kam === 'historie');
    $('hlavicka').classList.toggle('skryta', !sHlavickou);
    document.body.classList.toggle('bez-hlavicky', !sHlavickou);
    vykresli();
    global.scrollTo(0, 0);
  }

  function vykresli() {
    aktualizujHlavicku();
    if (pohled === 'prehled') vykresliPrehled();
    else if (pohled === 'historie') vykresliHistorii();
    else if (pohled === 'ucty') vykresliUcty();
    else if (pohled === 'nastaveni') vykresliNastaveni();
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

    // zůstatek
    $('hero-zustatek').textContent = kc(D.celkovyZustatek());
    $('hero-uctu').innerHTML = s.ucty.map(function (u) {
      return '<span class="hero-znacka">' + esc(u.ikona) + ' ' + esc(u.nazev) +
        ' <b>' + esc(kc(D.zustatekUctu(u.id))) + '</b></span>';
    }).join('');

    // příjmy / výdaje
    $('souhrn-prijmy').textContent = kc(souhrn.prijmy);
    $('souhrn-vydaje').textContent = kc(souhrn.vydaje);
    $('souhrn-prijmy-pocet').textContent = souhrn.pocetP ? souhrn.pocetP + '× za měsíc' : 'zatím nic';
    $('souhrn-vydaje-pocet').textContent = souhrn.pocetV ? souhrn.pocetV + '× za měsíc' : 'zatím nic';

    // rozdíl
    $('souhrn-rozdil').textContent = kcZnak(souhrn.rozdil);
    $('souhrn-rozdil').className = 'rozdil-cislo ' + (souhrn.rozdil < 0 ? 'vydaj' : (souhrn.rozdil > 0 ? 'prijem' : ''));
    var podilUtraty = souhrn.prijmy > 0 ? Math.min(100, souhrn.vydaje / souhrn.prijmy * 100) : (souhrn.vydaje > 0 ? 100 : 0);
    $('rozdil-vypln').style.width = podilUtraty.toFixed(1) + '%';
    $('rozdil-vypln').style.background = souhrn.rozdil < 0 ? 'var(--vydaj)' : 'var(--prijem)';

    var pod;
    if (!souhrn.pocetP && !souhrn.pocetV) pod = 'Zatím žádné záznamy v tomto měsíci.';
    else if (souhrn.prijmy === 0) pod = 'Bez zapsaného příjmu – utraceno ' + kc(souhrn.vydaje) + '.';
    else if (souhrn.rozdil >= 0) pod = 'Z příjmů jste utratili ' + Math.round(podilUtraty) + ' %. Zbývá ' + kc(souhrn.rozdil) + '.';
    else pod = 'Výdaje převyšují příjmy o ' + kc(-souhrn.rozdil) + '. Rozdíl jde z úspor.';
    var denVMesici = pocetDniZbyva();
    if (denVMesici > 0 && souhrn.rozdil > 0) {
      pod += ' Do konce měsíce ' + denVMesici + ' dní, to je ' + kc(souhrn.rozdil / denVMesici) + ' na den.';
    }
    $('souhrn-rozdil-pod').textContent = pod;

    // kategorie
    var kategorie = D.podleKategorii(vMesici, 'vydaj');
    var jsou = kategorie.length > 0;
    $('kategorie-prazdno').hidden = jsou;
    $('graf-podil').innerHTML = jsou ? G.pruhPodilu(kategorie, kc) : '';
    $('graf-kategorie').innerHTML = jsou ? G.seznamKategorii(kategorie, kc) : '';
    $('kategorie-celkem').textContent = jsou ? kategorie.length + ' kategorií · ' + kc(souhrn.vydaje) : '';

    // rozpočty
    var rozpocty = D.stavRozpoctu(rok, mesic);
    $('karta-rozpocty').hidden = rozpocty.length === 0;
    $('seznam-rozpoctu').innerHTML = rozpocty.map(rozpocetHtml).join('');

    // měsíce
    var mesice = D.poslednichMesicu(rok, mesic, 6);
    $('graf-mesice').innerHTML = G.grafMesicu(mesice, mesicVGrafu);
    ctiMesic(mesice, mesicVGrafu);

    // poslední pohyby
    var posledni = D.serazene().filter(function (t) { return t.datum.slice(0, 7) === D.klicMesice(rok, mesic); }).slice(0, 5);
    if (!posledni.length) posledni = D.serazene().slice(0, 5);
    $('posledni-pohyby').innerHTML = posledni.length
      ? '<div class="skupina-karta">' + posledni.map(polozkaHtml).join('') + '</div>'
      : '<p class="prazdno">Zatím nic. Přidejte první záznam tlačítkem +.</p>';
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
      '<div class="rozpocet-hlava"><span>' + esc(r.ikona) + ' ' + esc(r.nazev) + '</span>' +
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

  function polozkaHtml(t) {
    var zn, castka, ikona, nazev, pod;
    if (t.typ === 'prevod') {
      zn = ''; castka = kc(t.castka); ikona = '↔️';
      nazev = 'Převod';
      pod = D.ucet(t.ucet).nazev + ' → ' + D.ucet(t.ucetDo).nazev;
    } else {
      var k = D.kategorie(t.kat);
      ikona = k.ikona; nazev = k.nazev;
      zn = t.typ === 'prijem' ? 'prijem' : 'vydaj';
      castka = (t.typ === 'prijem' ? '+' : '−') + cislo(t.castka) + ' ' + mena();
      pod = D.ucet(t.ucet).nazev;
    }
    if (t.pozn) pod = t.pozn + ' · ' + pod;
    return '<button class="polozka" data-transakce="' + esc(t.id) + '">' +
      '<span class="polozka-ikona">' + esc(ikona) + '</span>' +
      '<span><span class="polozka-nazev">' + esc(nazev) + '</span>' +
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
    return vsechny.filter(function (t) {
      if (filtr.rozsah === 'mesic' && t.datum.slice(0, 7) !== klic) return false;
      if (filtr.rozsah === 'rok' && t.datum.slice(0, 4) !== String(rok)) return false;
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
    if (filtr.kat) znacky.push('<button class="znacka-filtru" data-zrus="kat">' +
      esc(D.kategorie(filtr.kat).ikona + ' ' + D.kategorie(filtr.kat).nazev) + ' ✕</button>');
    if (filtr.ucet) znacky.push('<button class="znacka-filtru" data-zrus="ucet">' +
      esc(D.ucet(filtr.ucet).ikona + ' ' + D.ucet(filtr.ucet).nazev) + ' ✕</button>');
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
        '<span class="ucet-ikona" style="background:color-mix(in srgb,' + G.barva(u.barva) +
          ' 18%, var(--surface-2))">' + esc(u.ikona) + '</span>' +
        '<span><span class="ucet-jmeno">' + esc(u.nazev) + '</span>' +
        '<span class="ucet-pod">' + pocet + ' ' + tvarZaznamu(pocet) + ' · počátek ' + esc(kc(u.pocatek)) + '</span></span>' +
        '<span class="ucet-castka' + (z < 0 ? ' vydaj' : '') + '">' + esc(kc(z)) + '</span>' +
      '</button>';
    }).join('');
  }

  function dialogUctu(id) {
    var u = id ? D.najdi(D.stav().ucty, id) : null;
    dialog({
      titulek: u ? 'Upravit účet' : 'Nový účet',
      telo:
        '<label>Název</label><input class="pole" id="d-nazev" value="' + esc(u ? u.nazev : '') + '" placeholder="např. Peněženka">' +
        '<label>Ikona</label><input class="pole" id="d-ikona" maxlength="4" value="' + esc(u ? u.ikona : '💳') + '">' +
        '<label>Počáteční stav (' + esc(mena()) + ')</label><input class="pole" id="d-pocatek" inputmode="decimal" value="' + (u ? u.pocatek : 0) + '">' +
        (u ? '<button class="tl tl-nebezpeci tl-siroke" id="d-smaz">Smazat účet</button>' : ''),
      ano: 'Uložit',
      zamer: true,
      potvrd: function () {
        var nazev = $('d-nazev').value.trim();
        if (!nazev) { hlaska('Zadejte název účtu.'); return false; }
        var pocatek = parsujCastku($('d-pocatek').value);
        if (isNaN(pocatek)) pocatek = 0;
        var ikona = $('d-ikona').value.trim() || '💳';
        var s = D.stav();
        if (u) {
          u.nazev = nazev; u.ikona = ikona; u.pocatek = pocatek;
        } else {
          s.ucty.push({ id: D.noveId('u'), nazev: nazev, ikona: ikona, pocatek: pocatek,
            barva: (s.ucty.length % 8) + 1 });
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
        '<span class="kat-ikona">' + esc(k.ikona) + '</span>' +
        '<span>' + esc(k.nazev) + '</span>' +
        '<input class="pole" inputmode="decimal" data-rozpocet="' + esc(k.id) + '" placeholder="—" value="' +
          (v ? esc(String(v)) : '') + '">' +
      '</div>';
    }).join('');

    // kategorie
    vse('#chipy-kat-typ .chip').forEach(function (b) {
      b.classList.toggle('chip-akt', b.getAttribute('data-kattyp') === katTypVEditoru);
    });
    $('editor-kategorii').innerHTML = D.kategorieTypu(katTypVEditoru).map(function (k) {
      var pocet = s.transakce.filter(function (t) { return t.kat === k.id; }).length;
      return '<div class="editor-radek" style="grid-template-columns:26px 1fr auto">' +
        '<span class="kat-ikona">' + esc(k.ikona) + '</span>' +
        '<span><span>' + esc(k.nazev) + '</span><span class="pravidelna-pod"> · ' + pocet + '×</span></span>' +
        '<span><button class="odkaz" data-upravkat="' + esc(k.id) + '">Upravit</button></span>' +
      '</div>';
    }).join('');

    // pravidelné
    $('seznam-pravidelnych').innerHTML = s.pravidelne.length
      ? s.pravidelne.map(function (p) {
          var k = D.kategorie(p.kat);
          return '<div class="pravidelna-radek">' +
            '<span><span>' + esc(k.ikona + ' ' + (p.nazev || k.nazev)) + '</span>' +
            '<span class="pravidelna-pod">každého ' + p.den + '. · ' + esc(D.ucet(p.ucet).nazev) +
            ' · ' + (p.typ === 'prijem' ? 'příjem' : 'výdaj') + '</span></span>' +
            '<span class="pravidelna-castka">' + esc(kc(p.castka)) + '</span>' +
            '<button class="smaz-x" data-smazpravidelnou="' + esc(p.id) + '" aria-label="Smazat">✕</button>' +
          '</div>';
        }).join('')
      : '<p class="napoveda" style="padding:6px 0 0">Zatím nic. Nájem nebo předplatné se pak zapíše samo.</p>';

    // vzhled
    vse('#chipy-tema .chip').forEach(function (b) {
      b.classList.toggle('chip-akt', b.getAttribute('data-tema') === (s.nastaveni.tema || 'auto'));
    });
    $('pole-mena').value = mena();

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
    dialog({
      titulek: k ? 'Upravit kategorii' : 'Nová kategorie',
      telo:
        '<label>Název</label><input class="pole" id="d-nazev" value="' + esc(k ? k.nazev : '') + '" placeholder="např. Kadeřník">' +
        '<label>Ikona</label><input class="pole" id="d-ikona" maxlength="4" value="' + esc(k ? k.ikona : '🏷️') + '">' +
        (k ? '' : '<label>Typ</label><select class="pole" id="d-typ"><option value="vydaj">Výdaj</option><option value="prijem">Příjem</option></select>') +
        (k ? '<button class="tl tl-nebezpeci tl-siroke" id="d-smaz">Smazat kategorii</button>' : ''),
      ano: 'Uložit',
      zamer: true,
      potvrd: function () {
        var nazev = $('d-nazev').value.trim();
        if (!nazev) { hlaska('Zadejte název.'); return false; }
        var ikona = $('d-ikona').value.trim() || '🏷️';
        if (k) { k.nazev = nazev; k.ikona = ikona; }
        else {
          var typ = $('d-typ').value;
          s.kategorie.push({ id: D.noveId('k'), nazev: nazev, ikona: ikona, typ: typ,
            barva: (s.kategorie.length % 8) + 1 });
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
      return '<option value="' + esc(k.id) + '">' + esc(k.ikona + ' ' + k.nazev) +
        (k.typ === 'prijem' ? ' (příjem)' : '') + '</option>';
    }).join('');
    var moznostiUctu = s.ucty.map(function (u) {
      return '<option value="' + esc(u.id) + '">' + esc(u.ikona + ' ' + u.nazev) + '</option>';
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
      pozn: ''
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
      pozn: t.pozn || ''
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
    $('rychle-castky').innerHTML = [50, 100, 200, 500, 1000].map(function (c) {
      return '<button class="rychla" data-rychla="' + c + '">+' + cislo(c) + '</button>';
    }).join('');
    obnovTypZaznamu();
    $('prekryv-zaznam').hidden = false;
    setTimeout(function () { $('pole-castka').focus(); }, 120);
  }

  function zavriZaznam() {
    $('prekryv-zaznam').hidden = true;
    zaznam = null;
  }

  function obnovTypZaznamu() {
    var typ = zaznam.typ;
    vse('#prepinac-typ button').forEach(function (b) {
      b.classList.toggle('prep-akt', b.getAttribute('data-typ') === typ);
    });
    var jePrevod = (typ === 'prevod');
    $('skupina-kategorie').hidden = jePrevod;
    $('skupina-ucet-do').hidden = !jePrevod;
    $('popis-ucet').textContent = jePrevod ? 'Odkud' : 'Účet';

    if (!jePrevod) {
      $('vyber-kategorie').innerHTML = D.kategorieTypu(typ).map(function (k) {
        return '<button class="kat-tl' + (k.id === zaznam.kat[typ] ? ' vybrano' : '') +
          '" data-vyberkat="' + esc(k.id) + '"><span>' + esc(k.ikona) +
          '</span><span>' + esc(k.nazev) + '</span></button>';
      }).join('');
    }
    var ucty = D.stav().ucty;
    $('vyber-uctu').innerHTML = ucty.map(function (u) {
      return '<button class="chip' + (u.id === zaznam.ucet ? ' chip-akt' : '') +
        '" data-vyberucet="' + esc(u.id) + '">' + esc(u.ikona + ' ' + u.nazev) + '</button>';
    }).join('');
    $('vyber-uctu-do').innerHTML = ucty.map(function (u) {
      return '<button class="chip' + (u.id === zaznam.ucetDo ? ' chip-akt' : '') +
        '" data-vyberucetdo="' + esc(u.id) + '">' + esc(u.ikona + ' ' + u.nazev) + '</button>';
    }).join('');
  }

  function ulozZaznam() {
    var castka = parsujCastku($('pole-castka').value);
    if (!(castka > 0)) { hlaska('Zadejte částku větší než nula.'); $('pole-castka').focus(); return; }
    castka = Math.round(castka * 100) / 100;

    var typ = zaznam.typ;
    var datum = $('pole-datum').value || D.dnesISO();
    var pozn = $('pole-pozn').value.trim();

    if (typ === 'prevod' && zaznam.ucet === zaznam.ucetDo) {
      hlaska('Vyberte dva různé účty.'); return;
    }

    var data = {
      datum: datum, castka: castka, typ: typ,
      kat: typ === 'prevod' ? null : zaznam.kat[typ],
      ucet: zaznam.ucet,
      ucetDo: typ === 'prevod' ? zaznam.ucetDo : null,
      pozn: pozn
    };

    if (zaznam.id) {
      D.upravTransakci(zaznam.id, data);
      hlaska('Změny uloženy.');
    } else {
      D.pridejTransakci(data);
      hlaska(typ === 'prijem' ? 'Příjem zapsán.' : (typ === 'prevod' ? 'Převod zapsán.' : 'Výdaj zapsán.'));
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
     TÉMA
     ================================================================= */

  function nastavTema(tema) {
    if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', tema);
    var tmave = tema === 'dark' ||
      (tema !== 'light' && global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tmave ? '#101010' : '#f4f4f1');
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

    // přidat
    naSlys($('tl-pridat'), 'click', function () { zaloz('vydaj'); otevriZaznam(); });

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

    naSlys($('prepinac-typ'), 'click', function (e) {
      var b = e.target.closest('[data-typ]');
      if (!b || !zaznam) return;
      zaznam.typ = b.getAttribute('data-typ');
      obnovTypZaznamu();
    });

    naSlys($('vyber-kategorie'), 'click', function (e) {
      var b = e.target.closest('[data-vyberkat]');
      if (!b || !zaznam) return;
      zaznam.kat[zaznam.typ] = b.getAttribute('data-vyberkat');
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
    naSlys($('rychle-castky'), 'click', function (e) {
      var b = e.target.closest('[data-rychla]');
      if (!b) return;
      var pole = $('pole-castka');
      var teď = parsujCastku(pole.value);
      if (isNaN(teď)) teď = 0;
      pole.value = String(Math.round((teď + Number(b.getAttribute('data-rychla'))) * 100) / 100);
    });

    // dialog
    naSlys($('dialog-ano'), 'click', function () {
      if (!dialogPotvrd) { zavriDialog(); return; }
      var vysledek = dialogPotvrd();
      if (vysledek !== false) { zavriDialog(); vykresli(); }
    });
    naSlys($('dialog-ne'), 'click', zavriDialog);
    naSlys($('dialog-telo'), 'click', klikVeVyberuMesice);
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
      filtr[b.getAttribute('data-zrus')] = null;
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
      if (!$('prekryv-dialog').hidden) zavriDialog();
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
    }
  };

  function start() {
    D.nacti();
    var s = D.stav();

    nastavTema(s.nastaveni.tema || 'auto');

    var dnes = new Date();
    rok = dnes.getFullYear();
    mesic = dnes.getMonth();

    var pridano = D.dopisPravidelne();

    zapojUdalosti();
    obnovChipy();
    jdi('prehled');

    if (pridano) hlaska('Zapsáno ' + pridano + ' pravidelných plateb.');

    // servisní vrstva pro běh bez signálu
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
