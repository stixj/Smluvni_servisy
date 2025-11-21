import json
from datetime import datetime
from pathlib import Path

import re
import unicodedata

import pandas as pd


# Global flag to control whether JSON is always regenerated from Excel.
# If set to False and output JSON already exists, Excel will not be read
# and the existing JSON file will be kept as-is.
AUTO_UPDATE_EXCEL: bool = True


def fix_text_encoding(text: str) -> str:
    """
    Heuristicky opraví poškozené české texty z Excelu:

    - zkusí různé převody mezi latin1 / cp1250 / utf-8 a vybere variantu
      s nejvyšším počtem českých znaků
    - ručně opraví nejčastější záměny typu \"Ĺ\", \"Ĺ˝\" apod.
    - odstraní přebytečné backslashe a sjednotí mezery
    - normalizuje Unicode (NFC)
    """
    if not isinstance(text, str):
        return text

    t = text.strip()
    if not t:
        return t

    candidates: list[tuple[int, str]] = []

    # Zahrneme i původní text jako baseline kandidáta
    base_score = sum(ch in "ěščřžýáíéúůĚŠČŘŽÝÁÍÉÚŮ" for ch in t)
    candidates.append((base_score, t))

    # Zkus různé kombinace kódování / dekódování
    for enc_in, enc_out in [("latin1", "utf-8"), ("latin1", "cp1250"), ("cp1250", "utf-8")]:
        try:
            fixed = t.encode(enc_in, errors="ignore").decode(enc_out, errors="ignore")
            score = sum(ch in "ěščřžýáíéúůĚŠČŘŽÝÁÍÉÚŮ" for ch in fixed)
            candidates.append((score, fixed))
        except Exception:
            continue

    # Vyber kandidáta s nejvyšším počtem českých znaků
    t = max(candidates, key=lambda x: x[0])[1] if candidates else t

    # Ruční oprava častých záměn
    mapping = {
        "Ĺ": "L",
        "ĺ": "l",
        "Ě": "ě",
        "Ĺ˝": "Ž",
        "Ĺž": "ž",
        "Ĺ ": "Š",
        "Ĺˇ": "š",
    }
    for bad, good in mapping.items():
        t = t.replace(bad, good)

    # Odstranění přebytečných backslashů a sjednocení mezer
    t = re.sub(r"\\+", "", t)
    t = re.sub(r"\s+", " ", t)

    return unicodedata.normalize("NFC", t)


def normalize_spacing(text: str) -> str:
    """
    Normalize spacing and basic encoding issues in text.

    - uses fix_text_encoding to repair diacritics and junk
    - inserts spaces between lowercase/uppercase letters and digits (Praha8Troja -> Praha 8 Troja)
    - inserts spaces before company abbreviations (s.r.o., a.s., v.o.s., k.s.)
    - merges excessive whitespace
    """
    if not isinstance(text, str):
        return text

    t = fix_text_encoding(text)

    # space between lowercase letter and uppercase letter or digit
    t = re.sub(r"(?<=[a-zá-ž])(?=[A-ZÁ-Ž0-9])", " ", t)
    # space between digit and letter (8Troja -> 8 Troja)
    t = re.sub(r"(?<=[0-9])(?=[A-ZÁ-Ža-zá-ž])", " ", t)

    # space before company abbreviations
    t = re.sub(r"(?<!\s)(s\.r\.o\.|a\.s\.|v\.o\.s\.|k\.s\.)", r" \1", t)

    # normalize whitespace
    t = re.sub(r"\s+", " ", t)

    # final pass to merge split characters with diacritics
    t = fix_combined_diacritics(t)

    return t.strip()


