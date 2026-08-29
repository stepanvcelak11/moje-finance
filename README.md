# Moje finance

Mobilní aplikace na hlídání peněz: kolik přišlo, kolik odešlo, **za co** a **z kterého účtu**.
Běží v prohlížeči, jde ji nainstalovat na plochu telefonu jako běžnou appku a funguje i bez signálu.

**Data zůstávají v telefonu.** Žádné přihlašování, žádný server, nic se nikam neposílá.

---

## Co umí

**Přehled (hlavní obrazovka)**
- zůstatek celkem a po jednotlivých účtech
- příjmy a výdaje za vybraný měsíc, kolik zbylo a kolik to je na den do konce měsíce
- „Kam šly peníze" – dělený pruh + žebříček kategorií s částkou i podílem (klepnutím se prokliknete na ty záznamy)
- rozpočty s ukazatelem čerpání
- posledních 6 měsíců vedle sebe (příjmy × výdaje), klepnutím na sloupec se vypíšou čísla
- poslední pohyby

**Zápis**
- výdaj, příjem a **převod mezi účty** (převod nemění celkový majetek, jen ho přesouvá)
- rychlá tlačítka +50 / +100 / +200 / +500 / +1 000, která se sčítají
- do částky lze napsat i počet: `120+35` uloží 155
- aplikace si pamatuje naposledy použitý účet a kategorii

**Historie**
- seskupeno po dnech se součtem dne
- filtry: typ, období (měsíc / rok / vše), fulltext v poznámkách, kategoriích a účtech
- klepnutím na záznam se otevře úprava i mazání

**Účty** – libovolný počet, počáteční stav, vlastní ikona.

**Víc**
- měsíční rozpočty u kategorií
- vlastní kategorie (název + emoji ikona)
- **pravidelné platby** – nájem, telefon, předplatné; zapíšou se samy, jakmile nastane den v měsíci
- světlý / tmavý vzhled, jiná měna
- **záloha do JSON**, načtení zálohy zpět, **export do CSV pro Excel**

---

## Jak ji dostat do telefonu

### A) Přes web (doporučeno – jde pak instalovat na plochu)

Stejným způsobem jako AR Geodet: obsah složky nahrát do repozitáře a zapnout GitHub Pages.
Pak v telefonu otevřít adresu a dát **Přidat na plochu** (Android: nabídka Chromu → *Přidat na plochu*;
iPhone: Sdílet → *Přidat na plochu*). Od té chvíle se aplikace chová jako běžná ikona a jede offline.

Instalace na plochu funguje jen přes **https** (nebo localhost) – proto ta cesta přes Pages.

### B) Rychlé vyzkoušení na počítači

```
cd C:\Users\stepa\Desktop\moje-finance
python -m http.server 8000
```
a otevřít `http://localhost:8000`.

Na telefonu ve stejné Wi-Fi zadejte `http://<IP-počítače>:8000`. Takhle se dá appka projet,
ale na plochu ji Chrome nenainstaluje (není to https).

### C) Úplně bez serveru

Otevřít `index.html` rovnou v prohlížeči. Všechno funguje kromě offline vrstvy.
Data jsou v tomhle případě navázaná na cestu k souboru – jako trvalé řešení to nedoporučuju.

---

## Zálohy

Data leží v `localStorage` prohlížeče. To je spolehlivé, ale ne nesmrtelné – vymazání dat
prohlížeče nebo odinstalace je smaže. **Jednou za čas si ve *Víc → Data* stáhněte zálohu (JSON).**
Zpátky se načte tamtéž. CSV je pro Excel, zpátky ho aplikace nenačítá.

---

## Když budete něco měnit

Soubory:

| Soubor | Co v něm je |
|---|---|
| `index.html` | kostra obrazovek |
| `css/styl.css` | vzhled, barvy (světlé i tmavé téma) |
| `js/data.js` | uložení dat a všechny výpočty (zůstatky, souhrny, rozpočty, export) |
| `js/grafy.js` | grafy z HTML prvků, bez knihovny |
| `js/app.js` | obrazovky, formuláře, obsluha klepnutí |
| `sw.js` | offline vrstva |
| `ikony/` | ikony aplikace |
| `test-proklikani.py` | automatický proklik aplikace v prohlížeči (Playwright) |

⚠ **Po každé úpravě zvedněte `VERZE` v `sw.js`** (`moje-finance-v1` → `v2` → …),
jinak telefon podrží starou verzi z mezipaměti a změny se neprojeví.

### Ověřeno

Aplikace byla proklikána v Chromiu v rozlišení telefonu (390 × 844): zápis výdaje, příjmu i převodu,
sčítací tlačítka, počet v částce, filtry a hledání, proklik z grafu, úprava a mazání záznamu,
rozpočty, nová kategorie i účet, přepnutí tématu, výběr měsíce, export JSON/CSV a přežití restartu.
38 kontrol, bez chyby v konzoli.

Po vlastních úpravách si totéž pustíte znovu:

```
python test-proklikani.py
```

(potřebuje `pip install playwright` a `playwright install chromium`; na konci vypíše `POTIZE: 0`).
