# -*- coding: utf-8 -*-
"""
Proklik načtení výpisu z banky (Playwright, rozlišení telefonu).

Spuštění:  python test-import.py
Vzory výpisů jsou v ukazky-vypisu/ (vyrob.py je vyrobí znovu).
Na konci vypíše POTIZE: 0, když je všechno v pořádku.
"""
import sys, io, os, http.server, socketserver, threading, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
VZORY = os.path.join(ROOT, 'ukazky-vypisu')
PORT = 8778

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


class Obsluha(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


srv = Server(("127.0.0.1", PORT), functools.partial(Obsluha, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

chyby, potiz = [], []


def kontrola(popis, podminka, detail=""):
    if not podminka:
        potiz.append(popis + " " + str(detail))
    print("%s %s %s" % ("OK " if podminka else "CHYBA", popis, detail if not podminka else ""))


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True,
                        is_mobile=True, device_scale_factor=2, locale="cs-CZ")
    page = ctx.new_page()
    page.on("console", lambda m: chyby.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: chyby.append("pageerror: " + str(e)))

    def txt(sel):
        return page.inner_text(sel).replace(" ", " ").replace(" ", " ")

    def radky():
        return page.query_selector_all("#import-telo .imp-radek")

    def radek_s(text):
        for r in radky():
            if text.lower() in r.inner_text().lower():
                return r
        return None

    def kat_radku(text):
        r = radek_s(text)
        return r.query_selector(".imp-kat").inner_text().strip() if r else None

    def nacti(soubor, ucet="u-karta", zdroj=None):
        page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(250)
        page.click("#pohled-ucty [data-akce='import']"); page.wait_for_timeout(300)
        page.click("[data-impucet='%s']" % ucet); page.wait_for_timeout(100)
        page.set_input_files("#pole-vypis", zdroj or os.path.join(VZORY, soubor))
        page.wait_for_timeout(700)

    def zustatek(ucet):
        return page.evaluate("id => FData.zustatekUctu(id)", ucet)

    page.goto("http://127.0.0.1:%d/index.html" % PORT)
    page.wait_for_timeout(800)
    kontrola("start nabizi vypis", page.is_visible("#karta-start [data-akce='import']"))

    # ručně zapsaný oběd, který je ve výpisu taky (Wolt 189 Kč, o den dřív)
    page.evaluate("""FData.pridejTransakci({datum:'2026-09-11', castka:189, typ:'vydaj',
        kat:'k-restaurace', ucet:'u-karta', ucetDo:null, pozn:'wolt obed'})""")

    # ---------- Fio: úvod s údaji o účtu, obchodník ve zprávě ----------
    nacti("fio.csv")
    kontrola("fio: 8 pohybu", len(radky()) == 8, len(radky()))
    kontrola("fio: Lidl -> Potraviny", kat_radku("LIDL") == "Potraviny", kat_radku("LIDL"))
    kontrola("fio: Shell -> Auto", kat_radku("SHELL") == "Auto", kat_radku("SHELL"))
    kontrola("fio: Kavarna -> Jidlo venku", kat_radku("KAVARNA") == "Jídlo venku", kat_radku("KAVARNA"))
    kontrola("fio: bankomat = prevod do hotovosti", "Hotovost" in (kat_radku("bankomatu") or ""),
             kat_radku("bankomatu"))
    kontrola("fio: mzda -> Vyplata", kat_radku("Mzda") == "Výplata", kat_radku("Mzda"))
    kontrola("fio: neznamy obchod ceka na pomoc",
             "nevím, kam patří (1)" in txt("#import-telo").lower(), txt("#import-telo")[:300])
    wolt = radek_s("WOLT")
    kontrola("fio: rucne zapsany Wolt je vypnuty", wolt and "vypnuto" in (wolt.get_attribute("class") or ""))
    kontrola("fio: Wolt pod 'Mozna uz zapsane'", "možná už zapsané ručně (1)" in txt("#import-telo").lower())
    kontrola("fio: tlacitko pocita 7", "Zapsat 7" in txt("#import-zapsat"), txt("#import-zapsat"))

    # oprava kategorie jedním klepnutím
    radek_s("PAPIRNICTVI").query_selector(".imp-kat").click(); page.wait_for_timeout(300)
    kontrola("vyber kategorie radku", page.is_visible("#prekryv-dialog"))
    page.click("#dialog-telo [data-impvyber='k-vzdelani']"); page.wait_for_timeout(300)
    kontrola("oprava se projevila", kat_radku("PAPIRNICTVI") == "Vzdělání", kat_radku("PAPIRNICTVI"))

    page.click("#import-zapsat"); page.wait_for_timeout(500)
    kontrola("po zapsani dotaz na zustatek", page.is_visible("#d-zustatek"))
    page.fill("#d-zustatek", "9954,60")
    page.click("#dialog-ano"); page.wait_for_timeout(400)
    kontrola("zustatek srovnan s bankou", abs(zustatek("u-karta") - 9954.6) < 0.01, zustatek("u-karta"))
    kontrola("vyber z bankomatu dorazil do hotovosti", abs(zustatek("u-hotovost") - 2000) < 0.01,
             zustatek("u-hotovost"))
    st = page.evaluate("""(() => { const s = FData.stav();
        return {pocet: s.transakce.length, prav: s.pravidla,
                imp: s.transakce.filter(t => t.imp).length}; })()""")
    kontrola("zapsano 7 z vypisu", st["imp"] == 7, st)
    kontrola("appka se naucila papirnictvi", st["prav"].get("papirnictvi pepa") == "k-vzdelani", st["prav"])
    kontrola("prehled ukazuje vypis", "Potraviny" in txt("#graf-kategorie"))

    # ---------- stejný výpis podruhé: nic nového ----------
    nacti("fio.csv")
    kontrola("podruhe: 7 uz v appce", "7 pohybů už v appce je" in txt("#import-telo"), txt("#import-telo")[:200])
    kontrola("podruhe: zustal jen rucne zapsany Wolt", len(radky()) == 1 and radek_s("WOLT") is not None)
    kontrola("podruhe: neni co zapsat", page.is_disabled("#import-zapsat"))
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- naučené pravidlo platí v dalším výpisu ----------
    novy = ('"ID operace";"Datum";"Objem";"Měna";"Název protiúčtu";"Zpráva pro příjemce";"Typ"\r\n'
            '"1";"21.09.2026";"-120,00";"CZK";"";"Nákup: PAPIRNICTVI PEPA, Brno";"Platba kartou"\r\n')
    nacti(None, zdroj={"name": "fio-dalsi.csv", "mimeType": "text/csv", "buffer": novy.encode("utf-8")})
    kontrola("naucene pravidlo pouzito", kat_radku("PAPIRNICTVI") == "Vzdělání", kat_radku("PAPIRNICTVI"))
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- George (Česká spořitelna): čárky, windows-1250 ----------
    nacti("george.csv")
    kontrola("george: 3 pohyby", len(radky()) == 3, len(radky()))
    kontrola("george: Kaufland -> Potraviny", kat_radku("KAUFLAND") == "Potraviny", kat_radku("KAUFLAND"))
    kontrola("george: DM -> Domacnost", kat_radku("DROGERIE") == "Domácnost", kat_radku("DROGERIE"))
    kontrola("george: CEZ -> Energie", kat_radku("CEZ") == "Energie", kat_radku("CEZ"))
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- Revolut: desetinná tečka, vrácená platba se nebere ----------
    nacti("revolut.csv", ucet="u-sporici")
    kontrola("revolut: 3 pohyby (vracena Zara vynechana)", len(radky()) == 3 and radek_s("Zara") is None,
             len(radky()))
    kontrola("revolut: Netflix -> Zabava", kat_radku("Netflix") == "Zábava", kat_radku("Netflix"))
    kontrola("revolut: castka s teckou", "312,4" in radek_s("Bolt").inner_text(), radek_s("Bolt").inner_text())
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- Air Bank ----------
    nacti("airbank.csv")
    kontrola("airbank: 4 pohyby", len(radky()) == 4, len(radky()))
    kontrola("airbank: Albert -> Potraviny", kat_radku("ALBERT") == "Potraviny", kat_radku("ALBERT"))
    kontrola("airbank: vratka", kat_radku("listky") == "Vratka", kat_radku("listky"))
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- GPC (ABO) ----------
    nacti("vypis.gpc", ucet="u-sporici")
    kontrola("gpc: 3 pohyby", len(radky()) == 3, len(radky()))
    lidl = radek_s("LIDL")
    kontrola("gpc: castka z haleru", lidl and "349,5" in lidl.inner_text(), lidl and lidl.inner_text())
    kontrola("gpc: prijem ma plus", "+32 000" in txt("#import-telo").replace(" ", " "))
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- nesmysl ----------
    nacti(None, zdroj={"name": "nesmysl.csv", "mimeType": "text/csv", "buffer": b"ahoj;svete\nnic;tu\n"})
    kontrola("nesmysl: srozumitelna chyba", "nenašel" in txt("#import-telo"), txt("#import-telo")[:120])
    page.click("#import-zavrit"); page.wait_for_timeout(300)

    # ---------- připomínka po týdnu ----------
    page.evaluate("FData.stav().nastaveni.posledniImport = '2026-09-01'")
    page.click(".nav-tl[data-jdi='historie']"); page.wait_for_timeout(200)
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)
    kontrola("pripominka noveho vypisu", page.is_visible("#karta-import"), txt("#import-pripominka"))

    # ---------- záloha nese naučená pravidla ----------
    kontrola("zaloha nese pravidla", '"papirnictvi pepa"' in page.evaluate("FData.doJson()"))

    b.close()

srv.shutdown()
print("\n--- konzole ---")
for c in chyby:
    print(c)
print("\n--- vysledek ---")
print("POTIZE: %d" % len(potiz))
for t in potiz:
    print(" ! " + t)
sys.exit(1 if potiz or chyby else 0)
