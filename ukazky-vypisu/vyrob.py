# -*- coding: utf-8 -*-
"""
Vyrobí ukázkové výpisy z bank pro test importu (test-import.py).

Jsou to NAPODOBENINY podle toho, jak exporty bank obvykle vypadají
(hlavička, oddělovač, kódování, znaménka) – ne skutečné soubory z bank.
Když se najde banka, jejíž skutečný export appka nerozebere, přidejte
sem její vzor a do testu kontrolu.
"""
import os

TU = os.path.dirname(os.path.abspath(__file__))


def zapis(nazev, text, kodovani='utf-8'):
    with open(os.path.join(TU, nazev), 'w', encoding=kodovani, newline='') as f:
        f.write(text.replace('\n', '\r\n'))


# Fio – úvod s údaji o účtu, pak hlavička; obchodník je jen ve zprávě
zapis('fio.csv', '''"accountId";"2100000000"
"bankId";"2010"
"currency";"CZK"
"iban";"CZ6520100000002100000000"
"openingBalance";"12500,00"
"closingBalance";"9954,60"
"dateStart";"01.09.2026"
"dateEnd";"22.09.2026"

"ID operace";"Datum";"Objem";"Měna";"Protiúčet";"Název protiúčtu";"Kód banky";"Název banky";"KS";"VS";"SS";"Poznámka";"Zpráva pro příjemce";"Typ";"Provedl";"Upřesnění";"Komentář";"BIC";"ID pokynu"
"26000001";"01.09.2026";"-349,50";"CZK";"";"";"";"";"";"";"";"Nákup: LIDL DEKUJE ZA NAKUP, Praha, CZ";"Nákup: LIDL DEKUJE ZA NAKUP, Praha";"Platba kartou";"Novák, Jan";"349,50 CZK";"";"";""
"26000002";"02.09.2026";"-1 290,00";"CZK";"";"";"";"";"";"";"";"Nákup: SHELL 2211, Brno";"Nákup: SHELL 2211, Brno";"Platba kartou";"Novák, Jan";"";"";"";""
"26000003";"05.09.2026";"-2 000,00";"CZK";"";"";"";"";"";"";"";"Výběr z bankomatu: KB, Praha";"Výběr z bankomatu: KB, Praha";"Výběr z bankomatu";"Novák, Jan";"";"";"";""
"26000004";"10.09.2026";"32 000,00";"CZK";"123456789";"FIRMA ABC s.r.o.";"0100";"Komerční banka";"";"202609";"";"Mzda 08/2026";"Mzda 08/2026";"Bezhotovostní příjem";"";"";"";"";""
"26000005";"12.09.2026";"-189,00";"CZK";"";"";"";"";"";"";"";"Nákup: WOLT PRAHA";"Nákup: WOLT PRAHA";"Platba kartou";"Novák, Jan";"";"";"";""
"26000006";"15.09.2026";"-415,80";"CZK";"";"";"";"";"";"";"";"Nákup: KAVARNA U LVA";"Nákup: KAVARNA U LVA";"Platba kartou";"Novák, Jan";"";"";"";""
"26000007";"18.09.2026";"-799,00";"CZK";"";"";"";"";"";"";"";"Nákup: PAPIRNICTVI PEPA";"Nákup: PAPIRNICTVI PEPA";"Platba kartou";"Novák, Jan";"";"";"";""
"26000008";"20.09.2026";"-512,10";"CZK";"";"";"";"";"";"";"";"Nákup: LIDL DEKUJE ZA NAKUP, Brno, CZ";"Nákup: LIDL DEKUJE ZA NAKUP, Brno";"Platba kartou";"Novák, Jan";"";"";"";""
''')

# Air Bank – středníky, znaménková částka, směr úhrady, obchodní místo
zapis('airbank.csv', '''"Datum provedení";"Směr úhrady";"Typ úhrady";"Skupina plateb";"Měna účtu";"Částka v měně účtu";"Poplatek v měně účtu";"Původní měna úhrady";"Původní částka úhrady";"Název protistrany";"Číslo účtu protistrany";"Název účtu protistrany";"Variabilní symbol";"Konstantní symbol";"Specifický symbol";"Poznámka pro mne";"Zpráva pro příjemce";"Poznámka k úhradě";"Obchodní místo"
"03.09.2026";"Odchozí";"Platba kartou";"Nákupy";"CZK";"-245,00";"0,00";"CZK";"-245,00";"ALBERT 0612";"";"";"";"";"";"";"";"";"ALBERT 0612, PRAHA"
"04.09.2026";"Odchozí";"Platba kartou";"Nákupy";"CZK";"-1 499,00";"0,00";"CZK";"-1 499,00";"DATART";"";"";"";"";"";"";"";"";"DATART, BRNO"
"09.09.2026";"Příchozí";"Bezhotovostní";"";"CZK";"500,00";"0,00";"CZK";"500,00";"Jana Nováková";"1234567/0800";"";"";"";"";"";"vraceni za listky";"";""
"11.09.2026";"Odchozí";"Trvalý příkaz";"Bydlení";"CZK";"-9 800,00";"0,00";"CZK";"-9 800,00";"Pronajímatel Dvořák";"2233445566/0300";"";"";"";"";"";"najem zari";"";""
''')

