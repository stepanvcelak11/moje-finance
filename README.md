# Moje finance

Mobilní aplikace na hlídání peněz: kolik přišlo, kolik odešlo, **za co** a **z kterého účtu**.
Běží v prohlížeči, jde ji nainstalovat na plochu telefonu jako běžnou appku a funguje i bez signálu.

**Data zůstávají v telefonu.** Žádné přihlašování, žádný server, nic se nikam neposílá.

---

## Co umí

**Výpis z banky (verze 2.0) – aby se nemuselo zapisovat všechno ručně**
- v internetovém bankovnictví stáhnete pohyby jako **CSV** (nebo GPC/ABO) a appka je načte
- bere **CSV, Excel (.xlsx) a GPC**; sloupce pozná sama podle hlavičky. Vyzkoušeno na napodobeninách
  exportů Fio, Česká spořitelna (CSV i Excel), KB, ČSOB, Raiffeisen, Air Bank, mBank, Moneta, UniCredit,
  Partners/Creditas, Revolut, N26 a Wise – viz `ukazky-vypisu/`. Na skutečných souborech z bank
  zatím ověřeno není; kdyby sloupce nesedly, dají se přehodit ručně
- u výběru banky appka ukáže, kde v bankovnictví export obvykle je
- **bezpečnost**: soubor se čte jen v telefonu (JavaScript v prohlížeči), nikam se neodesílá –
  appka nemá žádný server. Stažený soubor z Downloads/Souborů pak klidně smažte
- **kategorie doplní sama**: vestavěný slovník obchodů (Lidl, Albert, Shell, Wolt, Netflix,
  ČEZ, dm…) + to, co jste jednou opravili – appka si to pamatuje na příští výpis
- výběr z bankomatu zapíše jako převod do Hotovosti
- stejný výpis jde načíst znovu, co už v appce je, se podruhé nezapíše; co jste možná
  zapsali ručně, nabídne jen k potvrzení
- po zápisu se zeptá, jestli sedí zůstatek s bankou, a srovná ho
- po týdnu bez výpisu připomene načtení nového

**Zámek (dobrovolný)**
- od verze 2.0 se **při prvním spuštění nevynucuje** – zapíná se ve *Víc → Zabezpečení*
- **PIN**, volitelně otisk prstu nebo obličej
- data v telefonu jsou **zašifrovaná** (AES‑GCM, klíč z PINu přes PBKDF2) – bez PINu se z prohlížeče nedá nic přečíst
- zamyká se samo, když je aplikace chvíli na pozadí (nastavitelné)
- ⚠ zapomenutý PIN nejde obnovit, proto si držte zálohu

**Přehled (hlavní obrazovka)**
- prázdná appka nabídne dvě cesty: načíst výpis, nebo zapsat ručně
- jedna hlavní karta: **kolik je utraceno tento měsíc**, prstenec (kolik procent příjmů),
  kolik zbývá a kolik to je na den; pod tím **dnes / tento týden / na účtech**
- **Rychle zapsat** – nejčastější ruční zápisy jako tlačítka, jedno klepnutí zapíše
- „Kam šly peníze" – dělený pruh + žebříček kategorií s částkou i podílem (klepnutím se prokliknete na ty záznamy)
- **odznak trendu** u největších kategorií: o kolik se liší od průměru předchozích měsíců za stejně dlouhý úsek
- rozpočty s ukazatelem čerpání
- poslední pohyby s barevnou ikonou podle kategorie
- srovnání s minulým měsícem ke stejnému dni („↓ 12 % méně než touhle dobou v srpnu“)
- **Kde nejvíc utrácíte** – obchody za měsíc (klepnutím do historie)
- **Pravidelně odchází** – předplatné, nájem a inkasa poznané z historie (stejný obchod každý měsíc
  s podobnou částkou) + kolik to dělá měsíčně a kdy přijde další platba

