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
      ikona: '▫️', barva: 0, castka: soucet,
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

  /** Žebříček kategorií: ikona, název, pruh, částka, podíl. */
  function seznamKategorii(polozky, formatuj) {
    var celkem = polozky.reduce(function (a, p) { return a + p.castka; }, 0);
    if (!celkem) return '';
    var max = polozky[0] ? polozky[0].castka : 1;
    return polozky.map(function (p) {
      var podil = p.castka / celkem * 100;
      var sirka = Math.max(2, p.castka / max * 100);
      return '<button class="kat-radek" data-kat="' + esc(p.kat) + '">' +
        '<span class="kat-ikona">' + esc(p.ikona) + '</span>' +
        '<span>' +
          '<span class="kat-jmeno">' + esc(p.nazev) + '</span>' +
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

  global.FGrafy = {
    barva: barva,
    esc: esc,
    slozDily: slozDily,
    pruhPodilu: pruhPodilu,
    seznamKategorii: seznamKategorii,
    grafMesicu: grafMesicu
  };

})(window);
