# -*- coding: utf-8 -*-
"""
Proklikani aplikace Moje finance v prohlizeci (Playwright, rozliseni telefonu).

Spusteni:  python test-proklikani.py
Potrebuje: pip install playwright  +  playwright install chromium
Na konci vypise POTIZE: 0, kdyz je vsechno v poradku.
"""
import sys, io, os, http.server, socketserver, threading, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8777
PIN = "1234"

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

class Obsluha(http.server.SimpleHTTPRequestHandler):
    """HTTP/1.1 s keep-alive a bez logu.

    Servisni vrstva si pri instalaci sahne naraz pro vsechny soubory;
    vychozi SimpleHTTPRequestHandler na HTTP/1.0 pri tom obcas spojeni
    resetne a stranka pak nabehne bez app.js.
    """
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


handler = functools.partial(Obsluha, directory=ROOT)
srv = Server(("127.0.0.1", PORT), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

chyby, potiz = [], []

# maly PNG na zkousku uctenky (bez knihoven)
import zlib, struct
def _png(cesta, w=60, h=90):
    radky = bytearray()
    for y in range(h):
        radky.append(0)
        for x in range(w):
            radky += bytes([(x * 4) % 256, (y * 3) % 256, 200])
    radky = bytes(radky)
    def kus(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))
    with open(cesta, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(kus(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)))
        f.write(kus(b"IDAT", zlib.compress(radky, 9)))
        f.write(kus(b"IEND", b""))
    return cesta

