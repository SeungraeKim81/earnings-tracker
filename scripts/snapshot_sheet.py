"""구글 시트 API 응답(get_spreadsheet, includeGridData) → migration/sheet_snapshot.json

    python scripts/snapshot_sheet.py <응답.json>

서식은 버리고 셀마다 원래 값(v)과 수식(f)만 남긴다. 받는 방법은 CLAUDE.md 참고.
"""
import json
import sys
from datetime import datetime, timezone

from lib import ROOT, dump

SHEET_ID = "1hIpfaNEgPNARBJZZiv6bL6l1_X1BwwbGi-P_YztE200"
COLS = "ABCDEFGHIJKLMNOPQR"


def main(path):
    d = json.loads(open(path, encoding="utf-8").read())
    out = {"source": f"Google Sheets earnings_tracker ({SHEET_ID})", "revisionId": d.get("revisionId"),
           "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "sheets": {}}
    for s in d["sheets"]:
        rows = []
        for i, r in enumerate(s["data"][0].get("rowData", [])):
            cells = {}
            for j, c in enumerate(r.get("values", [])[:len(COLS)]):
                ue, ev = c.get("userEnteredValue"), c.get("effectiveValue")
                if ue is None and ev is None:
                    continue
                cell = {}
                if ue and "formulaValue" in ue:
                    cell["f"] = ue["formulaValue"]
                cell["v"] = next(iter(ev.values())) if ev else None
                cells[COLS[j]] = cell
            rows.append({"row": i + 1, "cells": cells})
        out["sheets"][s["properties"]["title"]] = rows
    dump(ROOT / "migration" / "sheet_snapshot.json", out)
    print("저장:", ", ".join(f"{t} {len(r)}행" for t, r in out["sheets"].items()))


if __name__ == "__main__":
    main(sys.argv[1])
