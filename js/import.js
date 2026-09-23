/* ---------------------------------------------------------------
   import.js – načtení výpisu z banky (CSV nebo GPC/ABO)

   Sloupce se hledají podle názvů v hlavičce, takže to bere výpisy
   různých bank bez nastavování. Když se trefa nepovede, uživatel
   si sloupce přehodí ručně (viz `sloupce` ve výsledku rozboru).

   Kategorie se doplňují samy: napřed podle pravidel, která se
   appka naučila z oprav uživatele, pak podle vestavěného slovníku
   obchodů. Nic se nikam neposílá.
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  /* ---------- text souboru ---------- */

  /** Bajty → text. Zkusí UTF-8, když nesedí, vezme českou kódovou stránku. */
  function dekoduj(buf) {
    var b = new Uint8Array(buf);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, '');
    } catch (e) {
      try { return new TextDecoder('windows-1250').decode(b); }
      catch (e2) { return new TextDecoder('utf-8').decode(b); }
    }
  }

  /* ---------- CSV ---------- */

  function rozdelCsv(text, odd) {
    var radky = [], radek = [], bunka = '', v = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (v) {
        if (c === '"') {
          if (text[i + 1] === '"') { bunka += '"'; i++; } else v = false;
        } else bunka += c;
      } else if (c === '"') v = true;
      else if (c === odd) { radek.push(bunka); bunka = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        radek.push(bunka); bunka = '';
        radky.push(radek); radek = [];
      } else bunka += c;
    }
    if (bunka !== '' || radek.length) { radek.push(bunka); radky.push(radek); }
    return radky.map(function (r) { return r.map(function (x) { return x.trim(); }); })
      .filter(function (r) { return r.some(function (x) { return x !== ''; }); });
  }

  /** Oddělovač = ten, se kterým má nejvíc řádků stejný (a víc než dvou-sloupcový) tvar. */
  function najdiOddelovac(text) {
    var vzorek = text.slice(0, 20000);
    var nej = ';', nejSkore = -1;
    [';', ',', '\t', '|'].forEach(function (odd) {
      var radky = rozdelCsv(vzorek, odd);
      var cetnost = {};
      radky.forEach(function (r) { if (r.length >= 3) cetnost[r.length] = (cetnost[r.length] || 0) + 1; });
      var skore = 0;
      Object.keys(cetnost).forEach(function (k) { skore = Math.max(skore, cetnost[k] * Math.min(+k, 12)); });
      if (skore > nejSkore) { nejSkore = skore; nej = odd; }
    });
    return nej;
  }

  /* ---------- čísla a data ---------- */

  function castka(s) {
    s = String(s == null ? '' : s).replace(/[\s  ']/g, '').replace(/−/g, '-');
    s = s.replace(/[A-Za-zÀ-ž€$£]+\.?$/g, '').replace(/^[A-Za-zÀ-ž€$£]+/g, '');
    if (!s) return NaN;
    var zapor = false;
    if (/-$/.test(s)) { zapor = true; s = s.slice(0, -1); }
    if (/^\(.*\)$/.test(s)) { zapor = true; s = s.slice(1, -1); }
    if (/^[+-]/.test(s)) { if (s[0] === '-') zapor = !zapor; s = s.slice(1); }
    if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return NaN;
    var carka = s.lastIndexOf(','), tecka = s.lastIndexOf('.');
    if (carka >= 0 && tecka >= 0) {
      s = carka > tecka ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (carka >= 0) {
      s = (s.split(',').length > 2) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (s.split('.').length > 2) {
      s = s.replace(/\./g, '');
    }
    var n = Number(s);
    if (!isFinite(n)) return NaN;
    return zapor ? -n : n;
  }

  function dvoj(n) { return (n < 10 ? '0' : '') + n; }

  function datum(s) {
    s = String(s || '').trim();
    var m, r, mes, d;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) { r = +m[1]; mes = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(s))) { d = +m[1]; mes = +m[2]; r = +m[3]; }
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) { d = +m[1]; mes = +m[2]; r = +m[3]; }
    else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2})(?!\d)/.exec(s))) { d = +m[1]; mes = +m[2]; r = 2000 + +m[3]; }
    else if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) { r = +m[1]; mes = +m[2]; d = +m[3]; }
    else return null;
    if (mes < 1 || mes > 12 || d < 1 || d > 31 || r < 1990 || r > 2100) return null;
    return r + '-' + dvoj(mes) + '-' + dvoj(d);
  }

  /* ---------- rozpoznání sloupců ---------- */

  function bezDiakritiky(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Pořadí vzorů = priorita. Vyhrává první vzor, který sedí na nějaký sloupec.
  var ROLE = {
    datum: [/datum proveden/, /datum uskutecn/, /datum transakce/, /started date/, /^datum$/, /^date$/,
      /datum zauctovan/, /completed date/, /datum splatnosti/, /datum/, /date/],
    castka: [/castka v mene uctu/, /zauctovana castka/, /castka transakce/, /^objem$/, /^castka$/,
      /^amount$/, /^suma$/, /castka/, /objem/, /amount/],
    prijem: [/^(kredit|credit|pripsano|prijem|prichozi castka)$/],
    vydaj: [/^(debet|debit|odepsano|vydaj|odchozi castka)$/],
    smer: [/smer uhrady/, /smer platby/, /^smer$/, /direction/, /debet\s*\/\s*kredit/],
    stav: [/^state$/, /^stav$/, /^status$/, /stav transakce/],
    nazev: [/nazev protistrany/, /nazev protiuctu/, /^protistrana$/, /obchodni misto/, /obchodnik/,
      /merchant/, /platce\s*\/\s*prijemce/, /nazev obchodu/, /^description$/, /popis transakce/,
      /^popis$/, /nazev/],
    zprava: [/zprava pro prijemce/, /zprava pro mne/, /^zprava$/, /poznamka k uhrade/, /^poznamka$/,
      /popis pro prijemce/, /popis prikazce/, /message/, /reference/, /^note$/, /informace k platbe/, /upresneni/, /komentar/, /poznamka/],
    typ: [/typ uhrady/, /typ transakce/, /typ operace/, /oznaceni operace/, /^typ$/, /^type$/,
      /kategorie transakce/, /systemovy popis/],
    mena: [/^mena$/, /^currency$/, /mena uctu/]
  };

  var NEBRAT_CASTKU = /zustatek|balance|poplatek|fee|original|puvodni|kurz|rate|cislo/;

  function priradRole(hlavicka) {
    var h = hlavicka.map(bezDiakritiky).map(function (x) { return x.replace(/^#/, '').trim(); });
    var obsazeno = {}, role = {};
    ['datum', 'castka', 'prijem', 'vydaj', 'smer', 'stav', 'nazev', 'zprava', 'typ', 'mena']
      .forEach(function (r) {
        var vzory = ROLE[r];
        for (var v = 0; v < vzory.length; v++) {
          for (var i = 0; i < h.length; i++) {
            if (obsazeno[i] || !vzory[v].test(h[i])) continue;
            if ((r === 'castka' || r === 'prijem' || r === 'vydaj') && NEBRAT_CASTKU.test(h[i])) continue;
            role[r] = i; obsazeno[i] = true; return;
          }
        }
      });
    return role;
  }

  /** Bez hlavičky: sloupce se odhadnou podle obsahu. */
  function odhadniRole(radky) {
    var sloupcu = radky.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
    var role = {}, nejDelka = 0;
    for (var i = 0; i < sloupcu; i++) {
      var dat = 0, cis = 0, delka = 0, n = 0;
      radky.slice(0, 60).forEach(function (r) {
        var x = r[i] || ''; n++;
        if (datum(x)) dat++;
        else if (!isNaN(castka(x)) && /[.,]\d{1,2}$|^-/.test(x.replace(/\s/g, ''))) cis++;
        delka += /[a-zá-ž]{3}/i.test(x) ? x.length : 0;
      });
      if (role.datum === undefined && dat > n * 0.7) role.datum = i;
      else if (role.castka === undefined && cis > n * 0.7) role.castka = i;
      else if (delka / Math.max(1, n) > nejDelka) { nejDelka = delka / Math.max(1, n); role.nazev = i; }
    }
    return role;
  }

  /* ---------- rozbor souboru ---------- */

  /**
   * Rozebere text výpisu. Vrací { pohyby, sloupce, hlavicka, format, chyba }.
   * `vynucene` = ruční přiřazení sloupců { datum, castka, nazev } (indexy).
   */
  function rozeber(text, vynucene) {
    if (/^0(74|75)/m.test(text.slice(0, 400)) && /^075/m.test(text)) return rozeberGpc(text);

    var odd = najdiOddelovac(text);
    var radky = rozdelCsv(text, odd);
    if (!radky.length) return { pohyby: [], chyba: 'Soubor je prázdný.' };

    // hlavička = první řádek, který jmenuje datum i částku (banky dávají nad ni ještě úvod)
    var iHlavicky = -1;
    for (var i = 0; i < Math.min(radky.length, 40); i++) {
      var r = radky[i].map(bezDiakritiky).join('|');
      if (/datum|date/.test(r) && /castka|objem|amount|suma|kredit|debet|credit|debit/.test(r)) { iHlavicky = i; break; }
    }
    var hlavicka = iHlavicky >= 0 ? radky[iHlavicky] : [];
    var data = radky.slice(iHlavicky + 1);
    var role = iHlavicky >= 0 ? priradRole(hlavicka) : odhadniRole(data);
    if (vynucene) {
      ['datum', 'castka', 'nazev', 'zprava'].forEach(function (k) {
        if (vynucene[k] !== undefined && vynucene[k] !== null && vynucene[k] !== '') {
          role[k] = Number(vynucene[k]);
          if (k === 'castka') { delete role.prijem; delete role.vydaj; }
        } else if (vynucene[k] === '') delete role[k];
      });
    }
    if (!hlavicka.length) {
      var n = radky.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
      for (var s = 0; s < n; s++) hlavicka.push('Sloupec ' + (s + 1));
    }

    var pohyby = [];
    data.forEach(function (r) {
      var d = datum(r[role.datum]);
      if (!d) return;
      var c;
      if (role.castka !== undefined) c = castka(r[role.castka]);
      if ((c === undefined || isNaN(c)) && (role.prijem !== undefined || role.vydaj !== undefined)) {
        var p = castka(r[role.prijem]), v = castka(r[role.vydaj]);
        c = (isNaN(p) ? 0 : Math.abs(p)) - (isNaN(v) ? 0 : Math.abs(v));
      }
      if (c === undefined || isNaN(c) || c === 0) return;
      if (role.smer !== undefined && c > 0) {
        var sm = bezDiakritiky(r[role.smer]);
        if (/odchozi|debet|debit|vydaj|out/.test(sm)) c = -c;
      }
      if (role.stav !== undefined) {
        var st = bezDiakritiky(r[role.stav]);
        if (/revert|declin|fail|zamitnut|zrusen|cancel/.test(st)) return;
      }
      var nazev = role.nazev !== undefined ? r[role.nazev] || '' : '';
      var zprava = role.zprava !== undefined ? r[role.zprava] || '' : '';
      var typ = role.typ !== undefined ? r[role.typ] || '' : '';
      pohyby.push(pohyb(d, c, nazev, zprava, typ));
    });

    return {
      pohyby: pohyby,
      format: 'CSV',
      hlavicka: hlavicka,
      sloupce: { datum: role.datum, castka: role.castka !== undefined ? role.castka : role.vydaj,
        nazev: role.nazev, zprava: role.zprava },
      chyba: pohyby.length ? null
        : 'V souboru jsem nenašel žádné pohyby. Zkuste níž přiřadit sloupce ručně.'
    };
  }

  function pohyb(d, c, nazev, zprava, typ) {
    // „Nákup: LIDL…“ – předpona banky nic neříká
    var PREDPONA = /^(nákup|nakup|platba kartou|platba|card payment|purchase)\s*:\s*/i;
    nazev = String(nazev || '').replace(/\s+/g, ' ').trim().replace(PREDPONA, '');
    zprava = String(zprava || '').replace(/\s+/g, ' ').trim().replace(PREDPONA, '');
    var popis = nazev || zprava || String(typ || '').trim() || (c < 0 ? 'Platba' : 'Příchozí platba');
    if (nazev && zprava && bezDiakritiky(zprava).indexOf(bezDiakritiky(nazev)) < 0 &&
        bezDiakritiky(nazev).indexOf(bezDiakritiky(zprava)) < 0) {
      popis = nazev + ' · ' + zprava;
    }
    return {
      datum: d,
      castka: Math.round(c * 100) / 100,
      popis: popis.slice(0, 90),
      nazev: nazev, zprava: zprava, druh: String(typ || '')
    };
  }

  /* ---------- GPC (ABO) – formát, který umí Fio, KB, ČSOB a další ---------- */

  function rozeberGpc(text) {
    var pohyby = [];
    var radky = text.split(/\r?\n/);
    var posledni = null;
    radky.forEach(function (r) {
      if (r.slice(0, 3) === '075' && r.length >= 97) {
        var hal = parseInt(r.slice(48, 60), 10);
        var kod = r.charAt(60);
        if (isNaN(hal)) return;
        var c = hal / 100;
        if (kod === '1' || kod === '5') c = -c;       // 1 = debet, 5 = storno kreditu
        var d = gpcDatum(r.slice(122, 128)) || gpcDatum(r.slice(91, 97));
        if (!d || !c) return;
        var nazev = r.slice(97, 117).trim();
        posledni = pohyb(d, c, nazev, '', '');
        pohyby.push(posledni);
      } else if (/^07[689]/.test(r) && posledni) {
        // doplňkové řádky nesou zprávu (Fio: 076 = zpráva, 078/079 = avízo)
        var zprava = r.slice(3).replace(/^\d{6}/, '').trim();
        if (zprava && !posledni.zprava) {
          posledni.zprava = zprava;
          var p = pohyb(posledni.datum, posledni.castka, posledni.nazev, zprava, '');
          posledni.popis = p.popis;
        }
      }
    });
    return {
      pohyby: pohyby, format: 'GPC', hlavicka: [], sloupce: null,
      chyba: pohyby.length ? null : 'Soubor vypadá jako GPC, ale nenašel jsem v něm pohyby.'
    };
  }

  function gpcDatum(s) {
    if (!/^\d{6}$/.test(s)) return null;
    return datum(s.slice(0, 2) + '.' + s.slice(2, 4) + '.20' + s.slice(4, 6));
  }

  /* ---------- klíč obchodníka ---------- */

  var SUM = ('platba kartou platba karta nakup dekujeme dekuje za cz sk com www s r o sro a s as spol ' +
    'praha brno ostrava plzen olomouc liberec pardubice hradec kralove ceske budejovice zlin jihlava ' +
    'cr cze czech republic eur czk usd card payment purchase transfer prevod na z ucet uctu ' +
    'trvaly prikaz inkaso sipo odchozi prichozi uhrada pos terminal the and of').split(' ');
  var SUM_MAPA = {};
  SUM.forEach(function (s) { SUM_MAPA[s] = true; });

  /** Krátký klíč, podle kterého se pozná stejný obchod i s jinou pobočkou. */
  function klic(p) {
    var t = bezDiakritiky(p.nazev || p.popis || '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(function (s) { return s.length >= 2 && !SUM_MAPA[s] && !/^\d+$/.test(s); });
    return t.slice(0, 2).join(' ');
  }

  /* ---------- vestavěný slovník ---------- */

  var SLOVNIK = [
    ['k-potraviny', 'lidl albert billa kaufland tesco penny globus coop zabka norma rohlik kosik ' +
      'makro hruska potraviny pekarna reznictvi jip tamda flop delmart kolonial ovoce zelenina'],
    ['k-restaurace', 'mcdonald kfc burger king subway starbucks costa wolt foodora bolt food ' +
      'damejidlo restaurace restaurant bistro kavarna cafe coffee pizzeria pizza bageterie ' +
      'paul ugo hospoda pivnice jidelna menza sushi kebab gyros bufet'],
    ['k-doprava', 'ceske drahy cd cz regiojet leo express flixbus dpp dpmb dpo idos litacka ' +
      'jizdenka mhd uber liftago taxi arriva student agency parkovani parking mpla'],
    ['k-auto', 'shell omv mol benzina orlen eurooil tank ono globus cerpaci cerpadlo ' +
      'pneu servis autoservis stk dalnicni myčka mycka'],
    ['k-zabava', 'netflix spotify hbo max disney youtube apple com bill steam playstation xbox ' +
      'nintendo cinema city kino divadlo ticketportal ticketmaster goout vstupenky'],
    ['k-domacnost', 'dm drogerie rossmann teta ikea hornbach obi bauhaus mountfield jysk ' +
      'kika xxxlutz tedi pepco action'],
    ['k-obleceni', 'zara h m hm reserved primark deichmann ccc about you zalando vinted ' +
      'c a lindex new yorker bershka pull bear'],
    ['k-sport', 'decathlon sportisimo intersport a3 sport hervis gym fitness posilovna bazen'],
    ['k-zdravi', 'lekarna benu dr max drmax pilulka zdravotni poliklinika nemocnice lekar ' +
      'zubar optika'],
    ['k-telefon', 'o2 t mobile tmobile vodafone upc nordic telecom starnet internet'],
    ['k-energie', 'cez pre innogy e on eon plynarenska ppas bohemia energy teplarna vodarny ' +
      'pvk centropol'],
    ['k-cestovani', 'booking airbnb ryanair wizz smartwings easyjet hotel hostel ubytovani ' +
      'invia cedok fischer'],
    ['k-vzdelani', 'knihy luxor kosmas martinus skola kurz udemy coursera'],
    ['k-poplatky', 'poplatek vedeni uctu sankce urok z prodleni']
  ].map(function (z) {
    return { kat: z[0], slova: z[1].split(' ').filter(Boolean) };
  });

  // víceslovné názvy hledáme i spojené („cinema city“, „burger king“)
  var VICESLOVNE = [
    ['k-zabava', /cinema city|apple com bill|youtube premium/],
    ['k-restaurace', /burger king|bolt food|dame jidlo|damejidlo/],
    ['k-doprava', /ceske drahy|leo express|student agency/],
    ['k-obleceni', /about you|new yorker|pull bear/],
    ['k-zdravi', /dr max|dr\.max/]
  ];

  function podleSlovniku(text) {
    var t = ' ' + bezDiakritiky(text).replace(/[^a-z0-9]+/g, ' ') + ' ';
    for (var i = 0; i < VICESLOVNE.length; i++) {
      if (VICESLOVNE[i][1].test(t)) return VICESLOVNE[i][0];
    }
    for (var s = 0; s < SLOVNIK.length; s++) {
      var slova = SLOVNIK[s].slova;
      for (var j = 0; j < slova.length; j++) {
        var w = slova[j];
        if (w.length < 3 && w !== 'o2' && w !== 'dm' && w !== 'cd') continue;
        if (t.indexOf(' ' + w + ' ') >= 0 || (w.length >= 5 && t.indexOf(w) >= 0)) return SLOVNIK[s].kat;
      }
    }
    return null;
  }

  var VYBER = /bankomat|\batm\b|vyber hotovosti|vyber z|cash withdrawal|withdraw/;

  /**
   * Doplní každému pohybu typ, kategorii a klíč.
   * `pravidla` = naučené { klic: idKategorie }, `jeKat(id)` ověří, že kategorie existuje.
   */
  function zatrid(pohyby, pravidla, jeKat, idHotovosti) {
    pravidla = pravidla || {};
    pohyby.forEach(function (p) {
      p.klic = klic(p);
      p.typ = p.castka < 0 ? 'vydaj' : 'prijem';
      p.suma = Math.abs(p.castka);
      p.zdrojKat = null;
      var text = p.popis + ' ' + (p.druh || '');
      var celyText = bezDiakritiky(p.nazev + ' ' + p.zprava + ' ' + p.popis + ' ' + (p.druh || ''));

      if (p.typ === 'vydaj' && idHotovosti && VYBER.test(celyText)) {
        p.prevod = true; p.kat = null; p.zdrojKat = 'vyber';
        return;
      }
      if (p.klic && pravidla[p.klic] && jeKat(pravidla[p.klic], p.typ)) {
        p.kat = pravidla[p.klic]; p.zdrojKat = 'pravidlo'; return;
      }
      if (p.typ === 'vydaj') {
        var k = podleSlovniku(text);
        if (k && jeKat(k, 'vydaj')) { p.kat = k; p.zdrojKat = 'slovnik'; return; }
        p.kat = jeKat('k-jine', 'vydaj') ? 'k-jine' : null;
      } else {
        var z = celyText;
        var pk = /mzda|vyplata|\bplat\b|salary|wage/.test(z) ? 'p-vyplata'
          : (/urok|interest/.test(z) ? 'p-uroky'
          : (/vratka|refund|vraceni|storno|dobropis/.test(z) ? 'p-vratka' : 'p-jine'));
        if (!jeKat(pk, 'prijem')) pk = 'p-jine';
        p.kat = jeKat(pk, 'prijem') ? pk : null;
        if (pk !== 'p-jine') p.zdrojKat = 'slovnik';
      }
    });
    return pohyby;
  }

  /* ---------- otisk kvůli dvojímu načtení ---------- */

  function otisky(pohyby) {
    var videno = {};
    pohyby.forEach(function (p) {
      var zaklad = p.datum + '|' + p.castka.toFixed(2) + '|' +
        bezDiakritiky(p.popis).replace(/[^a-z0-9]/g, '').slice(0, 40);
      videno[zaklad] = (videno[zaklad] || 0) + 1;
      p.otisk = zaklad + '|' + videno[zaklad];
    });
    return pohyby;
  }

  global.FImport = {
    dekoduj: dekoduj,
    rozeber: rozeber,
    zatrid: zatrid,
    otisky: otisky,
    klic: klic,
    castka: castka,
    datum: datum,
    podleSlovniku: podleSlovniku,
    bezDiakritiky: bezDiakritiky
  };

})(window);