**Zápis**
- **napíšete částku a klepnete na kategorii – tím je zapsáno** (hláška nabídne *Zpět*)
- kategorie jsou seřazené podle toho, co používáte; vidět je 7 nejčastějších, zbytek pod *Další*
- účet, datum, poznámka, položky a účtenka jsou schované v rozbalovacím řádku *Účet, datum, poznámka*
- výdaj, příjem a **převod mezi účty** (převod nemění celkový majetek, jen ho přesouvá)
- **nákup rozepsaný na položky** – jeden nákup, víc věcí, každá do své kategorie; částka se
  sečte sama a v přehledech se každá položka započítá tam, kam patří
- **fotka účtenky** u záznamu; se zapnutým zámkem je zašifrovaná stejně jako ostatní data
- **dlouhý stisk na `+`** nabídne nejčastější kombinace – jedno klepnutí zapíše, hláška nabídne vrácení
- do částky lze napsat i počet: `120+35` uloží 155
- aplikace si pamatuje naposledy použitý účet a kategorii

**Historie**
- seskupeno po dnech se součtem dne
- filtry: typ, období (měsíc / rok / vše), fulltext v poznámkách, kategoriích a účtech
- klepnutím na záznam se otevře úprava i mazání

**Grafy** (z Přehledu tlačítkem *Grafy →*, nebo z *Víc*)
- posledních 6 měsíců vedle sebe (příjmy × výdaje), klepnutím na sloupec se vypíšou čísla
- útrata den po dni s vyznačeným dneškem a průměrem
- narůstající útrata proti stejné části minulého měsíce
- ve který den v týdnu utrácíte nejvíc
- vývoj zůstatku za 12 měsíců
- odkud peníze odcházejí (po účtech) a odkud přicházejí (po kategoriích)

**Účty** – libovolný počet, vlastní ikona a barva. U účtu se píše **kolik na něm je teď**
(podle banky), počáteční stav si appka dopočítá.

**Víc**
- zabezpečení: změna PINu, odemykání otiskem, za jak dlouho zamknout, vypnutí zámku
- měsíční rozpočty u kategorií
- vlastní kategorie (název, ikona z mřížky a barva)
- **pravidelné platby** – nájem, telefon, předplatné; zapíšou se samy, jakmile nastane den v měsíci
- světlý / tmavý vzhled, jiná měna
- **záloha do JSON**, načtení zálohy zpět, **export do CSV pro Excel**

---

## Jak ji dostat do telefonu

### A) Přes web (doporučeno – jde pak instalovat na plochu)

Aplikace už běží na GitHub Pages:

### 👉 https://stepanvcelak11.github.io/moje-finance/

Otevřete tu adresu v telefonu a dejte **Přidat na plochu** (Android: nabídka Chromu →
*Přidat na plochu*; iPhone: Sdílet → *Přidat na plochu*). Od té chvíle se aplikace chová
jako běžná ikona a jede i bez signálu.

Instalace na plochu funguje jen přes **https** (nebo localhost) – proto ta cesta přes Pages.

Repozitář: https://github.com/stepanvcelak11/moje-finance – po `git push` na větev `main`
se web sám přestaví (chvilku to trvá).

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

Data leží v `localStorage` prohlížeče, se zapnutým zámkem zašifrovaná. To je spolehlivé, ale ne
nesmrtelné – vymazání dat prohlížeče, odinstalace **nebo zapomenutý PIN** je smaže.
**Jednou za čas si ve *Víc → Data* stáhněte zálohu (JSON).** Zpátky se načte tamtéž;
záloha nese i fotky účtenek, takže bývá o dost větší.
CSV je pro Excel, zpátky ho aplikace nenačítá.

Záloha je záměrně **nešifrovaná** – kdyby byla zamčená stejným PINem, přestala by být pojistkou
proti jeho zapomenutí. Chovejte se k ní jako k citlivému souboru.

## Ikony

