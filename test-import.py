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

    # ---------- další banky (2.1) ----------
    DALSI = [
        ("kb.csv", 3, [("BILLA", "Potraviny"), ("PLYNARENSKA", "Energie"), ("TESCO", "Potraviny")]),
        ("csob.csv", 3, [("PENNY", "Potraviny"), ("SPOTIFY", "Zábava"), ("MZDA", "Výplata")]),
        ("raiffeisen.csv", 3, [("GLOBUS", "Potraviny"), ("SVJ", "Bydlení"), ("CINEMA", "Zábava")]),
        ("mbank.csv", 3, [("ROSSMANN", "Domácnost"), ("vratka", "Vratka"), ("MCDONALDS", "Jídlo venku")]),
        ("moneta.csv", 3, [("NETFLIX", "Zábava"), ("BENZINA", "Auto")]),
        ("unicredit.csv", 2, [("DR.MAX", "Zdraví")]),
        ("partners.csv", 3, [("KAUFLAND", "Potraviny"), ("Babička", "Dar"), ("O2", "Telefon a net")]),
        ("n26.csv", 3, [("SPAR", "Potraviny"), ("Ryanair", "Cestování")]),
        ("wise.csv", 2, [("Starbucks", "Jídlo venku")]),
        ("george.xlsx", 3, [("ALBERT", "Potraviny"), ("Zubní", "Zdraví"), ("ZAMESTNAVATEL", "Výplata")]),
    ]
    for soubor, pocet, kategorie in DALSI:
        nacti(soubor)
        kontrola(soubor + ": %d pohyby" % pocet, len(radky()) == pocet, len(radky()))
        for text, kat in kategorie:
            kontrola("%s: %s -> %s" % (soubor, text, kat), kat_radku(text) == kat, kat_radku(text))
        if soubor == "raiffeisen.csv":
            kontrola("raiffeisen: vlastni nazev uctu neni obchodnik", "Můj běžný účet" not in txt("#import-telo"))
        if soubor == "unicredit.csv":
            kontrola("unicredit: protistrana z Nazvu uctu", radek_s("Uniqa") is not None)
        if soubor == "partners.csv":
            kontrola("partners: vydaj ze sloupce Vydaj je zaporny", "−812,4" in radek_s("KAUFLAND").inner_text(),
                     radek_s("KAUFLAND").inner_text())
        if soubor == "george.xlsx":
            kontrola("excel: datum z bunky s formatem data", "5. září" in radek_s("ALBERT").inner_text(),
                     radek_s("ALBERT").inner_text())
            kontrola("excel: format v souhrnu", "george.xlsx" in txt("#import-telo"))
        page.click("#import-zavrit"); page.wait_for_timeout(250)

    # starý .xls se odmítne srozumitelně
    nacti(None, zdroj={"name": "stary.xls", "mimeType": "application/vnd.ms-excel",
                       "buffer": bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) + b"\0" * 600})
    kontrola("stary xls: rada ulozit jako CSV", "starý formát Excelu" in txt("#import-telo"), txt("#import-telo")[:150])
    page.click("#import-zavrit"); page.wait_for_timeout(250)

    # výběr banky ukáže radu, kde export je
    page.click(".nav-tl[data-jdi='ucty']"); page.wait_for_timeout(250)
    page.click("#pohled-ucty [data-akce='import']"); page.wait_for_timeout(300)
    page.click("[data-impbanka='kb']"); page.wait_for_timeout(200)
    kontrola("rada pro banku", "Historie transakcí" in txt("#import-telo"))
    page.click("#import-zavrit"); page.wait_for_timeout(250)

    # ---------- přehled: obchody, pravidelné platby, srovnání ----------
    page.evaluate("""(() => {
        const d = new Date(), iso = x => x.toISOString().slice(0, 10);
        const m1 = new Date(d.getFullYear(), d.getMonth() - 1, 6, 12);
        const m2 = new Date(d.getFullYear(), d.getMonth() - 2, 6, 12);
        const m0 = new Date(d.getFullYear(), d.getMonth(), Math.min(6, d.getDate()), 12);
        [m2, m1, m0].forEach(x => FData.pridejTransakci({datum: iso(x), castka: 299, typ: 'vydaj',
            kat: 'k-zabava', ucet: 'u-karta', ucetDo: null, pozn: 'HBO MAX', klic: 'hbo max'}));
        for (let i = 0; i < 4; i++) FData.pridejTransakci({datum: iso(m1), castka: 200 + i * 37, typ: 'vydaj',
            kat: 'k-potraviny', ucet: 'u-karta', ucetDo: null, pozn: 'LIDL', klic: 'lidl'});
    })()""")
    page.click(".nav-tl[data-jdi='historie']"); page.wait_for_timeout(200)
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(400)
    kontrola("pravidelne platby poznany", page.is_visible("#karta-predplatne") and
             "Hbo Max" in txt("#seznam-predplatneho"), txt("#seznam-predplatneho")[:120] if page.is_visible("#karta-predplatne") else "skryto")
    kontrola("lidl neni predplatne (vic nakupu mesicne)", "Lidl" not in txt("#seznam-predplatneho"))
    kontrola("kde nejvic utracite", page.is_visible("#karta-obchody"), "skryto")
    kontrola("srovnani s minulym mesicem", page.is_visible("#hero-srovnani") and
             " než " in txt("#hero-srovnani"), txt("#hero-srovnani") if page.is_visible("#hero-srovnani") else "skryto")
    page.click("#seznam-obchodu .obchod-radek"); page.wait_for_timeout(350)
    kontrola("proklik z obchodu do historie", page.is_visible("#pohled-historie") and
             page.input_value("#hledani") != "", page.input_value("#hledani"))
    page.click(".nav-tl[data-jdi='prehled']"); page.wait_for_timeout(300)

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