def fix_combined_diacritics(t: str) -> str:
    """
    Finální oprava rozdělených znaků s diakritikou.
    Např. 'Jeremi ásova' → 'Jeremiášova', 'Hlavn í m ěsto' → 'Hlavní město'
    """
    if not isinstance(t, str):
        return t

    s = t

    # základní páry (rozšířené o běžné kombinace)
    pairs = {
        "a á": "á", "e é": "é", "i í": "í", "o ó": "ó", "u ú": "ú",
        "u ů": "ů", "y ý": "ý", "r ř": "ř", "s š": "š", "t ť": "ť",
        "d ď": "ď", "n ň": "ň", "z ž": "ž", "c č": "č", "l í": "lí",
        "A Á": "Á", "E É": "É", "I Í": "Í", "O Ó": "Ó", "U Ú": "Ú",
        "U Ů": "Ů", "Y Ý": "Ý", "R Ř": "Ř", "S Š": "Š", "T Ť": "Ť",
        "D Ď": "Ď", "N Ň": "Ň", "Z Ž": "Ž", "C Č": "Č",

        # kombinace slov / vnitřní kombinace
        "i á": "iá", "á š": "áš", "ě s": "ěs", "m ě": "mě",
        "n í": "ní", "č í": "čí", "š o": "šo", "ě l": "ěl",
        "r á": "rá", "ě n": "ěn", "ž í": "ží", "k ý": "ký",
        "k á": "ká", "v ý": "vý", "t ř": "tř", "h ý": "hý",
    }

    for bad, good in pairs.items():
        s = s.replace(bad, good)

    # cílené opravy konkrétních rozbitých frází z Excelu
    phrase_fixes = {
        "Domansk ý": "Domanský",
        "zna čky": "značky",
        # různé varianty toho samého špatného textu
        "Opravuj ízna čkyaut": "Opravují značky aut",
        "Opravuj íznačkyaut": "Opravují značky aut",
        "Prohl ídkov ém ísto": "Prohlídkové místo",
        "Prohlídkov ém ísto": "Prohlídkové místo",
        "Prohl ídka": "Prohlídka",
        "Limitprohl ídkyod 15.9.2022": "Limit prohlídky od 15. 9. 2022",
        "Limitprohlídkyod 15.9.2022": "Limit prohlídky od 15. 9. 2022",
        "Zeměd ělsk á": "Zemědělská",
        "Petr Nelh ýbel": "Petr Nelhýbel",
        "Praha-v ýchod": "Praha-východ",
        "St ředo česk ý kraj": "Středočeský kraj",
        "Kontaktníosoba": "Kontaktní osoba",
        "Provoznídoba": "Provozní doba",
    }

    for bad, good in phrase_fixes.items():
        s = s.replace(bad, good)

    # odstranění vícenásobných mezer
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s


