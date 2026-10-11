"""구글 시트 스냅샷 + overlay → data/seasons/*.json, data/index.json

    python scripts/import_sheet.py

1. migration/sheet_snapshot.json(시트 원본 값·수식)을 읽는다.
2. 시트의 서프라이즈·영업이익률 수식 결과와 lib.py 계산이 모두 같은지 확인한다(다르면 중단).
3. migration/overlay.json의 기간·일정·회계기준·출처·정정을 덧씌운다.
4. 시즌 파일을 쓴다.

웹을 마스터로 전환하기 전까지는 시트를 새로 받아(README 참고) 이 스크립트를 다시 돌리면 된다.
"""
import json
import re
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from lib import DATA, ROOT, SHEET_COLS, STATUS, dump, load, margin, ratio_change

SNAPSHOT = ROOT / "migration" / "sheet_snapshot.json"
OVERLAY = ROOT / "migration" / "overlay.json"
TOL = 1e-9
QUARTER_MONTHS = {1: (1, 3), 2: (4, 6), 3: (7, 9), 4: (10, 12)}

errors = []


def fail(msg):
    errors.append(msg)


def season_id(title):
    m = re.fullmatch(r"Q([1-4]) (\d{4})", title)
    return f"{m[2]}Q{m[1]}"


def calendar_period(label):
    """'Q2 2026' → 2026-04-01 ~ 2026-06-30"""
    m = re.fullmatch(r"Q([1-4]) (\d{4})", label)
    if not m:
        return None
    q, y = int(m[1]), int(m[2])
    a, b = QUARTER_MONTHS[q]
    end = (date(y + (b == 12), b % 12 + 1, 1) - timedelta(days=1))
    return {"start": date(y, a, 1).isoformat(), "end": end.isoformat()}


def cell(row, col):
    c = row["cells"].get(col)
    if c is None:
        return None
    v = c.get("v")
    return None if v == "" else v


def parity(sid, ticker, row, metrics_raw):
    """시트 수식 결과(J·M·P)와 lib 계산 비교"""
    pairs = [("J", ratio_change(metrics_raw.get("revenue"), metrics_raw.get("revenue_consensus"))),
             ("M", margin(metrics_raw.get("operating_income"), metrics_raw.get("revenue"))),
             ("P", ratio_change(metrics_raw.get("eps"), metrics_raw.get("eps_consensus")))]
    for col, mine in pairs:
        sheet = cell(row, col)
        if "f" not in row["cells"].get(col, {}):
            fail(f"{sid} {ticker} {col}열이 수식이 아님")
        if (sheet is None) != (mine is None) or (sheet is not None and abs(sheet - mine) > TOL):
            fail(f"{sid} {ticker} {col}열 불일치: 시트 {sheet} / 계산 {mine}")


def build_metric(key, raw, ov, company, changes):
    """시트 값 + overlay → 지표 객체(값도 메모도 없으면 None)"""
    ov = dict(ov or {})
    m = {"value": raw}
    if "value" in ov:
        new = ov.pop("value")
        if new != raw:
            if not ov.get("reason"):
                fail(f"{company['ticker']} {key}: 시트 값과 다른데 reason 없음")
            m["sheet_value"] = raw
            changes.append({"field": key, "from": raw, "to": new, "reason": ov.get("reason")})
        m["value"] = new
    m.update(ov)
    if key == "price_reaction" and m["value"] is not None and company.get("reaction_basis"):
        m.setdefault("basis", company["reaction_basis"])
    if m["value"] is None and len(m) == 1:
        return None
    return m


