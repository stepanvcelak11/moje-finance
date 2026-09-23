/* ---------------------------------------------------------------
   zamek.js – PIN, biometrika a šifrování dat v telefonu

   Jak to drží pohromadě:
   · data šifruje náhodný klíč (DEK), ne přímo PIN
   · DEK je uložený dvakrát zabalený: jednou klíčem odvozeným z PINu
     (PBKDF2), volitelně podruhé klíčem z otisku/obličeje (WebAuthn PRF)
   · změna PINu tedy jen přebalí DEK, data se nepřepisují
   · bez PINu (nebo otisku) se z localStorage nedá nic přečíst

   ⚠ Zapomenutý PIN znamená ztracená data. Proto je záloha nešifrovaná
   a aplikace o ni říká.
   --------------------------------------------------------------- */
(function (global) {
  'use strict';

  var D = global.FData;

  var ITERACI = 250000;
  var DELKA_MIN = 4;
  var DELKA_MAX = 6;
  var VYCHOZI_PRODLEVA = 60000;   // po minutě na pozadí se zamkne

  var dek = null;            // klíč k datům, jen v paměti
  var obalka = null;         // { v, delka, pin:{...}, bio:{...}|null, iv, data }
  var rezim = null;          // 'nastavit' | 'potvrdit' | 'odemknout'
  var zadano = '';
  var prvniPin = '';
  var poSpusteni = null;
  var skrytoOd = 0;
  var chybnych = 0;
  var blokovanoDo = 0;
  var zamceno = true;

  /* ---------- drobnosti ---------- */

  function $(id) { return document.getElementById(id); }

  function podporovano() {
    return !!(global.crypto && global.crypto.subtle && global.isSecureContext);
  }

  function biometrikaMozna() {
    return podporovano() && !!(global.PublicKeyCredential && navigator.credentials);
  }

  function nahodne(n) { return global.crypto.getRandomValues(new Uint8Array(n)); }

  function doB64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return global.btoa(s);
  }

  function zB64(text) {
    var bin = global.atob(text), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }

  function naBajty(text) { return new TextEncoder().encode(text); }
  function zBajtu(buf) { return new TextDecoder().decode(buf); }

  /* ---------- šifrování ---------- */

  function klicZPinu(pin, sul, iteraci) {
    return global.crypto.subtle.importKey('raw', naBajty(pin), 'PBKDF2', false, ['deriveKey'])
      .then(function (zaklad) {
        return global.crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: sul, iterations: iteraci, hash: 'SHA-256' },
          zaklad, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
      });
  }

  function klicZBiometriky(vystup, sul) {
    return global.crypto.subtle.importKey('raw', vystup, 'HKDF', false, ['deriveKey'])
      .then(function (zaklad) {
        return global.crypto.subtle.deriveKey(
          { name: 'HKDF', hash: 'SHA-256', salt: sul, info: naBajty('moje-finance-bio') },
          zaklad, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
      });
  }

  function novyDek() {
    return global.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true,
      ['encrypt', 'decrypt']);
  }

  function zabal(klic, kek) {
    var iv = nahodne(12);
    return global.crypto.subtle.wrapKey('raw', klic, kek, { name: 'AES-GCM', iv: iv })
      .then(function (buf) { return { iv: doB64(iv), obal: doB64(buf) }; });
  }

  function rozbal(zaznam, kek) {
    return global.crypto.subtle.unwrapKey('raw', zB64(zaznam.obal), kek,
      { name: 'AES-GCM', iv: zB64(zaznam.iv) },
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  /* ---------- obálka v localStorage ---------- */

  function nactiObalku() {
    var syrove = D.syrovyTrezor();
    if (!syrove) return null;
    try {
      var o = JSON.parse(syrove);
      return (o && o.pin && o.pin.obal) ? o : null;
    } catch (e) { return null; }
  }

  function sifraProData() {
    return {
      zasifruj: function (text) {
        var iv = nahodne(12);
        return global.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, dek, naBajty(text))
          .then(function (buf) {
            obalka.iv = doB64(iv);
            obalka.data = doB64(buf);
            return JSON.stringify(obalka);
          });
      },
      desifruj: function (text) {
        var o = JSON.parse(text);
        return global.crypto.subtle.decrypt({ name: 'AES-GCM', iv: zB64(o.iv) }, dek, zB64(o.data))
          .then(zBajtu);
      },
      // fotky účtenek: iv se lepí na začátek, ať je to jeden kus dat
      zasifrujBin: function (bajty) {
        var iv = nahodne(12);
        return global.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, dek, bajty)
          .then(function (buf) {
            var vysledek = new Uint8Array(12 + buf.byteLength);
            vysledek.set(iv, 0);
            vysledek.set(new Uint8Array(buf), 12);
            return vysledek.buffer;
          });
      },
      desifrujBin: function (bajty) {
        var b = new Uint8Array(bajty);
        return global.crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) },
          dek, b.subarray(12));
      }
    };
  }

  /* ---------- biometrika (WebAuthn + rozšíření PRF) ---------- */

  function zaregistrujBiometriku() {
    var prfSul = nahodne(32);
    return navigator.credentials.create({
      publicKey: {
        challenge: nahodne(32),
        rp: { name: 'Moje finance' },
        user: { id: nahodne(16), name: 'moje-finance', displayName: 'Moje finance' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged'
        },
        timeout: 60000,
        extensions: { prf: {} }
      }
    }).then(function (cred) {
      if (!cred) throw new Error('bez pověření');
      var vysledky = cred.getClientExtensionResults();
      if (!vysledky || !vysledky.prf || !vysledky.prf.enabled) {
        throw new Error('NEPODPORUJE');
      }
      return { id: cred.rawId, prfSul: prfSul };
    });
  }

  function ziskejPrf(idB64, prfSulB64) {
    return navigator.credentials.get({
      publicKey: {
        challenge: nahodne(32),
        allowCredentials: [{ type: 'public-key', id: zB64(idB64) }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: zB64(prfSulB64) } } }
      }
    }).then(function (cred) {
      var v = cred && cred.getClientExtensionResults();
      if (!v || !v.prf || !v.prf.results || !v.prf.results.first) throw new Error('NEPODPORUJE');
      return v.prf.results.first;
    });
  }

  /* ---------- zapnutí, odemčení, změny ---------- */

  function zalozTrezor(pin) {
    var sul = nahodne(16);
    var stav = D.stav() || D.nacti();
    var fotkyPredtim = null;
    return D.vsechnyFotky()
      .then(function (f) { fotkyPredtim = f; })
      .then(function () { return Promise.all([novyDek(), klicZPinu(pin, sul, ITERACI)]); })
      .then(function (dvojice) {
        dek = dvojice[0];
        return zabal(dek, dvojice[1]);
      })
      .then(function (zabaleny) {
        obalka = {
          v: 1, delka: pin.length,
          pin: { sul: doB64(sul), iter: ITERACI, iv: zabaleny.iv, obal: zabaleny.obal },
          bio: null, iv: null, data: null
        };
        delete stav.nastaveni.bezZamku;
        D.nastavSifru(sifraProData());
        return D.ulozHned();
      })
      .then(function () {
        D.smazPlain();
        zamceno = false;
        // účtenky nasbírané před zapnutím zámku dozašifrujeme
        return D.prepisFotky(fotkyPredtim || []);
      });
  }

  function odemkniPinem(pin) {
    var p = obalka.pin;
    return klicZPinu(pin, zB64(p.sul), p.iter || ITERACI)
      .then(function (kek) { return rozbal(p, kek); })
      .then(dokonciOdemceni);
  }

  function odemkniBiometrikou() {
    var b = obalka.bio;
    if (!b) return Promise.reject(new Error('bez biometriky'));
    return ziskejPrf(b.id, b.sul)
      .then(function (vystup) { return klicZBiometriky(vystup, zB64(b.sul)); })
      .then(function (kek) { return rozbal(b, kek); })
      .then(dokonciOdemceni);
  }

  function dokonciOdemceni(klic) {
    dek = klic;
    var sifra = sifraProData();
    return sifra.desifruj(JSON.stringify(obalka)).then(function (text) {
      D.nactiZTextu(text);
      D.nastavSifru(sifra);
      zamceno = false;
      chybnych = 0;
    });
  }

  function zmenPin(stary, novy) {
    var p = obalka.pin;
    return klicZPinu(stary, zB64(p.sul), p.iter || ITERACI)
      .then(function (kek) { return rozbal(p, kek); })
      .then(function () {
        var sul = nahodne(16);
        return klicZPinu(novy, sul, ITERACI).then(function (kek) {
          return zabal(dek, kek).then(function (z) {
            obalka.pin = { sul: doB64(sul), iter: ITERACI, iv: z.iv, obal: z.obal };
            obalka.delka = novy.length;
            return D.ulozHned();
          });
        });
      });
  }

  function zapniBiometriku() {
    return zaregistrujBiometriku().then(function (reg) {
      var idB64 = doB64(reg.id), sulB64 = doB64(reg.prfSul);
      return ziskejPrf(idB64, sulB64)
        .then(function (vystup) { return klicZBiometriky(vystup, reg.prfSul); })
        .then(function (kek) { return zabal(dek, kek); })
        .then(function (z) {
          obalka.bio = { id: idB64, sul: sulB64, iv: z.iv, obal: z.obal };
          return D.ulozHned();
        });
    });
  }

  function vypniBiometriku() {
    obalka.bio = null;
    return D.ulozHned();
  }

  function maBiometriku() { return !!(obalka && obalka.bio); }

  function vypniZamek() {
    var stav = D.stav();
    stav.nastaveni.bezZamku = true;
    // fotky je nutné přečíst ještě starou šifrou, jinak by zůstaly nečitelné
    return D.vsechnyFotky().then(function (fotky) {
      D.nastavSifru(null);
      return D.ulozHned().then(function () {
        D.smazTrezor();
        obalka = null;
        dek = null;
        return D.prepisFotky(fotky);
      });
    });
  }

  /* ---------- zamykání ---------- */

  function prodleva() {
    var s = D.stav();
    var v = s && s.nastaveni ? s.nastaveni.zamekPo : null;
    return (typeof v === 'number') ? v : VYCHOZI_PRODLEVA;
  }

  function zamkni() {
    if (zamceno || !obalka) return Promise.resolve();
    return D.dopisAVycti().then(function () {
      D.zavri();
      dek = null;
      zamceno = true;
      document.body.classList.add('zamceno');
      rezim = 'odemknout';
      zadano = '';
      vykresliZamek();
      $('zamek').hidden = false;
      // otisk zkusíme rovnou, ať se neťuká zbytečně
      if (maBiometriku()) setTimeout(zkusBiometriku, 250);
    });
  }

  function jeZamceno() { return zamceno; }

  function hlidejPozadi() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        skrytoOd = Date.now();
      } else if (!zamceno && skrytoOd && Date.now() - skrytoOd > prodleva()) {
        zamkni();
      }
    });
  }

  /* ---------- obrazovka zámku ---------- */

  function vykresliZamek() {
    var nastavuje = (rezim === 'nastavit' || rezim === 'potvrdit');
    $('zamek-nadpis').textContent = nastavuje ? 'Zabezpečení' : 'Moje finance';
    $('zamek-popis').textContent =
      rezim === 'nastavit' ? 'Zvolte PIN (4 až 6 číslic)' :
      rezim === 'potvrdit' ? 'Zopakujte PIN' : 'Zadejte PIN';
    $('zamek-poznamka').hidden = !(rezim === 'nastavit');

    var delka = nastavuje ? DELKA_MAX : (obalka ? obalka.delka || DELKA_MAX : DELKA_MAX);
    var tecky = '';
    for (var i = 0; i < delka; i++) {
      tecky += '<span class="tecka-pin' + (i < zadano.length ? ' plna' : '') + '"></span>';
    }
    $('zamek-tecky').innerHTML = tecky;

    var ik = global.FIkony;
    var vlevo = nastavuje
      ? '<button class="kl-tl kl-vedlejsi" data-kl="ok" aria-label="Potvrdit" ' +
          (zadano.length >= DELKA_MIN ? '' : 'disabled') + '>' + ik.svg('ui-ok') + '</button>'
      : (maBiometriku()
          ? '<button class="kl-tl kl-vedlejsi" data-kl="bio" aria-label="Odemknout otiskem">' +
            ik.svg('ui-otisk') + '</button>'
          : '<span></span>');

    var html = '';
    for (var c = 1; c <= 9; c++) html += '<button class="kl-tl" data-kl="' + c + '">' + c + '</button>';
    html += vlevo;
    html += '<button class="kl-tl" data-kl="0">0</button>';
    html += '<button class="kl-tl kl-vedlejsi" data-kl="zpet" aria-label="Smazat">' +
      ik.svg('ui-backspace') + '</button>';
    $('klavesnice').innerHTML = html;
  }

  function chyba(text) {
    var el = $('zamek-chyba');
    el.textContent = text || ' ';
    if (text) {
      var vnitrek = $('zamek-vnitrek');
      vnitrek.classList.remove('trese');
      void vnitrek.offsetWidth;
      vnitrek.classList.add('trese');
    }
  }

  function stiskni(kl) {
    if (Date.now() < blokovanoDo) {
      chyba('Počkejte ' + Math.ceil((blokovanoDo - Date.now()) / 1000) + ' s.');
      return;
    }
    if (kl === 'zpet') { zadano = zadano.slice(0, -1); chyba(''); vykresliZamek(); return; }
    if (kl === 'bio') { zkusBiometriku(); return; }
    if (kl === 'ok') { potvrdZadani(); return; }

    if (zadano.length >= DELKA_MAX) return;
    zadano += kl;
    chyba('');
    vykresliZamek();

    if (rezim === 'odemknout') {
      var ocekavana = obalka.delka || DELKA_MAX;
      if (zadano.length >= ocekavana) setTimeout(potvrdZadani, 80);
    } else if (zadano.length === DELKA_MAX) {
      setTimeout(potvrdZadani, 80);
    }
  }

  function potvrdZadani() {
    var pin = zadano;
    if (rezim === 'nastavit') {
      if (pin.length < DELKA_MIN) { chyba('Aspoň ' + DELKA_MIN + ' číslice.'); return; }
      prvniPin = pin;
      zadano = '';
      rezim = 'potvrdit';
      vykresliZamek();
      return;
    }
    if (rezim === 'potvrdit') {
      if (pin !== prvniPin) {
        zadano = ''; prvniPin = ''; rezim = 'nastavit';
        chyba('PIN se neshoduje, zkuste to znovu.');
        vykresliZamek();
        return;
      }
      $('zamek-popis').textContent = 'Zamykám data…';
      zalozTrezor(pin).then(function () {
        schovejAPust();
      }).catch(function () {
        rezim = 'nastavit'; zadano = ''; prvniPin = '';
        chyba('Nepovedlo se zapnout zámek.');
        vykresliZamek();
      });
      return;
    }
    // odemykání
    $('zamek-popis').textContent = 'Odemykám…';
    odemkniPinem(pin).then(function () {
      schovejAPust();
    }).catch(function () {
      chybnych++;
      zadano = '';
      if (chybnych >= 5) {
        blokovanoDo = Date.now() + Math.min(300, Math.pow(2, chybnych - 4) * 15) * 1000;
        chyba('Moc pokusů. Zkuste to za chvíli.');
      } else {
        chyba('Špatný PIN.');
      }
      $('zamek-popis').textContent = 'Zadejte PIN';
      vykresliZamek();
    });
  }

  function zkusBiometriku() {
    if (!maBiometriku()) return;
    $('zamek-popis').textContent = 'Čekám na otisk…';
    odemkniBiometrikou().then(function () {
      schovejAPust();
    }).catch(function () {
      $('zamek-popis').textContent = 'Zadejte PIN';
      chyba('');
    });
  }

  function schovejAPust() {
    $('zamek').hidden = true;
    document.body.classList.remove('zamceno');
    zadano = ''; prvniPin = '';
    if (poSpusteni) { var f = poSpusteni; poSpusteni = null; f(); }
    else if (global.F && global.F.poOdemceni) global.F.poOdemceni();
  }

  /* ---------- start ---------- */

  function start(spust) {
    poSpusteni = spust;
    hlidejPozadi();

    $('klavesnice').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kl]');
      if (b && !b.disabled) stiskni(b.getAttribute('data-kl'));
    });

    obalka = nactiObalku();

    if (obalka) {
      zamceno = true;
      rezim = 'odemknout';
      document.body.classList.add('zamceno');
      vykresliZamek();
      $('zamek').hidden = false;
      if (maBiometriku()) setTimeout(zkusBiometriku, 400);
      return;
    }

    // trezor zatím není – načteme nešifrovaná data
    D.nacti();

    // Zámek je dobrovolný – první spuštění jde rovnou do appky
    // (PIN při každém otevření odrazoval od rychlého zápisu).
    // Zapnout se dá ve Víc → Zabezpečení.
    zamceno = false;
    schovejAPust();
  }

  /** Zapnutí zámku dodatečně (z Nastavení, když byl vypnutý). */
  function zapniZamek() {
    if (!podporovano()) return false;
    rezim = 'nastavit';
    zadano = ''; prvniPin = '';
    poSpusteni = null;
    document.body.classList.add('zamceno');
    vykresliZamek();
    $('zamek').hidden = false;
    return true;
  }

  global.FZamek = {
    start: start,
    zamkni: zamkni,
    jeZamceno: jeZamceno,
    jeZapnut: function () { return !!obalka; },
    podporovano: podporovano,
    biometrikaMozna: biometrikaMozna,
    maBiometriku: maBiometriku,
    zapniBiometriku: zapniBiometriku,
    vypniBiometriku: vypniBiometriku,
    zmenPin: zmenPin,
    vypniZamek: vypniZamek,
    zapniZamek: zapniZamek,
    DELKA_MIN: DELKA_MIN,
    DELKA_MAX: DELKA_MAX
  };

})(window);