# Revolut – čárky, desetinná tečka, stav transakce (vrácená se nezapíše)
zapis('revolut.csv', '''Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-09-06 12:22:10,2026-09-07 09:11:01,Netflix,-259.00,0.00,CZK,COMPLETED,1941.00
CARD_PAYMENT,Current,2026-09-08 18:02:44,2026-09-09 10:00:00,Bolt Food,-312.40,0.00,CZK,COMPLETED,1628.60
CARD_PAYMENT,Current,2026-09-08 19:10:00,,Zara,-990.00,0.00,CZK,REVERTED,
TOPUP,Current,2026-09-01 08:00:00,2026-09-01 08:00:05,Top-Up by *1234,2200.00,0.00,CZK,COMPLETED,2200.00
''')

# Česká spořitelna (George) – čárky, uvozovky, kódování windows-1250
zapis('george.csv', '''"Datum zaúčtování","Datum provedení","Částka","Měna","Název protistrany","Číslo účtu protistrany","Zpráva pro příjemce","Poznámka"
"14.09.2026","13.09.2026","-1 180,00","CZK","KAUFLAND 1500","","",""
"16.09.2026","16.09.2026","-649,00","CZK","DM DROGERIE MARKT","","",""
"17.09.2026","17.09.2026","-3 200,00","CZK","CEZ PRODEJ","","zaloha elektrina",""
''', kodovani='cp1250')

# GPC (ABO) – pevné pozice, halíře, kódování windows-1250
def gpc_radek(protiucet, cislo, halire, kod, vs, datum, nazev):
    r = '075'
    r += '0000002100000000'           # 4–19 vlastní účet
    r += protiucet.rjust(16, '0')     # 20–35 protiúčet
    r += cislo.rjust(13, '0')         # 36–48 číslo dokladu
    r += str(halire).rjust(12, '0')   # 49–60 částka v haléřích
    r += kod                          # 61 1 = debet, 2 = kredit
    r += vs.rjust(10, '0')            # 62–71 VS
    r += '0000000000'                 # 72–81 KS
    r += '0000000000'                 # 82–91 SS
    r += datum                        # 92–97 valuta DDMMYY
    r += nazev.ljust(20)[:20]         # 98–117 název
    r += '0'                          # 118
    r += '0203'                       # 119–122 měna
    r += datum                        # 123–128 datum splatnosti
    return r

gpc = [
    '0740000002100000000Jan Novak           010926000000001250000+000000000995460+0000000000000000000000000000000000000000000000000001220926',
    gpc_radek('0', '1', 34950, '1', '0', '010926', 'LIDL DEKUJE ZA NAKUP'),
    '076Nakup: LIDL, Praha',
    gpc_radek('123456789', '2', 3200000, '2', '202609', '100926', 'FIRMA ABC S.R.O.'),
    gpc_radek('0', '3', 18900, '1', '0', '120926', 'WOLT PRAHA'),
]
zapis('vypis.gpc', '\n'.join(gpc) + '\n', kodovani='cp1250')

# ---------------------------------------------------------------
# Další banky (přidáno ve verzi 2.1)
# ---------------------------------------------------------------

# Komerční banka – úvodní řádky, windows-1250, obchodník v popisu příkazce
zapis('kb.csv', '''Číslo účtu;123-4567890217/0100
Období;01.09.2026 - 22.09.2026
Počáteční zůstatek;15 000,00
Konečný zůstatek;12 911,00

"Datum splatnosti";"Datum odepsání z jiné banky";"Protiúčet a kód banky";"Název protiúčtu";"Částka";"Originální částka";"Originální měna";"Kurz";"VS";"KS";"SS";"Identifikace transakce";"Systémový popis";"Popis příkazce";"Popis pro příjemce";"AV pole 1";"AV pole 2";"AV pole 3";"AV pole 4"
"02.09.2026";"";"";"";"-389,00";"-389,00";"CZK";"";"";"";"";"KB001";"Platba kartou";"BILLA SPOL. S R.O., PRAHA";"";"BILLA 612";"";"";""
"08.09.2026";"";"19-2000145399/0800";"PRAZSKA PLYNARENSKA";"-1 200,00";"";"";"";"4455";"";"";"KB002";"Inkaso";"zaloha plyn";"";"";"";"";""
"15.09.2026";"";"";"";"-500,00";"";"";"";"";"";"";"KB003";"Platba kartou";"TESCO STORES CR";"";"";"";"";""
''', kodovani='cp1250')

