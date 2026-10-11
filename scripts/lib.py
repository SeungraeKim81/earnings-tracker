"""공통 정의와 계산 규칙. 표준 라이브러리만 사용.

계산 필드(서프라이즈·영업이익률)는 저장하지 않고 여기서 계산한다.
화면(app.js)도 같은 규칙을 써야 하며, tests/test_lib.py가 시트 수식과의 일치를 확인한다.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# 시트 '상태' 열 → 저장 값
STATUS = {"미발표": "scheduled", "발표완료": "reported", "입력대기": "awaiting_input", "확인필요": "needs_check"}
STATUS_KO = {v: k for k, v in STATUS.items()}

METRICS = ["revenue", "revenue_consensus", "revenue_yoy", "operating_income",
           "eps", "eps_consensus", "price_reaction"]
# 시트 열 → 지표
SHEET_COLS = {"H": "revenue", "I": "revenue_consensus", "K": "revenue_yoy", "L": "operating_income",
              "N": "eps", "O": "eps_consensus", "Q": "price_reaction"}

STAGES = {"preliminary", "final"}            # 한국 기업 잠정 / 확정
CERTAINTY = {"confirmed", "verified", "estimated"}   # 확정(8-K 등 공시) / 확인(캘린더) / 추정
TIMING = {"bmo", "amc", "during"}            # 장 전 / 장 후 / 장중
FLAGS = {"verified", "unverified", "derived", "disputed"}
BASIS = {"GAAP", "non-GAAP", "IFRS"}
REACTION_BASIS = {"after_hours", "intraday", "close"}


def val(metrics, key):
    m = metrics.get(key)
    return None if m is None else m.get("value")


def ratio_change(actual, base):
    """(실적 - 기준) / |기준|. 하나라도 비었거나 기준이 0이면 None (시트: 공란).

    시트 수식은 분모에 부호를 그대로 쓰지만, 컨센서스가 음수일 때 방향이 뒤집히지 않도록 절대값을 쓴다.
    현재 데이터에는 음수 컨센서스가 없어 시트 결과와 같다.
    """
    if actual is None or base is None or base == 0:
        return None
    return (actual - base) / abs(base)


def margin(op_income, revenue):
    """영업이익 / 매출. 하나라도 비었거나 매출이 0이면 None."""
    if op_income is None or revenue is None or revenue == 0:
        return None
    return op_income / revenue


def derived(metrics):
    return {
        "revenue_surprise": ratio_change(val(metrics, "revenue"), val(metrics, "revenue_consensus")),
        "eps_surprise": ratio_change(val(metrics, "eps"), val(metrics, "eps_consensus")),
        "op_margin": margin(val(metrics, "operating_income"), val(metrics, "revenue")),
    }


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def dump(path, obj):
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
