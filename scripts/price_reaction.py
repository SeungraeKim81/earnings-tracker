"""주가반응 자동 수집: 발표 후 첫 거래일 종가 ÷ 직전 거래일 종가 − 1 (Yahoo Finance 일별 종가)

    python scripts/price_reaction.py            # 무엇을 채울지 보여 주기만
    python scripts/price_reaction.py --write    # data/seasons/*.json에 반영

대상: status가 reported인데 주가반응 값이 비어 있는 이벤트. 이미 값이 있으면(예전 시간외·장중 기준 포함) 건드리지 않는다.
첫 거래일: 발표 시점이 장 후(amc)면 발표일 다음 거래일, 그 밖(장 전·장중)이면 발표일 당일(휴장이면 그다음 거래일).
발표 시점은 이벤트 announce.timing, 없으면 회사 timing_default. 둘 다 없으면 건너뛴다.
그날 종가가 확정된 뒤(거래소 현지 날짜로 다음 날부터)에만 채운다.
GitHub Actions(.github/workflows/daily.yml)에서 매일 실행된다 — Claude 세션 환경에서는 Yahoo 접속이 막혀 있다.
"""
import argparse
import json
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from lib import DATA, dump, load

UA = "Mozilla/5.0 (compatible; earnings-tracker/1.0)"


def fetch(symbol, start, end):
    """[(거래소 현지 날짜 'YYYY-MM-DD', 종가)], 거래소 현지 오늘 날짜"""
    p1 = int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp())
    p2 = int(datetime(end.year, end.month, end.day, tzinfo=timezone.utc).timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={p1}&period2={p2}&interval=1d"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20) as r:
        return parse(json.loads(r.read().decode("utf-8")))


def parse(payload, now=None):
    res = payload["chart"]["result"][0]
    off = res["meta"].get("gmtoffset", 0)
    closes = res["indicators"]["quote"][0].get("close", [])
    bars = []
    for ts, c in zip(res.get("timestamp", []), closes):
        if c is None:
            continue
        d = datetime.fromtimestamp(ts + off, tz=timezone.utc).date().isoformat()
        bars.append((d, c))
    now = now or datetime.now(timezone.utc)
    today = (now + timedelta(seconds=off)).date().isoformat()
    return bars, today


def compute(bars, announce_date, timing, today):
    """(반응률, 기준일, 반응일) 또는 (None, 사유)"""
    days = [d for d, _ in bars]
    after = [d for d in days if (d > announce_date if timing == "amc" else d >= announce_date)]
    if not after:
        return None, "발표 후 거래일 종가가 아직 없음"
    react = after[0]
    if react >= today:
        return None, f"{react} 종가 확정 전"
    before = [d for d in days if d < react]
    if not before:
        return None, "직전 거래일 종가 없음(조회 기간 확인)"
    base = before[-1]
    px = dict(bars)
    return (px[react] / px[base] - 1, base, react), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    companies = {c["ticker"]: c for c in load("companies.json")["companies"]}
    today_bkk = datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()
    filled, skipped = [], []
    for s in load("index.json")["seasons"]:
        sid = s["id"]
        season = load(f"seasons/{sid}.json")
        changed = False
        for e in season["events"]:
            m = e["metrics"].get("price_reaction")
            if e["status"] != "reported" or (m and m.get("value") is not None):
                continue
            c = companies[e["ticker"]]
            timing = e["announce"].get("timing") or c.get("timing_default")
            where = f"{sid} {e['ticker']}"
            if not timing:
                skipped.append(f"{where}: 발표 시점(announce.timing) 없음")
                continue
            d = date.fromisoformat(e["announce"]["date"])
            try:
                bars, today = fetch(c["yahoo"], d - timedelta(days=12), d + timedelta(days=12))
            except Exception as ex:  # 네트워크·형식 오류는 다음 실행에 다시 시도
                skipped.append(f"{where}: Yahoo 조회 실패 ({ex})")
                continue
            r, why = compute(bars, e["announce"]["date"], timing, today)
            if r is None:
                skipped.append(f"{where}: {why}")
                continue
            v, base, react = r
            new = {"value": round(v, 4), "basis": "close", "provider": "Yahoo Finance", "window": [base, react],
                   "src": [{"title": f"Yahoo Finance daily close ({c['yahoo']})",
                            "url": f"https://finance.yahoo.com/quote/{c['yahoo']}/history"}]}
            for k in ("note", "caution"):
                if m and m.get(k):
                    new[k] = m[k]
            e["metrics"]["price_reaction"] = new
            filled.append(f"{where}: {v:+.2%} ({base} → {react} 종가)")
            changed = True
        if changed and args.write:
            season["updated"] = today_bkk
            dump(DATA / "seasons" / f"{sid}.json", season)

    print(f"채움 {len(filled)}건" + ("" if args.write else " (미반영 — --write로 저장)"))
    for x in filled:
        print("  + " + x)
    print(f"건너뜀 {len(skipped)}건")
    for x in skipped:
        print("  - " + x)


if __name__ == "__main__":
    sys.exit(main())
