# Ceník Náhradních Vozidel

Webová aplikace pro zobrazení ceníku náhradních vozidel s novým designem.

## Popis

Aplikace zobrazuje ceník náhradních vozidel s možností filtrování podle kategorií a vyhledávání. Data jsou načítána z Excel souboru a zobrazena v přehledném HTML rozhraní.

## Struktura projektu

```
.
├── index.html              # Hlavní HTML soubor s ceníkem
├── vypocet.html           # Stránka pro výpočet
├── ceník_náhradních_vozidel.html
├── convert_excel.py       # Skript pro konverzi Excel do JSON
├── start_server.bat       # Spuštění lokálního web serveru
├── Ceník NV 2025 FINAL.xlsx  # Zdrojový Excel soubor
├── rps_data.js            # JavaScript data pro ceník
├── Loga/                  # Loga společnosti
├── Písma/                 # Fonty DirectSans
├── pozadí/                # Obrázky pozadí
└── Historické ceníky/     # Archiv historických ceníků
```

## Požadavky

- Python 3.x (pro lokální web server)
- Webový prohlížeč

## Instalace a spuštění

1. Naklonujte repozitář:
```bash
git clone <repository-url>
cd "Ceník NV - new design"
```

2. Spusťte lokální web server:
   - Windows: Dvojklik na `start_server.bat`
   - Nebo ručně: `python -m http.server 8001`

3. Otevřete prohlížeč a přejděte na:
   ```
   http://localhost:8001/
   ```

## Konverze dat z Excel

Pro konverzi Excel souboru do JavaScript formátu:

```bash
python convert_excel.py > rps_data.js
```

## Technologie

- HTML5
- CSS3
- JavaScript (vanilla)
- Python (pro konverzi dat a lokální server)

## Licence

Vnitřní projekt společnosti.

