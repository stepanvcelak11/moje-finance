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

print('hotovo')
