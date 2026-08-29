/* ---------------------------------------------------------------
   grafy.js – jednoduché grafy z HTML prvků (žádná knihovna)

   Pravidla, kterých se drží:
   · barva patří KATEGORII, ne pořadí – po filtru si kategorie
     svou barvu podrží
   · dělený pruh nese nejvýš 6 dílů, zbytek se sečte do „Ostatní“
   · každé číslo je vypsané i slovy v seznamu pod grafem, barva
     tedy nikdy nenese význam sama
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var MAX_DILU = 6;

  function barva(slot) {
    var n = Number(slot);
    if (!(n >= 1 && n <= 8)) n = 1;
    return 'var(--s' + n + ')';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Nejvýš 6 dílů: pět největších + součet zbytku. */
  function slozDily(polozky) {
    if (polozky.length <= MAX_DILU) return polozky.slice();
    var hlavni = polozky.slice(0, MAX_DILU - 1);
    var zbytek = polozky.slice(MAX_DILU - 1);
    var soucet = zbytek.reduce(function (a, p) { return a + p.castka; }, 0);
    hlavni.push({
      kat: '__ostatni', nazev: 'Ostatní (' + zbytek.length + ')',
      ikona: 'stitek', barva: 0, castka: soucet,
      pocet: zbytek.reduce(function (a, p) { return a + p.pocet; }, 0),
      ostatni: true
    });
    return hlavni;
  }

  /** Vodorovný dělený pruh – část z celku na jeden pohled. */
  function pruhPodilu(polozky, formatuj) {
    var dily = slozDily(polozky);
    var celkem = dily.reduce(function (a, p) { return a + p.castka; }, 0);
    if (!celkem) return '';
    var html = '<div class="podil-pruh" role="img" aria-label="Rozdělení výdajů podle kategorií">';
    var predchoziSlot = null;
    dily.forEach(function (p) {
      var podil = p.castka / celkem * 100;
      var slot = p.ostatni ? 'ostatni' : String(p.barva);
      var vypln = p.ostatni ? 'var(--ink-3)' : barva(p.barva);
      // Kategorií je víc než odstínů, takže dva sousední díly mohou vyjít
      // stejně. Ten druhý dostane šrafu, aby se nesléval s prvním.
      var styl = 'width:' + podil.toFixed(2) + '%;background-color:' + vypln;
      if (slot === predchoziSlot) {
        styl += ';background-image:repeating-linear-gradient(45deg,' +
          'rgba(255,255,255,.38) 0 4px,rgba(255,255,255,0) 4px 9px)';
      }
      predchoziSlot = slot;
      html += '<div class="podil-dil" style="' + styl + '" title="' +
        esc(p.nazev + ' – ' + formatuj(p.castka) + ' (' + Math.round(podil) + ' %)') + '"></div>';
    });
    return html + '</div>';
  }

  var TREND_PRAH = 0.25;   // menší výkyv není zpráva, jen šum
  var TREND_RADKU = 5;     // a u drobných položek nikoho nezajímá

  /**
   * Odznak „proti obvyklému“: o kolik se kategorie liší od průměru
   * předchozích měsíců za stejně dlouhý úsek. Záměrně skoupý – kdyby
   * visel u každého řádku, přestane si ho člověk všímat.
   */
  function trendOdznak(t, poradi) {
    if (!t || poradi >= TREND_RADKU || Math.abs(t.podil) < TREND_PRAH) return '';
    var nahoru = t.podil > 0;
    var procent = Math.round(Math.abs(t.podil) * 100);
    var popis = (nahoru ? 'O ' + procent + ' % víc' : 'O ' + procent + ' % míň') +
      ' než průměr ' + t.mesicu + ' předchozích měsíců' +
      (t.cely ? '' : ' za prvních ' + t.dni + ' dní');
    return '<span class="kat-trend ' + (nahoru ? 'kat-trend-vys' : 'kat-trend-niz') +
      '" title="' + esc(popis) + '">' + (nahoru ? '↑' : '↓') + ' ' + procent + ' %</span>';
  }

  /** Žebříček kategorií: ikona, název, pruh, částka, podíl. */
  function seznamKategorii(polozky, formatuj, trendy) {
    var celkem = polozky.reduce(function (a, p) { return a + p.castka; }, 0);
    if (!celkem) return '';
    var max = polozky[0] ? polozky[0].castka : 1;
    return polozky.map(function (p, poradi) {
      var podil = p.castka / celkem * 100;
      var sirka = Math.max(2, p.castka / max * 100);
      return '<button class="kat-radek" data-kat="' + esc(p.kat) + '">' +
        '<span class="kat-ikona" style="color:' + (p.ostatni ? 'var(--ink-3)' : barva(p.barva)) +
          '">' + global.FIkony.svg(p.ikona) + '</span>' +
        '<span>' +
          '<span class="kat-jmeno">' + esc(p.nazev) +
            trendOdznak(trendy && trendy[p.kat], poradi) + '</span>' +
          '<span class="kat-pruh"><span class="kat-vypln" style="width:' + sirka.toFixed(1) +
            '%;background:' + barva(p.barva) + '"></span></span>' +
        '</span>' +
        '<span>' +
          '<span class="kat-castka">' + esc(formatuj(p.castka)) + '</span>' +
          '<span class="kat-procenta">' + podil.toFixed(podil < 10 ? 1 : 0) + ' %' +
            (p.pocet ? ' · ' + p.pocet + '×' : '') + '</span>' +
        '</span>' +
      '</button>';
    }).join('');
  }

  /**
   * Sloupce po měsících: příjmy vedle výdajů, společná osa.
   * Hodnoty se nevypisují u každého sloupce – čtou se klepnutím,
   * výchozí je poslední měsíc.
   */
  function grafMesicu(mesice, aktivni) {
    var max = 1;
    mesice.forEach(function (m) { max = Math.max(max, m.prijmy, m.vydaje); });
    var html = '<div class="mesice-obal"><div class="mesice-cteni" id="mesice-cteni"></div><div class="mesice-mrizka">';
    mesice.forEach(function (m, i) {
      var hp = Math.max(2, m.prijmy / max * 100);
      var hv = Math.max(2, m.vydaje / max * 100);
      html += '<button class="mesic-sloupec' + (i === aktivni ? ' akt' : '') + '" data-mesic="' + i + '">' +
        '<span class="mesic-dvojice">' +
          '<span class="mesic-bar mesic-bar-p" style="height:' + hp.toFixed(1) + '%"></span>' +
          '<span class="mesic-bar mesic-bar-v" style="height:' + hv.toFixed(1) + '%"></span>' +
        '</span>' +
        '<span class="mesic-popis">' + esc(m.popis) + '</span>' +
      '</button>';
    });
    html += '</div><div class="legenda">' +
      '<span><i class="tecka tecka-prijem"></i>Příjmy</span>' +
      '<span><i class="tecka tecka-vydaj"></i>Výdaje</span>' +
      '</div></div>';
    return html;
  }

  /**
   * Prstencový ukazatel: jeden poměr proti stropu (utraceno z příjmů).
   * Číslo uprostřed nese význam, barva ho jen podtrhuje.
   */
  function prstenec(podil, vypln, hlavni, pod) {
    var R = 42;
    var obvod = 2 * Math.PI * R;
    var kus = Math.max(0, Math.min(1, podil)) * obvod;
    return '<svg class="prstenec-svg" viewBox="0 0 100 100" role="img" aria-label="' +
        esc(hlavni + ' ' + pod) + '">' +
      '<circle class="prstenec-draha" cx="50" cy="50" r="' + R + '"></circle>' +
      '<circle class="prstenec-cara" cx="50" cy="50" r="' + R +
        '" style="stroke:' + vypln + ';stroke-dasharray:' + kus.toFixed(2) + ' ' +
        (obvod - kus).toFixed(2) + '"></circle>' +
    '</svg>' +
    '<span class="prstenec-stred"><b>' + esc(hlavni) + '</b><span>' + esc(pod) + '</span></span>';
  }

  /* =================================================================
     GRAFY NA SAMOSTATNÉ OBRAZOVCE
     ================================================================= */

  /** Sloupce po dnech měsíce; dnešek zvýrazněný, průměr jako čára. */
  function sloupceDnu(dny, dnesniDen, formatuj) {
    var max = 1, soucet = 0, dnu = 0;
    dny.forEach(function (d) {
      max = Math.max(max, d.vydaje);
      if (d.vydaje > 0) { soucet += d.vydaje; dnu++; }
    });
    var prumer = dnu ? soucet / dnu : 0;

    var html = '<div class="dny-mrizka">';
    dny.forEach(function (d) {
      var v = d.vydaje > 0 ? Math.max(4, d.vydaje / max * 100) : 1.5;
      html += '<button class="den-sloupec' + (d.den === dnesniDen ? ' dnes' : '') +
        '" data-den="' + d.den + '" title="' +
        esc(d.den + '. – ' + formatuj(d.vydaje) + (d.pocet ? ' (' + d.pocet + '×)' : '')) + '">' +
        '<span class="den-bar" style="height:' + v.toFixed(1) + '%"></span></button>';
    });
    html += '</div><div class="dny-popisky">';
    // poslední den se popíše jen tehdy, když nesedne těsně vedle pětky
    var posledni = dny.length;
    var popisPosledni = (posledni % 5 > 1);
    dny.forEach(function (d) {
      var ukaz = (d.den === 1 || d.den % 5 === 0 || (d.den === posledni && popisPosledni));
      html += '<span class="den-popis">' + (ukaz ? d.den : '') + '</span>';
    });
    html += '</div>';
    if (prumer > 0) {
      html += '<p class="graf-pod">Průměr v den, kdy jste utráceli: <b>' +
        esc(formatuj(prumer)) + '</b> · dnů s výdajem: <b>' + dnu + '</b></p>';
    }
    return html;
  }

  /** Body čáry na plátně 0 0 300 110. */
  function cesta(hodnoty, sirka, vyska, max) {
    if (!hodnoty.length) return '';
    return hodnoty.map(function (v, i) {
      var x = hodnoty.length > 1 ? i / (hodnoty.length - 1) * sirka : sirka / 2;
      var y = vyska - (max ? v / max : 0) * vyska;
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  /**
   * Narůstající útrata: tenhle měsíc proti minulému na jedné ose.
   * Letošní čára končí u dneška, aby se nedělalo, že měsíc je hotový.
   */
  function caraKumulativne(data, doDne, formatuj) {
    var S = 300, V = 110;
    var ted = data.ted.slice(0, doDne);
    var max = Math.max.apply(null, data.ted.concat(data.minule).concat([1]));
    var html = '<svg class="cara-svg" viewBox="0 0 ' + S + ' ' + V +
      '" preserveAspectRatio="none" role="img" aria-label="Narůstající útrata tento a minulý měsíc">';
    html += '<path class="cara-minule" d="' + cesta(data.minule, S, V, max) + '"/>';
    html += '<path class="cara-ted" d="' + cesta(ted, S, V, max) + '"/>';
    html += '</svg>';
    html += '<div class="legenda">' +
      '<span><i class="cara-vzorek cara-vzorek-ted"></i>Tento měsíc</span>' +
      '<span><i class="cara-vzorek cara-vzorek-minule"></i>' + esc(data.popisMinule) + '</span>' +
      '</div>';
    var tedKonec = ted.length ? ted[ted.length - 1] : 0;
    var minuleStejne = data.minule[Math.min(doDne, data.minule.length) - 1] || 0;
    var rozdil = tedKonec - minuleStejne;
    var veta;
    if (!minuleStejne) veta = 'Za minulý měsíc není s čím srovnávat.';
    else if (rozdil > 0) veta = 'K ' + doDne + '. dni jste utratili o <b>' + esc(formatuj(rozdil)) +
      '</b> víc než ve stejné části minulého měsíce.';
    else veta = 'K ' + doDne + '. dni jste utratili o <b>' + esc(formatuj(-rozdil)) +
      '</b> míň než ve stejné části minulého měsíce.';
    return html + '<p class="graf-pod">' + veta + '</p>';
  }

  /** Vývoj zůstatku – jedna čára s podbarvením. */
  function caraZustatku(mesice, formatuj) {
    var S = 300, V = 110;
    var hodnoty = mesice.map(function (m) { return m.zustatek; });
    var max = Math.max.apply(null, hodnoty.concat([1]));
    var min = Math.min.apply(null, hodnoty.concat([0]));
    var rozsah = (max - min) || 1;
    var body = hodnoty.map(function (v, i) {
      var x = hodnoty.length > 1 ? i / (hodnoty.length - 1) * S : S / 2;
      var y = V - (v - min) / rozsah * (V - 10) - 5;
      return { x: x, y: y };
    });
    var d = body.map(function (b, i) {
      return (i ? 'L' : 'M') + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }).join(' ');
    var plocha = d + ' L' + S + ' ' + V + ' L0 ' + V + ' Z';

    var html = '<svg class="cara-svg" viewBox="0 0 ' + S + ' ' + V +
      '" preserveAspectRatio="none" role="img" aria-label="Vývoj zůstatku">' +
      '<path class="cara-plocha" d="' + plocha + '"/>' +
      '<path class="cara-ted" d="' + d + '"/>' +
      '</svg><div class="dny-popisky">' +
      mesice.map(function (m) { return '<span class="den-popis">' + esc(m.popis) + '</span>'; }).join('') +
      '</div>';
    var prvni = hodnoty[0], posledni = hodnoty[hodnoty.length - 1];
    var zmena = posledni - prvni;
    html += '<p class="graf-pod">Za sledované období ' +
      (zmena >= 0 ? 'jste si polepšili o <b>' : 'ubylo <b>') +
      esc(formatuj(Math.abs(zmena))) + '</b>.</p>';
    return html;
  }

  /** Sedm sloupců podle dne v týdnu. */
  function sloupceTydne(dny, formatuj) {
    var max = Math.max.apply(null, dny.map(function (d) { return d.vydaje; }).concat([1]));
    var nej = 0;
    dny.forEach(function (d, i) { if (d.vydaje > dny[nej].vydaje) nej = i; });
    var html = '<div class="tyden-mrizka">';
    dny.forEach(function (d, i) {
      var v = d.vydaje > 0 ? Math.max(4, d.vydaje / max * 100) : 1.5;
      html += '<div class="tyden-sloupec" title="' + esc(d.popis + ' – ' + formatuj(d.vydaje)) + '">' +
        '<span class="tyden-bar' + (i === nej && d.vydaje > 0 ? ' nej' : '') +
          '" style="height:' + v.toFixed(1) + '%"></span>' +
        '<span class="den-popis">' + esc(d.popis) + '</span></div>';
    });
    html += '</div>';
    if (dny[nej].vydaje > 0) {
      html += '<p class="graf-pod">Nejvíc utrácíte v <b>' +
        ['pondělí', 'úterý', 'středu', 'čtvrtek', 'pátek', 'sobotu', 'neděli'][nej] +
        '</b> – ' + esc(formatuj(dny[nej].vydaje)) + '.</p>';
    }
    return html;
  }

  global.FGrafy = {
    barva: barva,
    prstenec: prstenec,
    sloupceDnu: sloupceDnu,
    caraKumulativne: caraKumulativne,
    caraZustatku: caraZustatku,
    sloupceTydne: sloupceTydne,
    esc: esc,
    slozDily: slozDily,
    pruhPodilu: pruhPodilu,
    seznamKategorii: seznamKategorii,
    grafMesicu: grafMesicu
  };

})(window);