# ČSOB – úvod, středníky, obchodník v poznámce
zapis('csob.csv', '''Číslo účtu;123456789/0300
Měna;CZK
Období;01.09.2026 - 22.09.2026

Číslo účtu;Datum zaúčtování;Částka;Měna;Zůstatek;Číslo účtu protiúčtu;Kód banky protiúčtu;Název účtu protiúčtu;Konstantní symbol;Variabilní symbol;Specifický symbol;Označení operace;ID transakce;Poznámka
123456789;03.09.2026;-156,00;CZK;9844,00;;;;;;;Transakce platební kartou;T1;Místo: PENNY MARKET, PRAHA
123456789;05.09.2026;-89,00;CZK;9755,00;;;;;;;Transakce platební kartou;T2;Místo: SPOTIFY P1234
123456789;10.09.2026;28000,00;CZK;37755,00;987654321;0100;ZAMESTNAVATEL A.S.;;202609;;Příchozí platba;T3;MZDA ZARI
''', kodovani='cp1250')

# Raiffeisenbank – vlastní „Název účtu“ se nesmí brát jako obchodník
zapis('raiffeisen.csv', '''"Datum provedení";"Datum zaúčtování";"Číslo účtu";"Název účtu";"Kategorie transakce";"Číslo protiúčtu";"Název protiúčtu";"Typ transakce";"Zpráva";"Poznámka";"VS";"KS";"SS";"Zaúčtovaná částka";"Měna účtu";"Původní částka a měna";"Původní částka a měna";"Poplatek";"Id transakce";"Vlastní poznámka";"Název obchodníka";"Město"
"04.09.2026";"05.09.2026";"1234567890";"Můj běžný účet";"Nákupy";"";"";"Platba kartou";"";"";"";"";"";"-642,50";"CZK";"-642,50";"CZK";"0";"R1";"";"GLOBUS CR";"Brno"
"07.09.2026";"07.09.2026";"1234567890";"Můj běžný účet";"Bydlení";"2233445566/0300";"SVJ Kvetna 12";"Trvalý příkaz";"fond oprav";"";"";"";"";"-2 400,00";"CZK";"";"";"0";"R2";"";"";""
"19.09.2026";"20.09.2026";"1234567890";"Můj běžný účet";"Zábava";"";"";"Platba kartou";"";"";"";"";"";"-450,00";"CZK";"";"";"0";"R3";"";"CINEMA CITY";"Praha"
''')

# mBank – sloupce s mřížkou (#), úvod i patička
zapis('mbank.csv', '''mBank S.A., organizační složka
#Pro období:;01.09.2026;22.09.2026;

#Datum uskutečnění transakce;#Datum zaúčtování transakce;#Popis transakce;#Zpráva pro příjemce;#Plátce/Příjemce;#Číslo účtu plátce/příjemce;#KS;#VS;#SS;#Částka transakce;#Účetní zůstatek po transakci;
06.09.2026;07.09.2026;PLATBA KARTOU;;ROSSMANN 045 BRNO;;;;;-231,90;5 768,10;
11.09.2026;11.09.2026;PŘÍCHOZÍ PLATBA;vratka zaloha;PETR NOVAK;1234567890/0800;;;;750,00;6 518,10;
16.09.2026;17.09.2026;PLATBA KARTOU;;MCDONALDS 123;;;;;-179,00;6 339,10;

#Konečný zůstatek:;6 339,10 CZK;
''', kodovani='cp1250')

# Moneta
zapis('moneta.csv', '''Číslo účtu;Datum zaúčtování;Datum provedení;Částka;Měna;Číslo protiúčtu;Název protiúčtu;Popis transakce;Zpráva pro příjemce;Variabilní symbol;Obchodník
123456789;02.09.2026;01.09.2026;-99,00;CZK;;;Platba kartou;;;NETFLIX.COM
123456789;09.09.2026;09.09.2026;-640,00;CZK;;;Platba kartou;;;BENZINA CS 214
123456789;12.09.2026;12.09.2026;-1 250,00;CZK;2000123456/2010;Jan Kovar;Odchozí platba;za listky na koncert;;
''')