def main():
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    overlay = json.loads(OVERLAY.read_text(encoding="utf-8"))["seasons"]
    comp = load("companies.json")
    by_ticker = {c["ticker"]: c for c in comp["companies"]}
    fetched = datetime.fromisoformat(snap["fetched"].replace("Z", "+00:00"))
    updated = fetched.astimezone(ZoneInfo("Asia/Bangkok")).date().isoformat()

    index = []
    for title, rows in snap["sheets"].items():
        sid = season_id(title)
        sov = overlay.get(sid, {})
        evov_all = sov.get("events", {})
        by_row = {r["row"]: r for r in rows}
        sub = cell(by_row[2], "A") or ""
        m = re.search(r"업데이트: (\d{4}-\d{2}-\d{2})", sub)
        events, seen = [], set()

        for r in rows:
            ticker = cell(r, "B")
            if ticker not in by_ticker:
                continue
            company = by_ticker[ticker]
            seen.add(ticker)
            for col, key in (("C", "name"), ("D", "sector"), ("G", "currency")):
                if cell(r, col) != company[key]:
                    fail(f"{sid} {ticker} {col}열 '{cell(r, col)}' ≠ companies.json '{company[key]}'")
            raw = {key: cell(r, col) for col, key in SHEET_COLS.items()}
            for key, v in raw.items():
                if v is not None and not isinstance(v, (int, float)):
                    fail(f"{sid} {ticker} {key} 값이 숫자가 아님: {v!r}")
            parity(sid, ticker, r, raw)

            ov = evov_all.get(ticker, {})
            changes = []
            status = STATUS.get(cell(r, "A"))
            if status is None:
                fail(f"{sid} {ticker} 알 수 없는 상태 '{cell(r, 'A')}'")

            label = cell(r, "F")
            if "label" in ov and ov["label"] != label:
                changes.append({"field": "label", "from": label, "to": ov["label"], "reason": ov.get("label_reason")})
                label = ov["label"]
            period = calendar_period(label) if company["fiscal"]["calendar"] else None
            if "period" in ov:
                period = {**(period or {}), **ov["period"]}
            if period is None:
                fail(f"{sid} {ticker} 회계기간 날짜 없음(overlay에 period 필요)")

            announce = {"date": cell(r, "E"), "timing": None,
                        "certainty": "confirmed" if status == "reported" else "estimated"}
            announce.update(ov.get("announce", {}))

            metrics = {k: build_metric(k, raw[k], ov.get("metrics", {}).get(k), company, changes)
                       for k in SHEET_COLS.values()}
            for k in ov.get("metrics", {}):
                if k not in metrics:
                    fail(f"{sid} {ticker} overlay에 모르는 지표 '{k}'")

            notes = cell(r, "R") or ""
            for old, new in ov.get("notes_replace", []):
                if new in notes:      # 시트에 이미 정정 문구가 들어가 있음
                    continue
                if old not in notes:
                    fail(f"{sid} {ticker} 비고에 '{old[:30]}…' 없음")
                notes = notes.replace(old, new)
            if notes != (cell(r, "R") or ""):
                changes.append({"field": "notes", "reason": "0단계 정리(문구 정정)"})

            ev = {"ticker": ticker, "status": status, "stage": ov.get("stage"), "label": label,
                  "period": period, "currency": cell(r, "G"), "announce": announce,
                  "metrics": metrics, "notes": notes}
            if changes:
                ev["changes"] = changes
            events.append(ev)

        missing = set(by_ticker) - seen
        if missing:
            fail(f"{sid} 시트에 없는 회사: {sorted(missing)}")
        extra = set(evov_all) - seen
        if extra:
            fail(f"{sid} overlay에만 있는 회사: {sorted(extra)}")

        highlights = []
        for n in sov.get("highlight_rows", []):
            t = cell(by_row[n], "A") or ""
            if not t.startswith("•"):
                fail(f"{sid} {n}행이 legend 항목이 아님: {t[:30]}")
            highlights.append(t.lstrip("• ").strip())

        events.sort(key=lambda e: by_ticker[e["ticker"]]["order"])
        season = {"id": sid, "label": sov.get("label", title), "sheet_updated": m[1] if m else None,
                  "updated": updated, "source": "google_sheet", "highlights": highlights, "events": events}
        index.append(season)

    if errors:
        print("이관 실패:\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)

    (DATA / "seasons").mkdir(parents=True, exist_ok=True)
    for s in index:
        dump(DATA / "seasons" / f"{s['id']}.json", s)
    index.sort(key=lambda s: s["id"])
    dump(DATA / "index.json", {"updated": updated, "current": index[-1]["id"],
                               "seasons": [{"id": s["id"], "label": s["label"]} for s in index]})
    n = sum(len(s["events"]) for s in index)
    c = sum(len(e.get("changes", [])) for s in index for e in s["events"])
    print(f"이관 완료: 시즌 {len(index)}개, 이벤트 {n}개, 수식 일치 확인, 정정 {c}건")


if __name__ == "__main__":
    main()
