"""발표가 지났는데 아직 반영되지 않은 이벤트를 마크다운으로 출력(없으면 아무것도 출력하지 않음).

    python scripts/overdue.py [--today YYYY-MM-DD]

기준(방콕 날짜): 장 후(amc) 발표는 발표일 다음 날, 그 밖은 발표일 당일까지 반영돼야 한다.
발표 시점이 없는 미국 기업은 장 후로 본다(늦게 잡아 오탐을 줄임).
GitHub Actions(daily.yml)가 이 출력으로 '실적 미입력' 이슈를 연다 — Claude 루틴이 실패했을 때의 안전망.
"""
import argparse
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from lib import STATUS_KO, load


def overdue(today, seasons=None, companies=None):
    """seasons: {시즌 id: 이벤트 목록} (테스트용, 기본은 data/)"""
    if companies is None:
        companies = {c["ticker"]: c for c in load("companies.json")["companies"]}
    if seasons is None:
        seasons = {s["id"]: load(f"seasons/{s['id']}.json")["events"] for s in load("index.json")["seasons"]}
    out = []
    for sid, events in seasons.items():
        for e in events:
            if e["status"] == "reported":
                continue
            a = e["announce"]
            timing = a.get("timing") or companies[e["ticker"]].get("timing_default") or "amc"
            due = date.fromisoformat(a["date"]) + timedelta(days=1 if timing == "amc" else 0)
            if today > due:
                out.append((sid, e["ticker"], a["date"], timing, STATUS_KO[e["status"]]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today")
    args = ap.parse_args()
    today = date.fromisoformat(args.today) if args.today else datetime.now(ZoneInfo("Asia/Bangkok")).date()
    rows = overdue(today)
    if not rows:
        return
    print(f"방콕 {today} 기준, 발표가 지났는데 반영되지 않은 이벤트 {len(rows)}건입니다.\n")
    print("| 시즌 | 티커 | 발표일(미국 날짜) | 발표 시점 | 상태 |\n|---|---|---|---|---|")
    for r in rows:
        print("| " + " | ".join(r) + " |")
    print("\nClaude 루틴이 다음 실행 때 반영하지 못하면, Claude Code에서 \"실적 반영해줘\"라고 지시하세요. 반영되면 이 이슈를 닫아도 됩니다.")


if __name__ == "__main__":
    main()
