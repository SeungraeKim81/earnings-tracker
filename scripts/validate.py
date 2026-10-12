"""data/*.json 검증. 오류가 있으면 종료 코드 1.

    python scripts/validate.py            # 오류·경고·검증 표시 요약
    python scripts/validate.py --today 2026-10-14   # '오늘' 기준일 지정(일정 경과 경고용)

오류: 구조·형식이 틀려 화면이 잘못 그려질 수 있는 것
경고: 형식은 맞지만 사람이 확인해야 할 것(입력 누락 의심, 이상치 등)
"""
import argparse
import re
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

from lib import (BASIS, CERTAINTY, FLAGS, METRICS, REACTION_BASIS, STAGES, STATUS_KO, TIMING,
                 DATA, derived, load)

ISO = re.compile(r"\d{4}-\d{2}-\d{2}")
CURRENCIES = {"USD", "KRW", "EUR"}
SURPRISE_WARN = 0.3      # 서프라이즈 ±30% 넘으면 오기 의심 (메모나 표시가 있으면 생략)

errors, warnings = [], []


def is_date(s):
    if not isinstance(s, str) or not ISO.fullmatch(s):
        return False
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def check_metric(where, key, m, company):
    if m is None:
        return
    if not isinstance(m, dict) or "value" not in m:
        errors.append(f"{where} {key}: value 필드가 없음")
        return
    v = m["value"]
    if v is not None and not is_num(v):
        errors.append(f"{where} {key}: 숫자가 아님 {v!r}")
    if v is None and not m.get("reason"):
        errors.append(f"{where} {key}: 값이 비었으면 reason(사유)을 적어야 함")
    if "sheet_value" in m and not m.get("reason"):
        errors.append(f"{where} {key}: 시트 값을 바꿨으면 reason 필요")
    if m.get("flag") is not None and m["flag"] not in FLAGS:
        errors.append(f"{where} {key}: flag '{m['flag']}' 허용 안 됨 {sorted(FLAGS)}")
    if m.get("basis") is not None:
        allowed = REACTION_BASIS if key == "price_reaction" else BASIS
        if m["basis"] not in allowed:
            errors.append(f"{where} {key}: basis '{m['basis']}' 허용 안 됨 {sorted(allowed)}")
    for a in m.get("alts", []):
        if not a.get("provider") or not is_num(a.get("value")):
            errors.append(f"{where} {key}: alts 항목은 provider와 숫자 value 필요")
    for s in m.get("src", []):
        if not s.get("title") or not str(s.get("url", "")).startswith("http"):
            errors.append(f"{where} {key}: src 항목은 title과 http url 필요")
        if "asOf" in s and not is_date(s["asOf"]):
            errors.append(f"{where} {key}: src asOf 날짜 형식 오류")
    for f in ("note", "caution", "reason", "alts_note"):
        if f in m and not isinstance(m[f], str):
            errors.append(f"{where} {key}: {f}는 문자열이어야 함")
    if "window" in m and not (isinstance(m["window"], list) and len(m["window"]) == 2
                              and all(is_date(d) for d in m["window"]) and m["window"][0] < m["window"][1]):
        errors.append(f"{where} {key}: window는 [기준일, 반응일] 날짜 두 개")
    if "asOf" in m and not is_date(m["asOf"]):
        errors.append(f"{where} {key}: asOf 날짜 형식 오류")
    if key == "price_reaction" and is_num(v) and abs(v) >= 1:
        errors.append(f"{where} {key}: {v} — %가 아니라 소수로 저장(−8% → -0.08)")
    if key == "operating_income" and v is not None and company.get("operating_income") is False:
        errors.append(f"{where} 영업이익 비적용 회사인데 값이 있음")


