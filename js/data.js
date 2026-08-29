/* ---------------------------------------------------------------
   data.js – uložení a výpočty
   Vše žije v localStorage prohlížeče, nic se nikam neposílá.
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var KLIC = 'moje-finance-v1';        // nešifrovaná data (zámek vypnutý)
  var TREZOR = 'moje-finance-trezor-v1'; // zašifrovaná data (zámek zapnutý)
  var VERZE_DAT = 1;

  // Šifra dodaná modulem zámku: { zasifruj(text) -> Promise<string>,
  // desifruj(text) -> Promise<string> }. Když je null, ukládá se načisto.
  var sifra = null;

  /* ---------- výchozí obsah ---------- */

  var VYCHOZI_KATEGORIE = [
    // výdaje
    { id: 'k-potraviny', nazev: 'Potraviny', ikona: '🛒', typ: 'vydaj', barva: 1 },
    { id: 'k-restaurace', nazev: 'Jídlo venku', ikona: '🍽️', typ: 'vydaj', barva: 2 },
    { id: 'k-bydleni', nazev: 'Bydlení', ikona: '🏠', typ: 'vydaj', barva: 3 },
    { id: 'k-energie', nazev: 'Energie', ikona: '💡', typ: 'vydaj', barva: 4 },
    { id: 'k-doprava', nazev: 'Doprava', ikona: '🚌', typ: 'vydaj', barva: 5 },
    { id: 'k-auto', nazev: 'Auto', ikona: '🚗', typ: 'vydaj', barva: 6 },
    { id: 'k-zdravi', nazev: 'Zdraví', ikona: '💊', typ: 'vydaj', barva: 7 },
    { id: 'k-zabava', nazev: 'Zábava', ikona: '🎬', typ: 'vydaj', barva: 8 },
    { id: 'k-obleceni', nazev: 'Oblečení', ikona: '👕', typ: 'vydaj', barva: 1 },
    { id: 'k-domacnost', nazev: 'Domácnost', ikona: '🧻', typ: 'vydaj', barva: 2 },
    { id: 'k-deti', nazev: 'Děti', ikona: '🧸', typ: 'vydaj', barva: 3 },
    { id: 'k-sport', nazev: 'Sport', ikona: '🏋️', typ: 'vydaj', barva: 4 },
    { id: 'k-cestovani', nazev: 'Cestování', ikona: '✈️', typ: 'vydaj', barva: 5 },
    { id: 'k-darky', nazev: 'Dárky', ikona: '🎁', typ: 'vydaj', barva: 6 },
    { id: 'k-poplatky', nazev: 'Poplatky', ikona: '🧾', typ: 'vydaj', barva: 7 },
    { id: 'k-telefon', nazev: 'Telefon a net', ikona: '📱', typ: 'vydaj', barva: 8 },
    { id: 'k-vzdelani', nazev: 'Vzdělání', ikona: '📚', typ: 'vydaj', barva: 1 },
    { id: 'k-sporeni', nazev: 'Spoření', ikona: '🐖', typ: 'vydaj', barva: 3 },
    { id: 'k-jine', nazev: 'Jiné', ikona: '❔', typ: 'vydaj', barva: 4 },
    // příjmy
    { id: 'p-vyplata', nazev: 'Výplata', ikona: '💼', typ: 'prijem', barva: 3 },
    { id: 'p-faktura', nazev: 'Faktura', ikona: '🧮', typ: 'prijem', barva: 1 },
    { id: 'p-brigada', nazev: 'Brigáda', ikona: '🔧', typ: 'prijem', barva: 4 },
    { id: 'p-prodej', nazev: 'Prodej', ikona: '📦', typ: 'prijem', barva: 2 },
    { id: 'p-dar', nazev: 'Dar', ikona: '🎁', typ: 'prijem', barva: 5 },
    { id: 'p-vratka', nazev: 'Vratka', ikona: '↩️', typ: 'prijem', barva: 7 },
    { id: 'p-uroky', nazev: 'Úroky', ikona: '🏦', typ: 'prijem', barva: 6 },
    { id: 'p-jine', nazev: 'Jiné', ikona: '❔', typ: 'prijem', barva: 8 }
  ];

  var VYCHOZI_UCTY = [
    { id: 'u-hotovost', nazev: 'Hotovost', ikona: '💵', pocatek: 0, barva: 4 },
    { id: 'u-karta', nazev: 'Běžný účet', ikona: '💳', pocatek: 0, barva: 1 },
    { id: 'u-sporici', nazev: 'Spořicí účet', ikona: '🐖', pocatek: 0, barva: 3 }
  ];

  function vychoziStav() {
    return {
      verze: VERZE_DAT,
      transakce: [],
      kategorie: VYCHOZI_KATEGORIE.map(function (k) { return kopie(k); }),
      ucty: VYCHOZI_UCTY.map(function (u) { return kopie(u); }),
      rozpocty: {},
      pravidelne: [],
      nastaveni: { mena: 'Kč', tema: 'auto', vytvoreno: dnesISO() }
    };
  }

  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- datum ---------- */

  function dvojcisli(n) { return (n < 10 ? '0' : '') + n; }

  function naISO(d) {
    return d.getFullYear() + '-' + dvojcisli(d.getMonth() + 1) + '-' + dvojcisli(d.getDate());
  }

  function dnesISO() { return naISO(new Date()); }

  function zISO(s) {
    var c = String(s || '').split('-');
    return new Date(+c[0], (+c[1] || 1) - 1, +c[2] || 1);
  }

  var MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  var MESICE_KRATCE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  var DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

  function klicMesice(rok, mesic) { return rok + '-' + dvojcisli(mesic + 1); }

  function popisDne(iso) {
    var d = zISO(iso);
    var dnes = new Date(); dnes.setHours(0, 0, 0, 0);
    var rozdil = Math.round((d - dnes) / 86400000);
    if (rozdil === 0) return 'Dnes';
    if (rozdil === -1) return 'Včera';
    if (rozdil === 1) return 'Zítra';
    var text = d.getDate() + '. ' + MESICE[d.getMonth()].toLowerCase();
    if (d.getFullYear() !== dnes.getFullYear()) text += ' ' + d.getFullYear();
    return text + ' · ' + DNY[d.getDay()];
  }

  /* ---------- stav ---------- */

  var stav = null;

  function cti(klic) {
    try { return global.localStorage.getItem(klic); } catch (e) { return null; }
  }

  function zapis(klic, hodnota) {
    try { global.localStorage.setItem(klic, hodnota); return true; }
    catch (e) {
      if (global.F && global.F.chybaUlozeni) global.F.chybaUlozeni(e);
      return false;
    }
  }

  function smaz(klic) {
    try { global.localStorage.removeItem(klic); } catch (e) { /* nevadí */ }
  }

  /** Poskládá stav z rozbaleného JSONu; při nesmyslu vrátí výchozí. */
  function nactiZTextu(text) {
    var z = vychoziStav();
    if (!text) { stav = z; return stav; }
    try {
      var d = JSON.parse(text);
      stav = {
        verze: VERZE_DAT,
        transakce: Array.isArray(d.transakce) ? d.transakce : [],
        kategorie: Array.isArray(d.kategorie) && d.kategorie.length ? d.kategorie : z.kategorie,
        ucty: Array.isArray(d.ucty) && d.ucty.length ? d.ucty : z.ucty,
        rozpocty: d.rozpocty && typeof d.rozpocty === 'object' ? d.rozpocty : {},
        pravidelne: Array.isArray(d.pravidelne) ? d.pravidelne : [],
        nastaveni: Object.assign({}, z.nastaveni, d.nastaveni || {})
      };
    } catch (e) {
      stav = z;
    }
    return stav;
  }

  /** Načte nešifrovaná data (režim bez zámku). */
  function nacti() { return nactiZTextu(cti(KLIC)); }

  function nastavSifru(s) { sifra = s || null; }
  function jeSifrovano() { return !!sifra; }
  function syrovyTrezor() { return cti(TREZOR); }
  function syrovaData() { return cti(KLIC); }
  function zapisTrezor(obal) { return zapis(TREZOR, obal); }
  function smazPlain() { smaz(KLIC); }
  function smazTrezor() { smaz(TREZOR); }

  /** Zapomene rozbalená data z paměti (při zamčení). */
  function zavri() { stav = null; sifra = null; }

  var cekaUlozeni = null;
  var fronta = Promise.resolve();   // zápisy jdou za sebou, ne přes sebe

  function uloz() {
    if (cekaUlozeni) clearTimeout(cekaUlozeni);
    cekaUlozeni = setTimeout(ulozHned, 120);
  }

  function ulozHned() {
    if (cekaUlozeni) { clearTimeout(cekaUlozeni); cekaUlozeni = null; }
    if (!stav) return Promise.resolve(false);
    var text = JSON.stringify(stav);
    if (!sifra) {
      return Promise.resolve(zapis(KLIC, text));
    }
    fronta = fronta.then(function () {
      return sifra.zasifruj(text);
    }).then(function (obal) {
      return zapis(TREZOR, obal);
    }).catch(function (e) {
      if (global.F && global.F.chybaUlozeni) global.F.chybaUlozeni(e);
      return false;
    });
    return fronta;
  }

  /** Počká, až doběhnou všechny rozepsané zápisy (před zamčením). */
  function dopisAVycti() {
    return ulozHned().then(function () { return fronta; });
  }

  function noveId(predpona) {
    return (predpona || 't') + '-' + Date.now().toString(36) + '-' +
      Math.floor(Math.random() * 1e6).toString(36);
  }

  /* ---------- transakce ---------- */

  function pridejTransakci(t) {
    t.id = t.id || noveId('t');
    t.vytvoreno = Date.now();
    stav.transakce.push(t);
    uloz();
    return t;
  }

  function upravTransakci(id, zmeny) {
    var t = najdi(stav.transakce, id);
    if (!t) return null;
    Object.keys(zmeny).forEach(function (k) { t[k] = zmeny[k]; });
    uloz();
    return t;
  }

  function smazTransakci(id) {
    var i = indexPodleId(stav.transakce, id);
    if (i < 0) return false;
    stav.transakce.splice(i, 1);
    uloz();
    return true;
  }

  function najdi(pole, id) {
    for (var i = 0; i < pole.length; i++) if (pole[i].id === id) return pole[i];
    return null;
  }

  function indexPodleId(pole, id) {
    for (var i = 0; i < pole.length; i++) if (pole[i].id === id) return i;
    return -1;
  }

  function kategorie(id) {
    return najdi(stav.kategorie, id) ||
      { id: id, nazev: 'Bez kategorie', ikona: '❔', typ: 'vydaj', barva: 4 };
  }

  function ucet(id) {
    return najdi(stav.ucty, id) ||
      { id: id, nazev: 'Neznámý účet', ikona: '❔', pocatek: 0, barva: 4 };
  }

  function kategorieTypu(typ) {
    return stav.kategorie.filter(function (k) { return k.typ === typ; });
  }

  /* ---------- výpočty ---------- */

  function serazene() {
    return stav.transakce.slice().sort(function (a, b) {
      if (a.datum === b.datum) return (b.vytvoreno || 0) - (a.vytvoreno || 0);
      return a.datum < b.datum ? 1 : -1;
    });
  }

  function vMesici(rok, mesic) {
    var p = klicMesice(rok, mesic);
    return stav.transakce.filter(function (t) { return t.datum.slice(0, 7) === p; });
  }

  function souhrn(seznam) {
    var s = { prijmy: 0, vydaje: 0, pocetP: 0, pocetV: 0 };
    for (var i = 0; i < seznam.length; i++) {
      var t = seznam[i];
      if (t.typ === 'prijem') { s.prijmy += t.castka; s.pocetP++; }
      else if (t.typ === 'vydaj') { s.vydaje += t.castka; s.pocetV++; }
    }
    s.rozdil = s.prijmy - s.vydaje;
    return s;
  }

  function zustatekUctu(id) {
    var u = ucet(id);
    var z = Number(u.pocatek) || 0;
    for (var i = 0; i < stav.transakce.length; i++) {
      var t = stav.transakce[i];
      if (t.typ === 'prijem' && t.ucet === id) z += t.castka;
      else if (t.typ === 'vydaj' && t.ucet === id) z -= t.castka;
      else if (t.typ === 'prevod') {
        if (t.ucet === id) z -= t.castka;
        if (t.ucetDo === id) z += t.castka;
      }
    }
    return z;
  }

  function celkovyZustatek() {
    return stav.ucty.reduce(function (a, u) { return a + zustatekUctu(u.id); }, 0);
  }

  /** Výdaje seskupené po kategoriích, sestupně. */
  function podleKategorii(seznam, typ) {
    var mapa = {};
    for (var i = 0; i < seznam.length; i++) {
      var t = seznam[i];
      if (t.typ !== typ) continue;
      if (!mapa[t.kat]) mapa[t.kat] = { kat: t.kat, castka: 0, pocet: 0 };
      mapa[t.kat].castka += t.castka;
      mapa[t.kat].pocet++;
    }
    return Object.keys(mapa).map(function (k) {
      var z = mapa[k], k2 = kategorie(k);
      z.nazev = k2.nazev; z.ikona = k2.ikona; z.barva = k2.barva;
      return z;
    }).sort(function (a, b) { return b.castka - a.castka; });
  }

  /** Posledních n měsíců včetně zadaného, od nejstaršího. */
  function poslednichMesicu(rok, mesic, n) {
    var vysledek = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(rok, mesic - i, 1);
      var s = souhrn(vMesici(d.getFullYear(), d.getMonth()));
      vysledek.push({
        rok: d.getFullYear(), mesic: d.getMonth(),
        popis: MESICE_KRATCE[d.getMonth()],
        prijmy: s.prijmy, vydaje: s.vydaje, rozdil: s.rozdil
      });
    }
    return vysledek;
  }

  function stavRozpoctu(rok, mesic) {
    var seznam = vMesici(rok, mesic);
    var utraceno = {};
    seznam.forEach(function (t) {
      if (t.typ !== 'vydaj') return;
      utraceno[t.kat] = (utraceno[t.kat] || 0) + t.castka;
    });
    return Object.keys(stav.rozpocty)
      .filter(function (k) { return Number(stav.rozpocty[k]) > 0; })
      .map(function (k) {
        var limit = Number(stav.rozpocty[k]);
        var u = utraceno[k] || 0;
        var kat = kategorie(k);
        return {
          kat: k, nazev: kat.nazev, ikona: kat.ikona, barva: kat.barva,
          limit: limit, utraceno: u, zbyva: limit - u,
          podil: limit > 0 ? u / limit : 0
        };
      })
      .sort(function (a, b) { return b.podil - a.podil; });
  }

  /* ---------- dnes a tento týden ---------- */

  /** Pondělí týdne, do kterého spadá zadané datum (u nás začíná týden pondělím). */
  function pondeli(d) {
    var k = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var posun = (k.getDay() + 6) % 7;
    k.setDate(k.getDate() - posun);
    return k;
  }

  /** Souhrn za rozsah dat včetně obou krajů (ISO řetězce). */
  function souhrnRozsah(od, doKdy) {
    return souhrn(stav.transakce.filter(function (t) {
      return t.datum >= od && t.datum <= doKdy;
    }));
  }

  function souhrnDnes() {
    var d = dnesISO();
    return souhrnRozsah(d, d);
  }

  function souhrnTydne() {
    var dnes = new Date();
    return souhrnRozsah(naISO(pondeli(dnes)), naISO(dnes));
  }

  /* ---------- trend kategorií ---------- */

  /**
   * Srovná útratu kategorie za tento měsíc s průměrem předchozích šesti.
   * U rozdělaného měsíce porovnává stejně dlouhý úsek (do stejného dne),
   * jinak by rozdělaný měsíc vždycky vycházel jako úspora.
   * Vrací mapu id kategorie -> { prumer, podil, dni }.
   */
  function trendyKategorii(rok, mesic) {
    var dnes = new Date();
    var jeAktualni = (dnes.getFullYear() === rok && dnes.getMonth() === mesic);
    var poslDen = new Date(rok, mesic + 1, 0).getDate();
    var doDne = jeAktualni ? dnes.getDate() : poslDen;

    var ted = {}, drive = {}, meliDataMesice = {};
    for (var i = 0; i < stav.transakce.length; i++) {
      var t = stav.transakce[i];
      var r = +t.datum.slice(0, 4), m = +t.datum.slice(5, 7) - 1, d = +t.datum.slice(8, 10);
      var odstup = (rok - r) * 12 + (mesic - m);
      if (odstup >= 1 && odstup <= 6) meliDataMesice[odstup] = true;
      if (t.typ !== 'vydaj' || d > doDne) continue;
      if (odstup === 0) ted[t.kat] = (ted[t.kat] || 0) + t.castka;
      else if (odstup >= 1 && odstup <= 6) drive[t.kat] = (drive[t.kat] || 0) + t.castka;
    }

    var pocetMesicu = Object.keys(meliDataMesice).length;
    var vysledek = {};
    if (!pocetMesicu) return vysledek;

    Object.keys(ted).forEach(function (kat) {
      var prumer = (drive[kat] || 0) / pocetMesicu;
      if (prumer <= 0) return;                       // dřív se v kategorii neutrácelo
      vysledek[kat] = {
        prumer: prumer,
        podil: ted[kat] / prumer - 1,
        dni: doDne,
        mesicu: pocetMesicu,
        cely: !jeAktualni
      };
    });
    return vysledek;
  }

  /* ---------- šablony rychlého zápisu ---------- */

  function median(pole) {
    var s = pole.slice().sort(function (a, b) { return a - b; });
    var p = Math.floor(s.length / 2);
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
  }

  /**
   * Nejčastější kombinace typ + kategorie + účet za poslední tři měsíce.
   * Částka = nejčastější přesná hodnota, jinak medián.
   */
  function sablony(kolik) {
    var hranice = new Date();
    hranice.setDate(hranice.getDate() - 90);
    var od = naISO(hranice);

    var mapa = {};
    stav.transakce.forEach(function (t) {
      if (t.typ === 'prevod' || t.datum < od) return;
      var k = t.typ + '|' + t.kat + '|' + t.ucet;
      if (!mapa[k]) mapa[k] = { typ: t.typ, kat: t.kat, ucet: t.ucet, pocet: 0, castky: [] };
      mapa[k].pocet++;
      mapa[k].castky.push(t.castka);
    });

    return Object.keys(mapa).map(function (k) {
      var z = mapa[k];
      var cetnost = {}, nej = null, nejPocet = 0;
      z.castky.forEach(function (c) {
        cetnost[c] = (cetnost[c] || 0) + 1;
        if (cetnost[c] > nejPocet) { nejPocet = cetnost[c]; nej = c; }
      });
      z.castka = nejPocet >= 2 ? Number(nej) : Math.round(median(z.castky));
      var kat = kategorie(z.kat);
      z.nazev = kat.nazev;
      z.ikona = kat.ikona;
      z.barva = kat.barva;
      return z;
    }).filter(function (z) {
      return z.pocet >= 2 && z.castka > 0;
    }).sort(function (a, b) {
      return b.pocet - a.pocet;
    }).slice(0, kolik || 3);
  }

  /* ---------- pravidelné platby ---------- */

  /** Doplní chybějící pravidelné platby za uplynulé měsíce. Vrátí počet přidaných. */
  function dopisPravidelne() {
    var dnes = new Date();
    var pridano = 0;
    stav.pravidelne.forEach(function (p) {
      if (!p.od) p.od = klicMesice(dnes.getFullYear(), dnes.getMonth());
      var start = p.posledni ? dalsiMesic(p.posledni) : p.od;
      var kurzor = start;
      var pojistka = 0;
      while (kurzor <= klicMesice(dnes.getFullYear(), dnes.getMonth()) && pojistka++ < 240) {
        var rok = +kurzor.slice(0, 4), mes = +kurzor.slice(5, 7) - 1;
        var poslDen = new Date(rok, mes + 1, 0).getDate();
        var den = Math.min(p.den || 1, poslDen);
        var datum = kurzor + '-' + dvojcisli(den);
        if (zISO(datum) <= dnes) {
          pridejTransakci({
            datum: datum, castka: p.castka, typ: p.typ, kat: p.kat,
            ucet: p.ucet, ucetDo: null,
            pozn: p.pozn || p.nazev || '', zdroj: p.id
          });
          p.posledni = kurzor;
          pridano++;
        }
        kurzor = dalsiMesic(kurzor);
      }
    });
    if (pridano) uloz();
    return pridano;
  }

  function dalsiMesic(klic) {
    var rok = +klic.slice(0, 4), mes = +klic.slice(5, 7) - 1;
    var d = new Date(rok, mes + 1, 1);
    return klicMesice(d.getFullYear(), d.getMonth());
  }

  /* ---------- export ---------- */

  function doJson() {
    return JSON.stringify({
      aplikace: 'Moje finance', verze: VERZE_DAT,
      zaloha: new Date().toISOString(),
      transakce: stav.transakce, kategorie: stav.kategorie, ucty: stav.ucty,
      rozpocty: stav.rozpocty, pravidelne: stav.pravidelne, nastaveni: stav.nastaveni
    }, null, 1);
  }

  function bunkaCsv(h) {
    var s = String(h == null ? '' : h);
    if (s.indexOf('"') >= 0 || s.indexOf(';') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.split('"').join('""') + '"';
    }
    return s;
  }

  function doCsv() {
    var radky = [['Datum', 'Typ', 'Kategorie', 'Ucet', 'Kam', 'Castka', 'Poznamka']];
    serazene().slice().reverse().forEach(function (t) {
      radky.push([
        t.datum,
        t.typ === 'vydaj' ? 'Výdaj' : (t.typ === 'prijem' ? 'Příjem' : 'Převod'),
        t.typ === 'prevod' ? '' : kategorie(t.kat).nazev,
        ucet(t.ucet).nazev,
        t.ucetDo ? ucet(t.ucetDo).nazev : '',
        String(t.castka).replace('.', ','),
        t.pozn || ''
      ]);
    });
    // BOM, aby Excel poznal diakritiku
    return '﻿' + radky.map(function (r) {
      return r.map(bunkaCsv).join(';');
    }).join('\r\n');
  }

  function nactiZalohu(text) {
    var d = JSON.parse(text);
    if (!d || !Array.isArray(d.transakce)) throw new Error('Soubor nevypadá jako záloha této aplikace.');
    var z = vychoziStav();
    stav.transakce = d.transakce;
    stav.kategorie = Array.isArray(d.kategorie) && d.kategorie.length ? d.kategorie : z.kategorie;
    stav.ucty = Array.isArray(d.ucty) && d.ucty.length ? d.ucty : z.ucty;
    stav.rozpocty = d.rozpocty && typeof d.rozpocty === 'object' ? d.rozpocty : {};
    stav.pravidelne = Array.isArray(d.pravidelne) ? d.pravidelne : [];
    stav.nastaveni = Object.assign({}, z.nastaveni, d.nastaveni || {});
    ulozHned();
    return stav.transakce.length;
  }

  function vymazVse() {
    stav = vychoziStav();
    ulozHned();
  }

  /* ---------- rozhraní ---------- */

  global.FData = {
    KLIC: KLIC,
    MESICE: MESICE,
    MESICE_KRATCE: MESICE_KRATCE,
    nacti: nacti,
    nactiZTextu: nactiZTextu,
    nastavSifru: nastavSifru,
    jeSifrovano: jeSifrovano,
    syrovyTrezor: syrovyTrezor,
    syrovaData: syrovaData,
    zapisTrezor: zapisTrezor,
    smazPlain: smazPlain,
    smazTrezor: smazTrezor,
    zavri: zavri,
    dopisAVycti: dopisAVycti,
    uloz: uloz,
    ulozHned: ulozHned,
    stav: function () { return stav; },
    noveId: noveId,
    naISO: naISO,
    zISO: zISO,
    dnesISO: dnesISO,
    dvojcisli: dvojcisli,
    klicMesice: klicMesice,
    popisDne: popisDne,
    pridejTransakci: pridejTransakci,
    upravTransakci: upravTransakci,
    smazTransakci: smazTransakci,
    najdi: najdi,
    kategorie: kategorie,
    ucet: ucet,
    kategorieTypu: kategorieTypu,
    serazene: serazene,
    vMesici: vMesici,
    souhrn: souhrn,
    zustatekUctu: zustatekUctu,
    celkovyZustatek: celkovyZustatek,
    podleKategorii: podleKategorii,
    poslednichMesicu: poslednichMesicu,
    stavRozpoctu: stavRozpoctu,
    souhrnRozsah: souhrnRozsah,
    souhrnDnes: souhrnDnes,
    souhrnTydne: souhrnTydne,
    trendyKategorii: trendyKategorii,
    sablony: sablony,
    dopisPravidelne: dopisPravidelne,
    doJson: doJson,
    doCsv: doCsv,
    nactiZalohu: nactiZalohu,
    vymazVse: vymazVse
  };

})(window);