Ikony jsou vektorové (SVG), ne emoji. Emoji vypadají na každém telefonu jinak, nesou si vlastní
účaří – proto se nedaly spolehlivě vycentrovat – a nejdou obarvit. Sada pochází z projektu
**Lucide** (licence ISC, plné znění v `LICENCE-IKONY.txt`), kresby jsou přibalené natvrdo
v `js/ikony.js`, takže aplikace nic nestahuje a funguje bez signálu. Ikona bere barvu své
kategorie a v mřížce se centruje sama.

Kategorii i účtu se ikona a barva vybírá z mřížky ve *Víc → Kategorie* a v *Účty*.

## Jak je to se zámkem udělané

Data šifruje náhodný klíč, ne přímo PIN. Ten klíč je uložený zabalený: jednou klíčem odvozeným
z PINu (PBKDF2, 250 000 kol, SHA‑256), volitelně podruhé klíčem z otisku (WebAuthn, rozšíření PRF).
Změna PINu proto jen přebalí klíč a data se nepřepisují. Otisk funguje jen tam, kde telefon PRF
podporuje – jinak aplikace řekne, že zůstává PIN, a nedělá, že chrání víc, než chrání.

Zámek potřebuje **https nebo localhost** (Web Crypto a WebAuthn jinde nejedou). Přes adresu na
GitHub Pages je tedy v pořádku; přes `http://<IP>:8000` v místní síti se zapnout nedá a aplikace
to napíše v *Víc → Zabezpečení*.

---

## Když budete něco měnit

Soubory:

| Soubor | Co v něm je |
|---|---|
| `index.html` | kostra obrazovek |
| `css/styl.css` | vzhled, barvy (světlé i tmavé téma) |
| `js/data.js` | uložení dat a všechny výpočty (zůstatky, souhrny, rozpočty, export) |
| `js/grafy.js` | grafy z HTML a SVG prvků, bez knihovny |
| `js/import.js` | rozbor výpisu z banky (CSV, GPC), slovník obchodů, otisky proti dvojímu načtení |
| `js/ikony.js` | vektorové ikony (sada Lucide, licence ISC – viz `LICENCE-IKONY.txt`) |
| `js/zamek.js` | PIN, biometrika, šifrování a obrazovka zámku |
| `js/app.js` | obrazovky, formuláře, obsluha klepnutí |
| `sw.js` | offline vrstva |
| `ikony/` | ikony aplikace |
| `test-proklikani.py` | automatický proklik aplikace v prohlížeči (Playwright) |
| `test-import.py` | proklik načtení výpisu z banky (85 kontrol, 16 formátů) |
| `ukazky-vypisu/` | napodobeniny výpisů z bank pro test (`vyrob.py` je vyrobí znovu) |

⚠ **Po každé úpravě zvedněte `VERZE` v `sw.js`** (`moje-finance-v1` → `v2` → …),
jinak telefon podrží starou verzi z mezipaměti a změny se neprojeví.

### Ověřeno

Aplikace byla proklikána v Chromiu v rozlišení telefonu (390 × 844): nastavení PINu i odmítnutí
neshodného, odemčení správným PINem a odmítnutí špatného, zamčení na povel, vypnutí zámku,
kontrola, že v trezoru opravdu není čitelný text; dále zápis výdaje, příjmu i převodu, sčítací
tlačítka, počet v částce, filtry a hledání, proklik z grafu i z „dnes", prstenec, barevné ikony,
trend kategorie, šablony přes dlouhý stisk včetně vrácení zpět, rozpočty, nová kategorie i účet,
přepnutí tématu, výběr měsíce, export JSON/CSV a přežití restartu.
K tomu vektorové ikony (včetně změření, že sedí ve středu svého pole), všech šest grafů,
nákup rozepsaný na dvě položky s různými kategoriemi a fotka účtenky – ta se ukládá,
je v úložišti zašifrovaná (v datech není holý JPEG) a po znovuotevření se načte zpátky.

**81 kontrol, bez chyby v konzoli.**

Po vlastních úpravách si totéž pustíte znovu:

```
python test-proklikani.py
python test-import.py
```

(potřebuje `pip install playwright` a `playwright install chromium`; na konci vypíše `POTIZE: 0`).