def check_event(sid, e, company, today):
    t = e.get("ticker")
    where = f"{sid} {t}"
    st = e.get("status")
    if st not in STATUS_KO:
        errors.append(f"{where}: status '{st}' 허용 안 됨 {sorted(STATUS_KO)}")
    if e.get("stage") is not None and e["stage"] not in STAGES:
        errors.append(f"{where}: stage '{e['stage']}' 허용 안 됨")
    if company.get("two_stage") and st == "reported" and e.get("stage") is None:
        errors.append(f"{where}: 잠정/확정 2단계 회사는 stage 필요")
    if e.get("currency") != company["currency"]:
        errors.append(f"{where}: 통화 {e.get('currency')} ≠ 회사 기본 {company['currency']}")
    p = e.get("period") or {}
    if not (is_date(p.get("start")) and is_date(p.get("end")) and p["start"] < p["end"]):
        errors.append(f"{where}: period start/end 날짜 오류 {p}")
    a = e.get("announce") or {}
    if not is_date(a.get("date")):
        errors.append(f"{where}: 발표일 형식 오류 {a.get('date')!r}")
    if a.get("certainty") not in CERTAINTY:
        errors.append(f"{where}: 일정 확실도 '{a.get('certainty')}' 허용 안 됨 {sorted(CERTAINTY)}")
    if a.get("timing") is not None and a["timing"] not in TIMING:
        errors.append(f"{where}: 발표 시점 '{a['timing']}' 허용 안 됨 {sorted(TIMING)}")
    for d in a.get("alt_dates", []):
        if not is_date(d):
            errors.append(f"{where}: alt_dates 형식 오류 {d!r}")

    ms = e.get("metrics") or {}
    if set(ms) != set(METRICS):
        errors.append(f"{where}: metrics 키가 다름 (빠짐 {sorted(set(METRICS) - set(ms))}, 남음 {sorted(set(ms) - set(METRICS))})")
    for k in METRICS:
        check_metric(where, k, ms.get(k), company)

    has_values = any((ms.get(k) or {}).get("value") is not None for k in METRICS)
    if st == "scheduled" and has_values:
        errors.append(f"{where}: 미발표인데 수치가 있음 — 상태를 발표완료로 바꿨는지 확인")
    if st == "reported" and (ms.get("revenue") or {}).get("value") is None:
        warnings.append(f"{where}: 발표완료인데 매출 없음")
    if st == "scheduled" and is_date(a.get("date")) and a["date"] < today:
        warnings.append(f"{where}: 발표일 {a['date']}이 지났는데 미발표 — 입력대기로 바꿀 차례")

    d = derived(ms)
    for k, mk in (("revenue_surprise", "revenue_consensus"), ("eps_surprise", "eps_consensus")):
        x = d[k]
        base = ms.get(mk) or {}
        act = ms.get("revenue" if k == "revenue_surprise" else "eps") or {}
        # 해석 메모가 있거나 이미 의심 표시된 값이면 생략. 실적이 공식 확인(verified)이어도 컨센이 틀릴 수 있어 생략하지 않는다
        noted = any(m.get("caution") or m.get("note") or m.get("flag") in ("derived", "unverified", "disputed") for m in (base, act))
        if x is not None and abs(x) > SURPRISE_WARN and not noted:
            warnings.append(f"{where}: {k} {x:+.1%} — 오기 의심(정상이면 해당 지표에 caution이나 note를 남길 것)")
    if d["op_margin"] is not None and not (-1 < d["op_margin"] < 1):
        errors.append(f"{where}: 영업이익률 {d['op_margin']:.1%} — 단위 확인")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", help="기준일 YYYY-MM-DD (기본: 방콕 오늘)")
    args = ap.parse_args()
    today = args.today or datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()

    comp = load("companies.json")
    regions = {r["id"] for r in comp["regions"]}
    companies = {}
    for c in comp["companies"]:
        if c["ticker"] in companies:
            errors.append(f"companies: 티커 중복 {c['ticker']}")
        companies[c["ticker"]] = c
        if c["region"] not in regions:
            errors.append(f"companies {c['ticker']}: 지역 '{c['region']}' 없음")
        if c["currency"] not in CURRENCIES:
            errors.append(f"companies {c['ticker']}: 통화 '{c['currency']}' 허용 안 됨")
        if not c["fiscal"].get("calendar") and not c["fiscal"].get("rule"):
            errors.append(f"companies {c['ticker']}: 역년이 아니면 fiscal.rule 설명 필요")
    orders = [c["order"] for c in comp["companies"]]
    if len(set(orders)) != len(orders):
        errors.append("companies: order 중복")

    index = load("index.json")
    ids = [s["id"] for s in index["seasons"]]
    if index["current"] not in ids:
        errors.append(f"index: current '{index['current']}'가 시즌 목록에 없음")

    flagged = []
    for sid in ids:
        s = load(f"seasons/{sid}.json")
        if s["id"] != sid:
            errors.append(f"{sid}: 파일 안 id '{s['id']}' 불일치")
        seen = []
        for e in s["events"]:
            t = e.get("ticker")
            if t not in companies:
                errors.append(f"{sid}: 모르는 티커 {t}")
                continue
            seen.append(t)
            check_event(sid, e, companies[t], today)
            for k in METRICS:
                m = e["metrics"].get(k) or {}
                if m.get("flag") in ("unverified", "derived", "disputed"):
                    flagged.append(f"{sid} {t} {k}: {m['flag']}")
        dup = {t for t in seen if seen.count(t) > 1}
        if dup:
            errors.append(f"{sid}: 같은 회사가 두 번 {sorted(dup)}")
        if set(seen) != set(companies):
            warnings.append(f"{sid}: 빠진 회사 {sorted(set(companies) - set(seen))}")

    import i18n
    for lang in i18n.LANGS:
        missing, stale, _ = i18n.state(lang)
        if missing or stale:
            warnings.append(f"번역 {lang}: 없음 {len(missing)} · 오래됨 {len(stale)} — python scripts/i18n.py export {lang}")

    for title, items in (("오류", errors), ("경고", warnings), ("검증 표시(unverified/derived/disputed)", flagged)):
        print(f"{title} {len(items)}건")
        for i in items:
            print("  - " + i)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
