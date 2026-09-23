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
    { id: 'k-potraviny', nazev: 'Potraviny', ikona: 'kosik', typ: 'vydaj', barva: 1 },
    { id: 'k-restaurace', nazev: 'Jídlo venku', ikona: 'restaurace', typ: 'vydaj', barva: 2 },
    { id: 'k-bydleni', nazev: 'Bydlení', ikona: 'dum', typ: 'vydaj', barva: 3 },
    { id: 'k-energie', nazev: 'Energie', ikona: 'energie', typ: 'vydaj', barva: 4 },
    { id: 'k-doprava', nazev: 'Doprava', ikona: 'autobus', typ: 'vydaj', barva: 5 },
    { id: 'k-auto', nazev: 'Auto', ikona: 'auto', typ: 'vydaj', barva: 6 },
    { id: 'k-zdravi', nazev: 'Zdraví', ikona: 'zdravi', typ: 'vydaj', barva: 7 },
    { id: 'k-zabava', nazev: 'Zábava', ikona: 'zabava', typ: 'vydaj', barva: 8 },
    { id: 'k-obleceni', nazev: 'Oblečení', ikona: 'obleceni', typ: 'vydaj', barva: 1 },
    { id: 'k-domacnost', nazev: 'Domácnost', ikona: 'domacnost', typ: 'vydaj', barva: 2 },
    { id: 'k-deti', nazev: 'Děti', ikona: 'deti', typ: 'vydaj', barva: 3 },
    { id: 'k-sport', nazev: 'Sport', ikona: 'sport', typ: 'vydaj', barva: 4 },
    { id: 'k-cestovani', nazev: 'Cestování', ikona: 'cestovani', typ: 'vydaj', barva: 5 },
    { id: 'k-darky', nazev: 'Dárky', ikona: 'darek', typ: 'vydaj', barva: 6 },
    { id: 'k-poplatky', nazev: 'Poplatky', ikona: 'poplatky', typ: 'vydaj', barva: 7 },
    { id: 'k-telefon', nazev: 'Telefon a net', ikona: 'telefon', typ: 'vydaj', barva: 8 },
    { id: 'k-vzdelani', nazev: 'Vzdělání', ikona: 'vzdelani', typ: 'vydaj', barva: 1 },
    { id: 'k-sporeni', nazev: 'Spoření', ikona: 'sporeni', typ: 'vydaj', barva: 3 },
    { id: 'k-jine', nazev: 'Jiné', ikona: 'jine', typ: 'vydaj', barva: 4 },
    // příjmy
    { id: 'p-vyplata', nazev: 'Výplata', ikona: 'prace', typ: 'prijem', barva: 3 },
    { id: 'p-faktura', nazev: 'Faktura', ikona: 'faktura', typ: 'prijem', barva: 1 },
    { id: 'p-brigada', nazev: 'Brigáda', ikona: 'brigada', typ: 'prijem', barva: 4 },
    { id: 'p-prodej', nazev: 'Prodej', ikona: 'prodej', typ: 'prijem', barva: 2 },
    { id: 'p-dar', nazev: 'Dar', ikona: 'darek', typ: 'prijem', barva: 5 },
    { id: 'p-vratka', nazev: 'Vratka', ikona: 'vratka', typ: 'prijem', barva: 7 },
    { id: 'p-uroky', nazev: 'Úroky', ikona: 'banka', typ: 'prijem', barva: 6 },
    { id: 'p-jine', nazev: 'Jiné', ikona: 'jine', typ: 'prijem', barva: 8 }
  ];

  var VYCHOZI_UCTY = [
    { id: 'u-hotovost', nazev: 'Hotovost', ikona: 'hotovost', pocatek: 0, barva: 4 },
    { id: 'u-karta', nazev: 'Běžný účet', ikona: 'karta', pocatek: 0, barva: 1 },
    { id: 'u-sporici', nazev: 'Spořicí účet', ikona: 'sporeni', pocatek: 0, barva: 3 }
  ];

  /** Data z dob, kdy ikony byly emoji – převod na klíče vektorových ikon. */
  var ZE_SMAJLIKU = {
    '🛒': 'kosik', '🍽️': 'restaurace', '🍽': 'restaurace', '🏠': 'dum', '💡': 'energie',
    '🚌': 'autobus', '🚗': 'auto', '💊': 'zdravi', '🎬': 'zabava', '👕': 'obleceni',
    '🧻': 'domacnost', '🧸': 'deti', '🏋️': 'sport', '🏋': 'sport', '✈️': 'cestovani',
    '✈': 'cestovani', '🎁': 'darek', '🧾': 'poplatky', '📱': 'telefon', '📚': 'vzdelani',
    '🐖': 'sporeni', '❔': 'jine', '❓': 'jine', '💼': 'prace', '🧮': 'faktura',
    '🔧': 'brigada', '📦': 'prodej', '↩️': 'vratka', '↩': 'vratka', '🏦': 'banka',
    '💵': 'hotovost', '💳': 'karta', '🏷️': 'stitek', '🏷': 'stitek', '↔️': 'prevod',
    '💰': 'penezenka', '🐷': 'sporeni', '⛽': 'palivo', '☕': 'kava', '🍺': 'pivo',
    '🍕': 'pizza', '🎮': 'hry', '🎵': 'hudba', '📷': 'foto', '✂️': 'kadernik'
  };

  function ikonaNaKlic(ikona) {
    var i = String(ikona || '');
    if (global.FIkony && global.FIkony.existuje(i)) return i;
    if (ZE_SMAJLIKU[i]) return ZE_SMAJLIKU[i];
    return 'stitek';
  }

  function vychoziStav() {
    return {
      verze: VERZE_DAT,
      transakce: [],
      kategorie: VYCHOZI_KATEGORIE.map(function (k) { return kopie(k); }),
      ucty: VYCHOZI_UCTY.map(function (u) { return kopie(u); }),
      rozpocty: {},
      pravidelne: [],
      pravidla: {},
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
  // šestý pád – „utraceno v září“
  var MESICE_V = ['Lednu', 'Únoru', 'Březnu', 'Dubnu', 'Květnu', 'Červnu',
    'Červenci', 'Srpnu', 'Září', 'Říjnu', 'Listopadu', 'Prosinci'];
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
        pravidla: d.pravidla && typeof d.pravidla === 'object' ? d.pravidla : {},
        nastaveni: Object.assign({}, z.nastaveni, d.nastaveni || {})
      };
    } catch (e) {
      stav = z;
    }
    // starší data měla místo ikon emoji
    stav.kategorie.forEach(function (k) { k.ikona = ikonaNaKlic(k.ikona); });
    stav.ucty.forEach(function (u) { u.ikona = ikonaNaKlic(u.ikona); });
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
    var mela = stav.transakce[i].fotka;
    stav.transakce.splice(i, 1);
    uloz();
    if (mela) smazFotku(id);
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
      { id: id, nazev: 'Bez kategorie', ikona: 'jine', typ: 'vydaj', barva: 4 };
  }

  function ucet(id) {
    return najdi(stav.ucty, id) ||
      { id: id, nazev: 'Neznámý účet', ikona: 'jine', pocatek: 0, barva: 4 };
  }

  /**
   * Rozpad transakce na dvojice kategorie + částka. Nákup rozepsaný na
   * položky se počítá po položkách, aby se každá věc započetla tam,
   * kam patří; ostatní záznamy vrátí jedinou dvojici.
   */
  function rozpad(t) {
    if (t.polozky && t.polozky.length) {
      return t.polozky.map(function (p) {
        return { kat: p.kat || t.kat, castka: p.castka };
      });
    }
    return [{ kat: t.kat, castka: t.castka }];
  }

  function soucetPolozek(polozky) {
    return (polozky || []).reduce(function (a, p) { return a + (Number(p.castka) || 0); }, 0);
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
      rozpad(t).forEach(function (d) {
        if (!mapa[d.kat]) mapa[d.kat] = { kat: d.kat, castka: 0, pocet: 0 };
        mapa[d.kat].castka += d.castka;
        mapa[d.kat].pocet++;
      });
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
      rozpad(t).forEach(function (d) {
        utraceno[d.kat] = (utraceno[d.kat] || 0) + d.castka;
      });
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
      rozpad(t).forEach(function (kus) {
        if (odstup === 0) ted[kus.kat] = (ted[kus.kat] || 0) + kus.castka;
        else if (odstup >= 1 && odstup <= 6) drive[kus.kat] = (drive[kus.kat] || 0) + kus.castka;
      });
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
      // z výpisu a pravidelné platby se zapisují samy, šablony jsou pro ruční zápis
      if (t.typ === 'prevod' || t.datum < od || t.imp || t.zdroj) return;
      var k = t.typ + '|' + t.kat + '|' + t.ucet;
      if (!mapa[k]) mapa[k] = { typ: t.typ, kat: t.kat, ucet: t.ucet, pocet: 0, castky: [], pozn: {} };
      mapa[k].pocet++;
      mapa[k].castky.push(t.castka);
      var p = (t.pozn || '').trim();
      if (p) mapa[k].pozn[p] = (mapa[k].pozn[p] || 0) + 1;
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
      var nejPozn = null;
      Object.keys(z.pozn).forEach(function (p) {
        if (z.pozn[p] * 2 > z.pocet && (!nejPozn || z.pozn[p] > z.pozn[nejPozn])) nejPozn = p;
      });
      z.poznamka = nejPozn || '';
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

  /**
   * Kategorie daného typu seřazené podle toho, jak často se poslední
   * tři měsíce používaly; nepoužité zůstávají ve výchozím pořadí.
   */
  function kategoriePodlePouziti(typ) {
    var hranice = new Date();
    hranice.setDate(hranice.getDate() - 90);
    var od = naISO(hranice);
    var pocty = {};
    stav.transakce.forEach(function (t) {
      if (t.typ !== typ || t.datum < od) return;
      rozpad(t).forEach(function (d) { pocty[d.kat] = (pocty[d.kat] || 0) + 1; });
    });
    var seznam = kategorieTypu(typ);
    return seznam.map(function (k, i) { return { k: k, i: i, n: pocty[k.id] || 0 }; })
      .sort(function (a, b) { return (b.n - a.n) || (a.i - b.i); })
      .map(function (x) { return x.k; });
  }

  /* ---------- podklady pro grafy ---------- */

  var DNY_KRATCE = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

  /** Výdaje po jednotlivých dnech měsíce. */
  function dennitrata(rok, mesic) {
    var poslDen = new Date(rok, mesic + 1, 0).getDate();
    var pole = [];
    for (var d = 1; d <= poslDen; d++) pole.push({ den: d, vydaje: 0, pocet: 0 });
    vMesici(rok, mesic).forEach(function (t) {
      if (t.typ !== 'vydaj') return;
      var d = +t.datum.slice(8, 10);
      if (pole[d - 1]) { pole[d - 1].vydaje += t.castka; pole[d - 1].pocet++; }
    });
    return pole;
  }

  /** Narůstající útrata dne po dni – tento měsíc proti předchozímu. */
  function kumulativne(rok, mesic) {
    function rada(r, m) {
      var poslDen = new Date(r, m + 1, 0).getDate();
      var denni = new Array(poslDen + 1).join('0').split('').map(Number);
      vMesici(r, m).forEach(function (t) {
        if (t.typ !== 'vydaj') return;
        denni[+t.datum.slice(8, 10) - 1] += t.castka;
      });
      var soucet = 0;
      return denni.map(function (v) { soucet += v; return soucet; });
    }
    var predchozi = new Date(rok, mesic - 1, 1);
    return {
      ted: rada(rok, mesic),
      minule: rada(predchozi.getFullYear(), predchozi.getMonth()),
      popisMinule: MESICE[predchozi.getMonth()]
    };
  }

  /** Zůstatek ke konci každého z posledních n měsíců. */
  function zustatkyMesicu(rok, mesic, n) {
    var pocatek = stav.ucty.reduce(function (a, u) { return a + (Number(u.pocatek) || 0); }, 0);
    var vysledek = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(rok, mesic - i + 1, 0);       // poslední den měsíce
      var hranice = naISO(d);
      var zmena = 0;
      stav.transakce.forEach(function (t) {
        if (t.datum > hranice) return;
        if (t.typ === 'prijem') zmena += t.castka;
        else if (t.typ === 'vydaj') zmena -= t.castka;
      });
      vysledek.push({
        rok: d.getFullYear(), mesic: d.getMonth(),
        popis: MESICE_KRATCE[d.getMonth()],
        zustatek: pocatek + zmena
      });
    }
    return vysledek;
  }

  /** Výdaje podle dne v týdnu (pondělí první) za zadaný měsíc. */
  function podleDneVTydnu(rok, mesic) {
    var pole = DNY_KRATCE.map(function (p) { return { popis: p, vydaje: 0, pocet: 0 }; });
    vMesici(rok, mesic).forEach(function (t) {
      if (t.typ !== 'vydaj') return;
      var i = (zISO(t.datum).getDay() + 6) % 7;
      pole[i].vydaje += t.castka;
      pole[i].pocet++;
    });
    return pole;
  }

  /** Výdaje podle účtu – odkud peníze odcházejí. */
  function podleUctu(seznam) {
    var mapa = {};
    seznam.forEach(function (t) {
      if (t.typ !== 'vydaj') return;
      mapa[t.ucet] = (mapa[t.ucet] || 0) + t.castka;
    });
    return Object.keys(mapa).map(function (id) {
      var u = ucet(id);
      return { kat: id, nazev: u.nazev, ikona: u.ikona, barva: u.barva, castka: mapa[id], pocet: 0 };
    }).sort(function (a, b) { return b.castka - a.castka; });
  }

  /* ---------- účtenky (fotky v IndexedDB) ---------- */

  var DB_NAZEV = 'moje-finance-fotky';
  var DB_SKLAD = 'fotky';
  var dbSlib = null;

  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise(function (splnit, zamitnout) {
      if (!global.indexedDB) { zamitnout(new Error('bez IndexedDB')); return; }
      var zadost = global.indexedDB.open(DB_NAZEV, 1);
      zadost.onupgradeneeded = function () {
        var d = zadost.result;
        if (!d.objectStoreNames.contains(DB_SKLAD)) d.createObjectStore(DB_SKLAD, { keyPath: 'id' });
      };
      zadost.onsuccess = function () { splnit(zadost.result); };
      zadost.onerror = function () { zamitnout(zadost.error); };
    });
    return dbSlib;
  }

  function operace(rezim, prace) {
    return db().then(function (d) {
      return new Promise(function (splnit, zamitnout) {
        var tr = d.transaction(DB_SKLAD, rezim);
        var zadost = prace(tr.objectStore(DB_SKLAD));
        zadost.onsuccess = function () { splnit(zadost.result); };
        zadost.onerror = function () { zamitnout(zadost.error); };
      });
    });
  }

  /** Uloží fotku k transakci; se zapnutým zámkem zašifrovanou. */
  function ulozFotku(id, bajty) {
    var pripravit = sifra && sifra.zasifrujBin
      ? sifra.zasifrujBin(bajty).then(function (s) { return { data: s, sifrovano: true }; })
      : Promise.resolve({ data: bajty, sifrovano: false });
    return pripravit.then(function (z) {
      return operace('readwrite', function (sklad) {
        return sklad.put({ id: id, data: z.data, sifrovano: z.sifrovano });
      });
    });
  }

  function nactiFotku(id) {
    return operace('readonly', function (sklad) { return sklad.get(id); })
      .then(function (z) {
        if (!z) return null;
        if (!z.sifrovano) return z.data;
        if (!sifra || !sifra.desifrujBin) return null;
        return sifra.desifrujBin(z.data);
      });
  }

  function smazFotku(id) {
    return operace('readwrite', function (sklad) { return sklad.delete(id); })
      .catch(function () { /* fotka nebyla, nevadí */ });
  }

  function vsechnyFotky() {
    return operace('readonly', function (sklad) { return sklad.getAll(); })
      .then(function (zaznamy) {
        return Promise.all((zaznamy || []).map(function (z) {
          var data = (z.sifrovano && sifra && sifra.desifrujBin)
            ? sifra.desifrujBin(z.data) : Promise.resolve(z.data);
          return Promise.resolve(data).then(function (d) { return { id: z.id, data: d }; });
        }));
      })
      .catch(function () { return []; });
  }

  /** Přepíše všechny fotky současnou šifrou (po zapnutí či vypnutí zámku). */
  function prepisFotky(fotky) {
    return fotky.reduce(function (retez, f) {
      return retez.then(function () { return ulozFotku(f.id, f.data); });
    }, Promise.resolve());
  }

  function maFotku(t) { return !!(t && t.fotka); }

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
      rozpocty: stav.rozpocty, pravidelne: stav.pravidelne, pravidla: stav.pravidla,
      nastaveni: stav.nastaveni
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
    var radky = [['Datum', 'Typ', 'Kategorie', 'Ucet', 'Kam', 'Castka', 'Poznamka',
      'Polozky', 'Uctenka']];
    serazene().slice().reverse().forEach(function (t) {
      radky.push([
        t.datum,
        t.typ === 'vydaj' ? 'Výdaj' : (t.typ === 'prijem' ? 'Příjem' : 'Převod'),
        t.typ === 'prevod' ? '' : kategorie(t.kat).nazev,
        ucet(t.ucet).nazev,
        t.ucetDo ? ucet(t.ucetDo).nazev : '',
        String(t.castka).replace('.', ','),
        t.pozn || '',
        (t.polozky || []).map(function (p) {
          return (p.nazev || kategorie(p.kat).nazev) + ' ' + String(p.castka).replace('.', ',');
        }).join(' + '),
        t.fotka ? 'ano' : ''
      ]);
    });
    // BOM, aby Excel poznal diakritiku
    return '﻿' + radky.map(function (r) {
      return r.map(bunkaCsv).join(';');
    }).join('\r\n');
  }

  /* ---------- záloha včetně účtenek ---------- */

  function bajtyNaB64(buf) {
    var b = new Uint8Array(buf), s = '', krok = 8192;
    for (var i = 0; i < b.length; i += krok) {
      s += String.fromCharCode.apply(null, b.subarray(i, i + krok));
    }
    return global.btoa(s);
  }

  function b64NaBajty(text) {
    var bin = global.atob(text), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b.buffer;
  }

  /** Kompletní záloha – i s fotkami účtenek, aby se nedaly ztratit. */
  function doJsonSFotkami() {
    return vsechnyFotky().then(function (fotky) {
      var obal = JSON.parse(doJson());
      obal.fotky = {};
      fotky.forEach(function (f) { obal.fotky[f.id] = bajtyNaB64(f.data); });
      return JSON.stringify(obal, null, 1);
    });
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
    stav.pravidla = d.pravidla && typeof d.pravidla === 'object' ? d.pravidla : {};
    stav.nastaveni = Object.assign({}, z.nastaveni, d.nastaveni || {});
    stav.kategorie.forEach(function (k) { k.ikona = ikonaNaKlic(k.ikona); });
    stav.ucty.forEach(function (u) { u.ikona = ikonaNaKlic(u.ikona); });
    ulozHned();
    if (d.fotky) {
      Object.keys(d.fotky).forEach(function (id) {
        try { ulozFotku(id, b64NaBajty(d.fotky[id])); } catch (e) { /* poškozená fotka */ }
      });
    }
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
    MESICE_V: MESICE_V,
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
    kategoriePodlePouziti: kategoriePodlePouziti,
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
    rozpad: rozpad,
    soucetPolozek: soucetPolozek,
    dennitrata: dennitrata,
    kumulativne: kumulativne,
    zustatkyMesicu: zustatkyMesicu,
    podleDneVTydnu: podleDneVTydnu,
    podleUctu: podleUctu,
    ulozFotku: ulozFotku,
    nactiFotku: nactiFotku,
    smazFotku: smazFotku,
    vsechnyFotky: vsechnyFotky,
    prepisFotky: prepisFotky,
    maFotku: maFotku,
    doJsonSFotkami: doJsonSFotkami,
    dopisPravidelne: dopisPravidelne,
    doJson: doJson,
    doCsv: doCsv,
    nactiZalohu: nactiZalohu,
    vymazVse: vymazVse
  };

})(window);
