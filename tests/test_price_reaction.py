"""주가반응(종가 기준) 계산 규칙"""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import overdue  # noqa: E402
import price_reaction as pr  # noqa: E402

# 금요일 10/9, (월) 10/12 휴장 가정, 화 10/13, 수 10/14
BARS = [("2026-10-08", 100.0), ("2026-10-09", 102.0), ("2026-10-13", 99.96), ("2026-10-14", 110.0)]


class ComputeTest(unittest.TestCase):
    def test_bmo_uses_same_day_close(self):
        (v, base, react), _ = pr.compute(BARS, "2026-10-13", "bmo", "2026-10-15")
        self.assertEqual((base, react), ("2026-10-09", "2026-10-13"))
        self.assertAlmostEqual(v, -0.02)

    def test_amc_uses_next_trading_day(self):
        (v, base, react), _ = pr.compute(BARS, "2026-10-13", "amc", "2026-10-15")
        self.assertEqual((base, react), ("2026-10-13", "2026-10-14"))

    def test_holiday_announce_rolls_forward(self):
        (_, base, react), _ = pr.compute(BARS, "2026-10-12", "bmo", "2026-10-15")
        self.assertEqual((base, react), ("2026-10-09", "2026-10-13"))

    def test_waits_until_close_is_final(self):
        r, why = pr.compute(BARS, "2026-10-13", "amc", "2026-10-14")
        self.assertIsNone(r)
        self.assertIn("확정 전", why)

    def test_parse_uses_exchange_dates(self):
        # 서울 거래소(UTC+9): 09:00 KST = 00:00 UTC
        payload = {"chart": {"result": [{"meta": {"gmtoffset": 32400},
                                         "timestamp": [1791763200, 1791849600],
                                         "indicators": {"quote": [{"close": [100.0, None]}]}}]}}
        bars, today = pr.parse(payload, now=datetime(2026, 10, 12, 16, 0, tzinfo=timezone.utc))
        self.assertEqual(bars, [("2026-10-12", 100.0)])
        self.assertEqual(today, "2026-10-13")


class OverdueTest(unittest.TestCase):
    """실제 데이터가 바뀌어도 깨지지 않게 가짜 이벤트로 확인"""
    CO = {"BANK": {}, "LATE": {}, "KR": {"timing_default": "bmo"}}

    def ev(self, t, d, timing=None, status="scheduled"):
        return {"ticker": t, "status": status, "announce": {"date": d, "timing": timing}}

    def run_(self, today, evs):
        return [r[1] for r in overdue.overdue(datetime.fromisoformat(today).date(), {"S": evs}, self.CO)]

    def test_bmo_due_same_day(self):
        evs = [self.ev("BANK", "2026-10-13", "bmo")]
        self.assertEqual(self.run_("2026-10-13", evs), [])
        self.assertEqual(self.run_("2026-10-14", evs), ["BANK"])

    def test_amc_or_unknown_due_next_day(self):
        evs = [self.ev("LATE", "2026-10-13")]
        self.assertEqual(self.run_("2026-10-14", evs), [])
        self.assertEqual(self.run_("2026-10-15", evs), ["LATE"])

    def test_company_default_timing_and_reported(self):
        evs = [self.ev("KR", "2026-10-08"), self.ev("BANK", "2026-10-01", "bmo", "reported")]
        self.assertEqual(self.run_("2026-10-09", evs), ["KR"])


if __name__ == "__main__":
    unittest.main()
