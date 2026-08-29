# -*- coding: utf-8 -*-
"""Prokliknuti aplikace v prohlizeci: pridani zaznamu, filtry, ucty, export."""
import sys, io, http.server, socketserver, threading, functools, os
from playwright.sync_api import sync_playwright

ROOT = r"C:\Users\stepa\Desktop\moje-finance"
PORT = 8777

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()

chyby = []
potiz = []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True,
                        is_mobile=True, device_scale_factor=2, locale="cs-CZ")
    page = ctx.new_page()
    page.on("console", lambda m: chyby.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: chyby.append("pageerror: " + str(e)))

    page.goto("http://127.0.0.1:%d/index.html" % PORT)
    page.wait_for_timeout(600)

    def txt(sel):
        return page.inner_text(sel).replace(" ", " ").replace(" ", " ")

    def kontrola(popis, podminka, detail=""):
        znak = "OK " if podminka else "CHYBA"
        if not podminka:
            potiz.append(popis + " " + detail)
        print("%s %s %s" % (znak, popis, detail if not podminka else ""))

    kontrola("uvodni obrazovka", page.is_visible("#pohled-prehled"))
    kontrola("zustatek 0", txt("#hero-zustatek").startswith("0"))

    # --- prvni vydaj ---
    page.click("#tl-pridat")
    page.wait_for_timeout(300)
    kontrola("formular otevren", page.is_visible("#prekryv-zaznam"))
    page.fill("#pole-castka", "349,50")
    page.click("[data-vyberkat='k-potraviny']")
    page.click("[data-vyberucet='u-karta']")
    page.fill("#pole-pozn", "Lidl velky nakup")
    page.click("#zaznam-ulozit")
    page.wait_for_timeout(400)
    kontrola("formular zavren", not page.is_visible("#prekryv-zaznam"))
    kontrola("zustatek po vydaji", "349,5" in txt("#hero-zustatek"),
             txt("#hero-zustatek"))
    kontrola("vydaje mesice", "349,5" in txt("#souhrn-vydaje"),
             txt("#souhrn-vydaje"))
    kontrola("kategorie v grafu", "Potraviny" in txt("#graf-kategorie"))
    kontrola("podilovy pruh", page.query_selector(".podil-dil") is not None)

    # --- rychle castky (scitani) ---
    page.click("#tl-pridat"); page.wait_for_timeout(250)
    page.click("[data-rychla='500']")
    page.click("[data-rychla='100']")
    kontrola("rychle castky scitaji", page.input_value("#pole-castka") == "600",
             page.input_value("#pole-castka"))
    page.click("[data-vyberkat='k-doprava']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(300)

    # --- prijem ---
    page.click("#tl-pridat"); page.wait_for_timeout(250)
    page.click("#prepinac-typ [data-typ='prijem']")
    page.wait_for_timeout(120)
    kontrola("prijmove kategorie", page.query_selector("[data-vyberkat='p-vyplata']") is not None)
    page.fill("#pole-castka", "42000")
    page.click("[data-vyberkat='p-vyplata']")
    page.click("[data-vyberucet='u-karta']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(350)
    kontrola("prijem zapsan", "42 000" in txt("#souhrn-prijmy"),
             txt("#souhrn-prijmy"))
    kontrola("rozdil kladny", txt("#souhrn-rozdil").startswith("+"),
             txt("#souhrn-rozdil"))

    # --- pocetni vyraz v castce ---
    page.click("#tl-pridat"); page.wait_for_timeout(250)
    page.fill("#pole-castka", "120+35")
    page.click("[data-vyberkat='k-restaurace']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(300)
    kontrola("vyraz 120+35", "155" in txt("#graf-kategorie"),
             txt("#graf-kategorie")[:120].replace("\n", " | "))

    # --- prevod mezi ucty ---
    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(300)
    kontrola("obrazovka uctu", page.is_visible("#pohled-ucty"))
    page.click("#tl-prevod"); page.wait_for_timeout(300)
    page.fill("#pole-castka", "5000")
    page.click("[data-vyberucet='u-karta']")
    page.click("[data-vyberucetdo='u-sporici']")
    page.click("#zaznam-ulozit"); page.wait_for_timeout(400)
    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(300)
    text_uctu = txt("#seznam-uctu")
    kontrola("prevod na sporici", "5 000" in text_uctu, text_uctu.replace("\n", " | "))
    celkem_pred = txt("#ucty-celkem")
    kontrola("prevod nemeni celek", "40 895,5" in celkem_pred, celkem_pred)

    # --- historie a filtry ---
    page.click(".nav-tl[data-jdi='historie']"); page.wait_for_timeout(300)
    kontrola("historie ma zaznamy", page.query_selector_all("#seznam-transakci .polozka").__len__() == 5,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))
    page.click("#chipy-typ [data-typ='vydaj']"); page.wait_for_timeout(200)
    kontrola("filtr vydaje", len(page.query_selector_all("#seznam-transakci .polozka")) == 3,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))
    page.fill("#hledani", "lidl"); page.wait_for_timeout(250)
    kontrola("hledani", len(page.query_selector_all("#seznam-transakci .polozka")) == 1,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))
    page.fill("#hledani", ""); page.click("#chipy-typ [data-typ='vse']"); page.wait_for_timeout(200)

    # --- proklik z grafu do historie ---
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)
    page.click(".kat-radek[data-kat='k-potraviny']"); page.wait_for_timeout(350)
    kontrola("proklik grafu filtruje", page.is_visible("#pohled-historie") and
             len(page.query_selector_all("#seznam-transakci .polozka")) == 1,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))
    kontrola("znacka filtru", page.is_visible("#filtr-aktivni"))
    page.click("[data-zrus='kat']"); page.wait_for_timeout(250)
    # proklik z grafu zapnul i filtr "Vydaje", ten po zruseni znacky zustava -> 3 vydaje
    kontrola("zruseni filtru", len(page.query_selector_all("#seznam-transakci .polozka")) == 3,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))

    # --- uprava a smazani zaznamu ---
    page.click("#seznam-transakci .polozka"); page.wait_for_timeout(300)
    kontrola("editace otevrena", page.is_visible("#prekryv-zaznam") and
             page.is_visible("#zaznam-smazat"))
    page.click("#zaznam-smazat"); page.wait_for_timeout(250)
    page.click("#dialog-ano"); page.wait_for_timeout(350)
    kontrola("zaznam smazan", len(page.query_selector_all("#seznam-transakci .polozka")) == 2,
             str(len(page.query_selector_all("#seznam-transakci .polozka"))))

    # --- rozpocty ---
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(300)
    page.fill("[data-rozpocet='k-doprava']", "500")
    page.dispatch_event("[data-rozpocet='k-doprava']", "change")
    page.wait_for_timeout(250)
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(350)
    kontrola("rozpocet videt", page.is_visible("#karta-rozpocty"))
    kontrola("rozpocet prekrocen", "překročeno" in txt("#seznam-rozpoctu"),
             txt("#seznam-rozpoctu").replace("\n", " | "))

    # --- nova kategorie ---
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(300)
    page.click("#tl-nova-kategorie"); page.wait_for_timeout(250)
    page.fill("#d-nazev", "Kadernik")
    page.click("#dialog-ano"); page.wait_for_timeout(300)
    kontrola("nova kategorie", "Kadernik" in txt("#editor-kategorii"))

    # --- novy ucet ---
    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(250)
    page.click("#tl-novy-ucet"); page.wait_for_timeout(250)
    page.fill("#d-nazev", "Penezenka")
    page.fill("#d-pocatek", "1500")
    page.click("#dialog-ano"); page.wait_for_timeout(300)
    kontrola("novy ucet", "Penezenka" in txt("#seznam-uctu"))
    kontrola("pocatecni stav v celku", "42 550,5" in txt("#ucty-celkem"),
             txt("#ucty-celkem"))

    # --- tema ---
    page.click(".nav-tl[data-jdi='nastaveni']"); page.wait_for_timeout(250)
    page.click("[data-tema='light']"); page.wait_for_timeout(250)
    kontrola("svetle tema", page.get_attribute("html", "data-tema") == "light")
    page.click("[data-tema='dark']"); page.wait_for_timeout(250)
    kontrola("tmave tema", page.get_attribute("html", "data-tema") == "dark")

    # --- vyber mesice (dvakrat, kvuli hromadeni posluchacu) ---
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(250)
    for _ in range(2):
        page.click("#mesic-nazev"); page.wait_for_timeout(250)
        page.click("[data-rok='-1']"); page.wait_for_timeout(150)
        page.click("[data-m='0']"); page.wait_for_timeout(300)
    kontrola("vyber mesice", "Leden" in txt("#mesic-nazev"),
             txt("#mesic-nazev"))
    kontrola("prazdny mesic", page.is_visible("#kategorie-prazdno"))

    # --- export a preziti restartu ---
    csv_text = page.evaluate("FData.doCsv()")
    kontrola("csv ma radky", csv_text.count("\r\n") >= 4, str(csv_text.count("\r\n")))
    kontrola("csv ma diakritiku", "Výdaj" in csv_text)
    json_text = page.evaluate("FData.doJson()")
    kontrola("json ma transakce", '"transakce"' in json_text)

    page.reload(); page.wait_for_timeout(700)
    kontrola("data prezila restart", "42 550,5" in txt("#hero-zustatek"),
             txt("#hero-zustatek"))
    kontrola("tema prezilo restart", page.get_attribute("html", "data-tema") == "dark")

    page.screenshot(path=os.path.join(os.path.dirname(__file__), "prehled.png"), full_page=True)
    page.click(".nav-tl[data-jdi='historie']"); page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(os.path.dirname(__file__), "historie.png"), full_page=True)

    b.close()

srv.shutdown()

print("\n--- konzole ---")
for c in chyby:
    print(c)
print("\n--- vysledek ---")
print("POTIZE: %d" % len(potiz))
for t in potiz:
    print(" ! " + t)
