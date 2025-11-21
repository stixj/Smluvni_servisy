import json
from datetime import datetime
from pathlib import Path

import re
import pandas as pd


def _normalize_company_name(name: str) -> str:
    """
    Normalize company/service name for nicer display.

    Example: "HyundaiPrahaDomanskýs.r.o." -> "Hyundai Praha Domanský s.r.o.".

    Rules:
    - Inserts spaces between concatenated words based on lower→upper transitions
      (e.g. "HyundaiPrahaDomanský" -> "Hyundai Praha Domanský").
    - Normalizes and ensures a single space before common Czech legal forms
      like "s.r.o." and "a.s." even if they were written without spaces
      (e.g. "Domanskýs.r.o." -> "Domanský s.r.o.").
    """
    if not name:
        return ""

    s = str(name).strip()

    # Remember if the original string already contained any whitespace.
    # We apply more aggressive splitting only when there were no spaces at all,
    # which is typical for the broken Excel export you mentioned.
    had_whitespace = bool(re.search(r"\s", s))

    # 1) Normalize common legal suffixes (s.r.o., a.s.) and ensure a space before them.
    #    Accept also variants without dots or with irregular spaces.
    s = re.sub(r"\s*(s\.?\s*r\.?\s*o\.?)\.?", " s.r.o.", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*(a\.?\s*s\.?)\.?", " a.s.", s, flags=re.IGNORECASE)

    # 2) If the name had no spaces at all, try to split concatenated words
    #    by inserting a space before an Uppercase+lowercase pattern
    #    (typical start of a new word: Praha, Domanský, Auto, ...).
    #    Example: "HyundaiPrahaDomanský" -> "Hyundai Praha Domanský"
    if not had_whitespace:
        s = re.sub(r"(?<=[a-zá-ž])(?=[A-ZÁ-Ž][a-zá-ž])", " ", s)

        # Also separate letters and digits only in this no-space case
        # (e.g. "Praha4" -> "Praha 4")
        s = re.sub(r"([a-zA-Zá-žÁ-Ž])(\d)", r"\1 \2", s)
        s = re.sub(r"(\d)([a-zA-Zá-žÁ-Ž])", r"\1 \2", s)

    # 3) Collapse multiple spaces
    s = re.sub(r"\s{2,}", " ", s)

    return s.strip()


def convert_excel_to_json(
    input_file: str = "Smluvní servisy-AI.xlsx",
    output_file: str = "data_output.json",
) -> None:
    """
    Convert Excel file with contractual services to JSON structure.

    The output JSON has the following structure:

    {
        "meta": {
            "last_updated": "<ISO timestamp>",
            "record_count": <int>,
            "columns": ["Col1", "Col2", ...]
        },
        "data": [
            { "Col1": "value", "Col2": "value", ... },
            ...
        ]
    }

    All values are converted to strings so that frontend does not need
    to be updated when Excel structure changes.
    """

    input_path = Path(input_file)

    if not input_path.exists():
        # Basic fallback: create empty JSON so frontend does not fail hard.
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
        print(f"Generated empty JSON because Excel file '{input_file}' was not found.")
        return

    # Read Excel with automatic header recognition (first row as header)
    df = pd.read_excel(input_path, engine="openpyxl")

    # Normalize column names to strings
    df.columns = [str(col).strip() for col in df.columns]

    # Replace NaN/None with empty string and convert everything to string
    df = df.fillna("")

    records = []
    for _, row in df.iterrows():
        record = {}
        for col in df.columns:
            value = row[col]

            # Normalize service/company name column for nicer display in frontend
            if col == "KAPU":
                value = _normalize_company_name(value)

            # Convert all values to string to be safe for JSON/frontend
            record[col] = "" if value is None else str(value)

        # Skip completely empty rows
        if any(v.strip() for v in record.values()):
            records.append(record)

    meta = {
        "last_updated": datetime.now().isoformat(timespec="seconds"),
        "record_count": len(records),
        "columns": list(df.columns),
        "source_file": str(input_path),
    }

    output = {"meta": meta, "data": records}

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated '{output_file}' from '{input_file}'.")


if __name__ == "__main__":
    convert_excel_to_json()