# UniCredit – „Název účtu“ je tu protistrana
zapis('unicredit.csv', '''Účet;Částka;Měna;Datum zaúčtování;Valuta;Banka;Název banky;Číslo účtu;Název účtu;Detaily transakce;Konstantní symbol;Variabilní symbol;Specifický symbol
1234567890;-2 150,00;CZK;03.09.2026;03.09.2026;0800;Česká spořitelna;1234567/0800;Pojišťovna Uniqa;pojistne auto;;9988;
1234567890;-310,00;CZK;13.09.2026;13.09.2026;;;;;PLATBA KARTOU DR.MAX LEKARNA;;;
''')

# Partners / Creditas – příjem a výdaj ve dvou sloupcích
zapis('partners.csv', '''Datum;Protistrana;Popis;Příjem;Výdaj;Zůstatek
01.09.2026;KAUFLAND;Platba kartou;;812,40;4 187,60
05.09.2026;Babička;dárek k narozeninám;2 000,00;;6 187,60
14.09.2026;O2 CZECH REPUBLIC;Inkaso;;599,00;5 588,60
''')

# N26 – anglicky, čárky, částka v EUR
zapis('n26.csv', '''"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)","Amount (Foreign Currency)","Type Foreign Currency","Exchange Rate"
"2026-09-02","SPAR","","MasterCard Payment","","-23.45","","",""
"2026-09-04","Ryanair","","MasterCard Payment","","-89.99","","",""
"2026-09-10","Max Muster","DE89370400440532013000","Income","rent share","150.00","","",""
''')

# Wise – datum dd-mm-yyyy
zapis('wise.csv', '''"TransferWise ID","Date","Amount","Currency","Description","Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number","Merchant","Card Last Four Digits","Card Holder Full Name","Attachment","Note","Total fees"
"CARD-1","07-09-2026","-12.50","EUR","Card transaction of 12.50 EUR issued by Starbucks","","87.50","","","","","","","Starbucks","1234","Jan Novak","","","0.00"
"TRANSFER-2","12-09-2026","100.00","EUR","Received money from Jan Novak","","187.50","","","","Jan Novak","","","","","","","","0.00"
''')


# Excel (.xlsx) – ručně složený sešit: sdílené texty, styl data, čísla
def xlsx(nazev, radky):
    import zipfile
    texty, index = [], {}

    def s(t):
        if t not in index:
            index[t] = len(texty); texty.append(t)
        return index[t]

    def ref(c, r):
        return chr(65 + c) + str(r)

    xml_radky = []
    for r, radek in enumerate(radky, 1):
        bunky = []
        for c, h in enumerate(radek):
            if isinstance(h, tuple):          # ('datum', seriove_cislo)
                bunky.append('<c r="%s" s="1"><v>%d</v></c>' % (ref(c, r), h[1]))
            elif isinstance(h, (int, float)):
                bunky.append('<c r="%s"><v>%s</v></c>' % (ref(c, r), h))
            elif h == '':
                continue
            else:
                bunky.append('<c r="%s" t="s"><v>%d</v></c>' % (ref(c, r), s(h)))
        xml_radky.append('<row r="%d">%s</row>' % (r, ''.join(bunky)))
    from xml.sax.saxutils import escape
    soubory = {
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pohyby" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>',
        'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>%s</sheetData></worksheet>' % ''.join(xml_radky),
    }
    soubory['xl/sharedStrings.xml'] = ('<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="%d">%s</sst>'
                                       % (len(texty), ''.join('<si><t>%s</t></si>' % escape(t) for t in texty)))
    with zipfile.ZipFile(os.path.join(TU, nazev), 'w', zipfile.ZIP_DEFLATED) as z:
        for k, v in soubory.items():
            z.writestr(k, v)


# 46268 = 1. 9. 2026 v Excelu
xlsx('george.xlsx', [
    ['Výpis z účtu', '', '', ''],
    ['Datum zaúčtování', 'Název protistrany', 'Částka', 'Měna', 'Zpráva pro příjemce'],
    [('datum', 46268 + 2), 'ALBERT HYPERMARKET', -734.2, 'CZK', ''],
    [('datum', 46268 + 9), 'Zubní ordinace MUDr. Malá', -1500, 'CZK', 'plomba'],
    [('datum', 46268 + 14), 'ZAMESTNAVATEL A.S.', 31500, 'CZK', 'mzda'],
])

print('hotovo i dalsi banky')