OBRAZEK = _png(os.path.join(ROOT, "zkouska-uctenka.png"))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True,
                        is_mobile=True, device_scale_factor=2, locale="cs-CZ")
    page = ctx.new_page()
    page.on("console", lambda m: chyby.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: chyby.append("pageerror: " + str(e)))

    def txt(sel):
        return page.inner_text(sel).replace(" ", " ").replace(" ", " ")

    def kontrola(popis, podminka, detail=""):
        if not podminka:
            potiz.append(popis + " " + detail)
        print("%s %s %s" % ("OK " if podminka else "CHYBA", popis, detail if not podminka else ""))

    def zadej_pin(pin, potvrdit=False):
        for c in pin:
            page.click("[data-kl='%s']" % c)
        if potvrdit:
            page.click("[data-kl='ok']")

    def pridej(datum, castka, kat, ucet="u-karta", typ="vydaj", pozn=""):
        """Zapise zaznam primo pres rozhrani dat (kvuli historickym datum)."""
        page.evaluate("""a => FData.pridejTransakci({datum:a.datum, castka:a.castka, typ:a.typ,
            kat:a.kat, ucet:a.ucet, ucetDo:null, pozn:a.pozn})""",
            {"datum": datum, "castka": castka, "typ": typ, "kat": kat, "ucet": ucet, "pozn": pozn})

    def prekresli():
        page.click(".nav-tl[data-jdi='historie']"); page.wait_for_timeout(200)
        page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)

    page.goto("http://127.0.0.1:%d/index.html" % PORT)
    page.wait_for_timeout(700)

    # ---------- zamek: prvni spusteni ----------
    kontrola("zamek se pta na novy PIN", page.is_visible("#zamek") and
             "Zvolte PIN" in txt("#zamek-popis"), txt("#zamek-popis"))
    kontrola("appka je schovana", not page.is_visible("#obsah"))
    zadej_pin(PIN, potvrdit=True)
    page.wait_for_timeout(300)
    kontrola("zada zopakovat PIN", "Zopakujte" in txt("#zamek-popis"), txt("#zamek-popis"))
    zadej_pin("9999", potvrdit=True)
    page.wait_for_timeout(400)
    kontrola("neshodny PIN odmitnut", "neshoduje" in txt("#zamek-chyba"), txt("#zamek-chyba"))
    zadej_pin(PIN, potvrdit=True); page.wait_for_timeout(250)
    zadej_pin(PIN, potvrdit=True)
    page.wait_for_selector("#zamek", state="hidden", timeout=25000)
    page.wait_for_timeout(400)
    kontrola("po nastaveni PINu appka nabehla", page.is_visible("#pohled-prehled"))

    ulozene = page.evaluate("Object.keys(localStorage)")
    kontrola("data jsou v trezoru", "moje-finance-trezor-v1" in ulozene, str(ulozene))
    kontrola("nesifrovana kopie smazana", "moje-finance-v1" not in ulozene, str(ulozene))

    # ---------- zapis vydaje ----------
    page.click("#tl-pridat"); page.wait_for_timeout(300)
    page.fill("#pole-castka", "349,50")
    page.click("[data-vyberkat='k-potraviny']")
    page.click("[data-vyberucet='u-karta']")
    page.fill("#pole-pozn", "Lidl velky nakup")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(500)
    kontrola("zustatek po vydaji", "349,5" in txt("#hero-zustatek"), txt("#hero-zustatek"))
    kontrola("kategorie v grafu", "Potraviny" in txt("#graf-kategorie"))
    kontrola("podilovy pruh", page.query_selector(".podil-dil") is not None)

    trezor = page.evaluate("localStorage.getItem('moje-finance-trezor-v1')")
    kontrola("trezor neprozrazuje obsah",
             "Potraviny" not in trezor and "Lidl" not in trezor, trezor[:80])

    # ---------- rychle castky a vyraz ----------
    page.click("#tl-pridat"); page.wait_for_timeout(250)
    page.click("[data-rychla='500']"); page.click("[data-rychla='100']")
    kontrola("rychle castky scitaji", page.input_value("#pole-castka") == "600",
             page.input_value("#pole-castka"))
    page.click("[data-vyberkat='k-doprava']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(400)

    page.click("#tl-pridat"); page.wait_for_timeout(250)
    page.fill("#pole-castka", "120+35")
    page.click("[data-vyberkat='k-restaurace']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(400)
    kontrola("vyraz 120+35", "155" in txt("#graf-kategorie"))

    # ---------- prijem ----------
    page.click("#tl-pridat"); page.wait_for_timeout(250)
    page.click("#prepinac-typ [data-typ='prijem']"); page.wait_for_timeout(150)
    page.fill("#pole-castka", "42000")
    page.click("[data-vyberkat='p-vyplata']")
    page.click("[data-vyberucet='u-karta']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(450)
    kontrola("prijem zapsan", "42 000" in txt("#souhrn-prijmy"), txt("#souhrn-prijmy"))

    # ---------- V2: prstenec ----------
    kontrola("prstenec vykreslen", page.query_selector("#prstenec .prstenec-cara") is not None)
    kontrola("prstenec ukazuje procenta", "%" in txt(".prstenec-stred"), txt(".prstenec-stred"))

    # ---------- V1: dnes a tento tyden ----------
    kontrola("dnes ma castku", "1 104,5" in txt("#hero-dnes"), txt("#hero-dnes"))
    kontrola("tyden ma castku", "1 104,5" in txt("#hero-tyden"), txt("#hero-tyden"))
    page.click("#hero-dnes"); page.wait_for_timeout(400)
    kontrola("proklik na dnesek", page.is_visible("#pohled-historie") and
             "Jen dnešek" in txt("#filtr-aktivni"), txt("#filtr-aktivni"))
    kontrola("dnesek ma 4 zaznamy",
             len(page.query_selector_all("#seznam-transakci .polozka")) == 4,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))
    page.click("[data-zrus='rozsah']"); page.wait_for_timeout(300)

    # ---------- V3: barevne ikony ----------
    pozadi = page.eval_on_selector_all("#seznam-transakci .polozka-ikona",
                                       "els => els.map(e => getComputedStyle(e).backgroundColor)")
    kontrola("ikony maji ruzne barvy", len(set(pozadi)) >= 3, str(set(pozadi)))

    # ---------- prevod ----------
    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(350)
    page.click("#tl-prevod"); page.wait_for_timeout(350)
    page.fill("#pole-castka", "5000")
    page.click("[data-vyberucet='u-karta']")
    page.click("[data-vyberucetdo='u-sporici']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(500)
    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(350)
    kontrola("prevod na sporici", "5 000" in txt("#seznam-uctu"))
    kontrola("prevod nemeni celek", "40 895,5" in txt("#ucty-celkem"), txt("#ucty-celkem"))

    # ---------- filtry a hledani ----------
    page.click(".nav-tl[data-jdi='historie']"); page.wait_for_timeout(350)
    kontrola("historie ma 5 zaznamu",
             len(page.query_selector_all("#seznam-transakci .polozka")) == 5,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))
    page.click("#chipy-typ [data-typ='vydaj']"); page.wait_for_timeout(250)
    kontrola("filtr vydaje", len(page.query_selector_all("#seznam-transakci .polozka")) == 3)
    page.fill("#hledani", "lidl"); page.wait_for_timeout(300)
    kontrola("hledani", len(page.query_selector_all("#seznam-transakci .polozka")) == 1)
    page.fill("#hledani", ""); page.click("#chipy-typ [data-typ='vse']"); page.wait_for_timeout(250)

    # ---------- uprava a mazani ----------
    page.click("#seznam-transakci .polozka"); page.wait_for_timeout(400)
    kontrola("editace otevrena", page.is_visible("#zaznam-smazat"))
    page.click("#zaznam-smazat"); page.wait_for_timeout(300)
    page.click("#dialog-ano"); page.wait_for_timeout(450)
    kontrola("zaznam smazan", len(page.query_selector_all("#seznam-transakci .polozka")) == 4)

    # ---------- F3: trend kategorie ----------
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)
    dnes = page.evaluate("FData.dnesISO()")
    rok, mes, den = int(dnes[:4]), int(dnes[5:7]), int(dnes[8:10])
    for zpet in (1, 2, 3):
        m, r = mes - zpet, rok
        while m < 1:
            m += 12
            r -= 1
        pridej("%04d-%02d-%02d" % (r, m, min(den, 28)), 100, "k-doprava")
    prekresli()
    trend = page.query_selector("#graf-kategorie .kat-trend")
    kontrola("trend kategorie se ukazal", trend is not None)
    if trend:
        kontrola("trend hlasi narust", "↑" in trend.inner_text(), trend.inner_text())

    # ---------- F1: sablony pres dlouhy stisk ----------
    pridej(dnes, 349.5, "k-potraviny", pozn="Lidl")
    pridej(dnes, 349.5, "k-potraviny", pozn="Lidl")
    prekresli()
    page.dispatch_event("#tl-pridat", "mousedown")
    page.wait_for_timeout(750)
    page.dispatch_event("#tl-pridat", "mouseup")
    page.wait_for_timeout(250)
    kontrola("sablony se otevrely", page.is_visible("#prekryv-sablony"))
    kontrola("sablona nabizi Potraviny", "Potraviny" in txt("#seznam-sablon"),
             txt("#seznam-sablon").replace("\n", " | "))
    pred = page.evaluate("FData.stav().transakce.length")
    page.click(".sablona"); page.wait_for_timeout(550)
    po = page.evaluate("FData.stav().transakce.length")
    kontrola("sablona zapsala jednim klepnutim", po == pred + 1, "%d -> %d" % (pred, po))
    kontrola("hlaska nabizi vraceni", page.is_visible(".hlaska-zpet"))
    page.click(".hlaska-zpet"); page.wait_for_timeout(450)
    kontrola("vraceni zpet funguje",
             page.evaluate("FData.stav().transakce.length") == pred,
             str(page.evaluate("FData.stav().transakce.length")))


    # ---------- ikony: vektorove a vycentrovane ----------
    pocet_svg = page.evaluate("document.querySelectorAll('svg.ik').length")
    kontrola("ikony jsou vektorove", pocet_svg > 20, str(pocet_svg))
    zbyle_emoji = page.evaluate("""
        Array.from(document.querySelectorAll('.polozka-ikona, .kat-ikona, .ucet-ikona'))
             .map(e => e.textContent.trim()).filter(t => t.length).length""")
    kontrola("nikde nezustal smajlik", zbyle_emoji == 0, str(zbyle_emoji))
    odchylka = page.evaluate("""
        Array.from(document.querySelectorAll('.polozka-ikona')).map(e => {
            const s = e.getBoundingClientRect(), i = e.querySelector('svg').getBoundingClientRect();
            return Math.max(Math.abs((s.left+s.right)/2 - (i.left+i.right)/2),
                            Math.abs((s.top+s.bottom)/2 - (i.top+i.bottom)/2));
        }).reduce((a, b) => Math.max(a, b), 0)""")
    kontrola("ikony jsou vycentrovane", odchylka < 1.0, "odchylka %.2f px" % odchylka)

    # ---------- vice grafu ----------
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)
    page.click("[data-jdi='grafy']"); page.wait_for_timeout(500)
    kontrola("obrazovka grafu", page.is_visible("#pohled-grafy"))
    for cast, popis in (("#graf-dny .den-bar", "utrata den po dni"),
                        ("#graf-kumulativne .cara-ted", "narustajici utrata"),
                        ("#graf-tyden .tyden-bar", "dny v tydnu"),
                        ("#graf-zustatek .cara-plocha", "vyvoj zustatku"),
                        ("#graf-ucty .kat-radek", "podle uctu")):
        kontrola("graf: " + popis, page.query_selector(cast) is not None)
    kontrola("graf prijmu", "Výplata" in txt("#graf-prijmy"), txt("#graf-prijmy")[:60])
    page.click("#graf-ucty .kat-radek"); page.wait_for_timeout(400)
    kontrola("proklik z grafu uctu", page.is_visible("#pohled-historie") and
             page.is_visible("#filtr-aktivni"))
    page.click("[data-zrus='ucet']"); page.wait_for_timeout(250)

    # ---------- nakup vice veci najednou ----------
    page.click("#tl-pridat"); page.wait_for_timeout(350)
    page.click("#tl-polozky"); page.wait_for_timeout(300)
    kontrola("rezim polozek", page.is_visible("#polozky-blok"))
    page.fill("[data-polozka-nazev='0']", "rohliky")
    page.fill("[data-polozka-castka='0']", "120")
    page.fill("[data-polozka-nazev='1']", "prasek na prani")
    page.fill("[data-polozka-castka='1']", "80")
    page.dispatch_event("[data-polozka-castka='1']", "input")
    page.wait_for_timeout(250)
    kontrola("soucet polozek", "200" in txt("#polozky-soucet"), txt("#polozky-soucet"))
    kontrola("castka se dopocitala", page.input_value("#pole-castka") == "200",
             page.input_value("#pole-castka"))
    # kazde polozce dame vlastni kategorii
    page.click("[data-polozka-kat='0']"); page.wait_for_timeout(300)
    page.click("[data-vyberkat='k-potraviny']"); page.wait_for_timeout(300)
    page.click("[data-polozka-kat='1']"); page.wait_for_timeout(300)
    kontrola("vyber kategorie polozky", "POLOŽKY" in txt("#popis-kategorie").upper(),
             txt("#popis-kategorie"))
    page.click("[data-vyberkat='k-domacnost']"); page.wait_for_timeout(300)
    page.fill("#pole-pozn", "vecerni nakup")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(600)
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(400)
    kontrola("nakup zapsan", "Domácnost" in txt("#graf-kategorie"), txt("#graf-kategorie")[:80])
    rozpad = page.evaluate("""(() => {
        const t = FData.stav().transakce.find(t => t.pozn === 'vecerni nakup');
        return t ? {pocet: t.polozky.length, castka: t.castka,
                    kat: t.polozky.map(p => p.kat).join(',')} : null;})()""")
    kontrola("nakup ma dve polozky", rozpad and rozpad["pocet"] == 2, str(rozpad))
    kontrola("nakup ma soucet 200", rozpad and rozpad["castka"] == 200, str(rozpad))
    kontrola("polozky maji ruzne kategorie",
             rozpad and rozpad["kat"] == "k-potraviny,k-domacnost", str(rozpad))
    kontrola("znacka poctu polozek v seznamu",
             page.query_selector("#posledni-pohyby .polozky-znacka") is not None)

    # ---------- fotka uctenky ----------
    page.click("#posledni-pohyby .polozka"); page.wait_for_timeout(400)
    page.set_input_files("#pole-fotka", OBRAZEK)
    page.wait_for_selector(".uctenka-nahled img", timeout=15000)
    kontrola("nahled uctenky", page.query_selector(".uctenka-nahled img") is not None)
    page.click("#zaznam-ulozit"); page.wait_for_timeout(900)
    idf = page.evaluate("FData.stav().transakce.find(t => t.pozn === 'vecerni nakup').id")
    velikost = page.evaluate("id => FData.nactiFotku(id).then(b => b ? b.byteLength : 0)", idf)
    kontrola("uctenka ulozena", velikost > 500, str(velikost))
    syrova = page.evaluate("""id => new Promise(ok => {
        const z = indexedDB.open('moje-finance-fotky', 1);
        z.onsuccess = () => { const t = z.result.transaction('fotky','readonly');
          const g = t.objectStore('fotky').get(id);
          g.onsuccess = () => ok(g.result ? {sifrovano: g.result.sifrovano,
             prvni: new Uint8Array(g.result.data).slice(0,3).join(',')} : null); };
        z.onerror = () => ok(null); })""", idf)
    kontrola("uctenka je zasifrovana", syrova and syrova["sifrovano"] is True, str(syrova))
    kontrola("v ulozisti neni holy JPEG", syrova and syrova["prvni"] != "255,216,255", str(syrova))
    page.click("#posledni-pohyby .polozka"); page.wait_for_timeout(700)
    kontrola("uctenka se nacte zpet", page.query_selector(".uctenka-nahled img") is not None)
    page.click(".uctenka-nahled img"); page.wait_for_timeout(400)
    kontrola("uctenka jde zvetsit", page.is_visible("#prekryv-fotka"))
    page.click("#fotka-zavrit"); page.wait_for_timeout(250)
    page.click("#zaznam-zrusit"); page.wait_for_timeout(300)

    # ---------- rozpocty, kategorie, ucty ----------
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(400)
    page.fill("[data-rozpocet='k-doprava']", "500")
    page.dispatch_event("[data-rozpocet='k-doprava']", "change"); page.wait_for_timeout(350)
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(400)
    kontrola("rozpocet videt", page.is_visible("#karta-rozpocty"))
    kontrola("rozpocet prekrocen", "překročeno" in txt("#seznam-rozpoctu"))

    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(350)
    page.click("#tl-nova-kategorie"); page.wait_for_timeout(300)
    page.fill("#d-nazev", "Kadernik")
    page.click("#dialog-ano"); page.wait_for_timeout(400)
    kontrola("nova kategorie", "Kadernik" in txt("#editor-kategorii"))

    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(350)
    page.click("#tl-novy-ucet"); page.wait_for_timeout(300)
    page.fill("#d-nazev", "Penezenka"); page.fill("#d-pocatek", "1500")
    page.click("#dialog-ano"); page.wait_for_timeout(400)
    kontrola("novy ucet", "Penezenka" in txt("#seznam-uctu"))

    # ---------- tema a vyber mesice ----------
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(350)
    page.click("[data-tema='dark']"); page.wait_for_timeout(350)
    kontrola("tmave tema", page.get_attribute("html", "data-tema") == "dark")
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)
    for _ in range(2):
        page.click("#mesic-nazev"); page.wait_for_timeout(350)
        page.click("[data-rok='-1']"); page.wait_for_timeout(200)
        page.click("[data-m='0']"); page.wait_for_timeout(400)
    kontrola("vyber mesice", "Leden" in txt("#mesic-nazev"), txt("#mesic-nazev"))

    # ---------- export ----------
    csv_text = page.evaluate("FData.doCsv()")
    kontrola("csv ma radky", csv_text.count("\r\n") >= 4, str(csv_text.count("\r\n")))
    kontrola("csv ma diakritiku", "Výdaj" in csv_text)
    kontrola("json ma transakce", '"transakce"' in page.evaluate("FData.doJson()"))

    # ---------- zamek po restartu ----------
    page.reload(); page.wait_for_timeout(1300)
    kontrola("po restartu zamceno", page.is_visible("#zamek") and
             "Zadejte PIN" in txt("#zamek-popis"), txt("#zamek-popis"))
    zadej_pin("9876")
    page.wait_for_timeout(3000)
    kontrola("spatny PIN odmitnut", page.is_visible("#zamek") and
             "Špatný" in txt("#zamek-chyba"), txt("#zamek-chyba"))
    zadej_pin(PIN)
    page.wait_for_selector("#zamek", state="hidden", timeout=25000)
    page.wait_for_timeout(500)
    kontrola("spravny PIN odemkl", page.is_visible("#pohled-prehled"))
    kontrola("data prezila restart", "41 196,5" in txt("#hero-zustatek"), txt("#hero-zustatek"))
    kontrola("tema prezilo restart", page.get_attribute("html", "data-tema") == "dark")

    # ---------- zamknuti na pozadi ----------
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(400)
    kontrola("nastaveni zamku je videt", "PIN" in txt("#stav-zamku"), txt("#stav-zamku")[:60])
    page.click("[data-zamek='ted']")
    page.wait_for_timeout(700)
    kontrola("zamknout ted funguje", page.is_visible("#zamek"))
    zadej_pin(PIN)
    page.wait_for_selector("#zamek", state="hidden", timeout=25000)
    page.wait_for_timeout(500)

    # ---------- vypnuti zamku ----------
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(400)
    page.click("[data-zamek='vypnout']"); page.wait_for_timeout(350)
    page.click("#dialog-ano"); page.wait_for_timeout(800)
    ulozene = page.evaluate("Object.keys(localStorage)")
    kontrola("po vypnuti zamku je trezor pryc",
             "moje-finance-trezor-v1" not in ulozene, str(ulozene))
    kontrola("data ulozena nacisto", "moje-finance-v1" in ulozene, str(ulozene))
    page.reload(); page.wait_for_timeout(1000)
    kontrola("bez zamku nabehne rovnou",
             page.is_visible("#pohled-prehled") and not page.is_visible("#zamek"))
    kontrola("data zustala", "41 196,5" in txt("#hero-zustatek"), txt("#hero-zustatek"))

    b.close()

srv.shutdown()
try:
    os.remove(OBRAZEK)
except OSError:
    pass

print("\n--- konzole ---")
for c in chyby:
    print(c)
print("\n--- vysledek ---")
print("POTIZE: %d" % len(potiz))
for t in potiz:
    print(" ! " + t)
sys.exit(1 if potiz or chyby else 0)