def _clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    Apply `normalize_spacing` (which internally uses `fix_text_encoding`) to all textual cells.

    Returns tuple (cleaned_df, fixed_cell_count).
    """
    df = df.fillna("")
    fixed_cells = 0

    for col in df.columns:
        new_values = []

        for row_index, value in df[col].items():
            try:
                original = value
                normalized = normalize_spacing(value)
            except Exception as exc:  # very defensive; should be rare
                print(
                    f"[ENCODING WARNING] row={row_index}, column='{col}': {exc}. "
                    f"Original value: {repr(value)}"
                )
                normalized = "" if value is None else str(value)

            # Count only actually changed string values
            if isinstance(original, str) and isinstance(normalized, str) and normalized != original:
                fixed_cells += 1

            new_values.append(normalized)

        # type: ignore[assignment] – pandas column assignment
        df[col] = new_values  # type: ignore[assignment]

    return df, fixed_cells


def convert_excel_to_json(
    input_file: str = "Smluvní servisy-AI.xlsx",
    output_file: str = "data_output.json",
    force_update: bool | None = None,
) -> None:
    """
    Načte Excel, opraví slepené texty a uloží JSON.

    Základní forma (jeden list v Excelu):

        {
          "meta": { "last_updated": "...", "record_count": X, "columns": [...] },
          "data": [ {...}, {...}, ... ]
        }

    Bonus: pokud Excel obsahuje víc listů (např. \"Auta\", \"BUS\", \"Skla\"),
    načte je všechny a výstup bude:

        {
          "meta": { "last_updated": "...", "record_count": X, "columns": [...], "sheets": [...] },
          "data": { "Auta": [...], "BUS": [...], "Skla": [...] }
        }
    """

    # Determine effective update behavior: explicit argument has priority,
    # otherwise use global AUTO_UPDATE_EXCEL.
    if force_update is None:
        force_update = AUTO_UPDATE_EXCEL

    input_path = Path(input_file)
    output_path = Path(output_file)

    # If automatic update is disabled and JSON already exists, keep it as-is.
    if not force_update and output_path.exists():
        print(
            f"Přeskakuji aktualizaci z Excelu, protože AUTO_UPDATE_EXCEL=False "
            f"a soubor '{output_file}' již existuje."
        )
        return

    if not input_path.exists():
        meta = {
            "last_updated": datetime.now().isoformat(timespec="seconds"),
            "record_count": 0,
            "columns": [],
            "source_file": str(input_path),
            "note": "Input Excel file not found when generating JSON.",
        }
        output = {"meta": meta, "data": []}
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"Vytvořen prázdný JSON, protože Excel '{input_file}' nebyl nalezen.")
        return

    # 1) Načtení Excelu přes pandas.read_excel(..., dtype=str, keep_default_na=False, engine=\"openpyxl\", sheet_name=None)
    excel_obj = pd.read_excel(
        input_path,
        dtype=str,
        keep_default_na=False,
        engine="openpyxl",
        sheet_name=None,
    )

    # pandas se sheet_name=None vrací dict{sheet_name: DataFrame}
    if isinstance(excel_obj, pd.DataFrame):
        sheets = {"Sheet1": excel_obj}
    else:
        sheets = excel_obj

    cleaned_sheets: dict[str, list[dict]] = {}
    columns_by_sheet: dict[str, list[str]] = {}
    all_columns = set()
    total_records = 0
    total_fixed_cells = 0

    for sheet_name, df in sheets.items():
        df, fixed_cells = _clean_dataframe(df)
        total_fixed_cells += fixed_cells
        columns = df.columns.tolist()
        columns_by_sheet[sheet_name] = columns
        records = df.to_dict(orient="records")
        cleaned_sheets[sheet_name] = records
        total_records += len(records)
        all_columns.update(columns)

        print(f"List '{sheet_name}': opraveno buněk: {fixed_cells}")

    last_updated = datetime.now().isoformat(timespec="seconds")
    sheet_names = list(cleaned_sheets.keys())
    normalized_sheet_names = {name.lower() for name in sheet_names}

    # BONUS struktura jen v případě, že listy jsou přesně \"Auta\", \"BUS\", \"Skla\" (libovolné pořadí, case-insensitive)
    if normalized_sheet_names == {"auta", "bus", "skla"}:
        meta = {
            "last_updated": last_updated,
            "record_count": total_records,
            "columns": list(all_columns),
            "source_file": str(input_path),
            "sheets": sheet_names,
        }
        output = {"meta": meta, "data": cleaned_sheets}
    else:
        # Výchozí chování: použij hlavní (první) list jako ploché pole záznamů,
        # aby struktura zůstala {\"meta\": {...}, \"data\": [...] } pro frontend.
        main_sheet_name = sheet_names[0]
        records = cleaned_sheets[main_sheet_name]
        meta = {
            "last_updated": last_updated,
            "record_count": len(records),
            "columns": columns_by_sheet[main_sheet_name],
            "source_file": str(input_path),
            "sheet_name": main_sheet_name,
        }
        output = {"meta": meta, "data": records}

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Úspěšně vygenerován '{output_file}' z '{input_file}'.")
    print(f"Celkem opraveno buněk: {total_fixed_cells}")


if __name__ == "__main__":
    convert_excel_to_json()


