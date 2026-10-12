"""python -m unittest discover -s tests"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import lib  # noqa: E402
import validate  # noqa: E402


class CalcTest(unittest.TestCase):
    def test_ratio_change_blank_or_zero(self):
        self.assertIsNone(lib.ratio_change(None, 1.0))
        self.assertIsNone(lib.ratio_change(1.0, None))
        self.assertIsNone(lib.ratio_change(1.0, 0))

    def test_ratio_change_matches_sheet(self):
        # 시트 Q2 AAPL: (109.42-108.65)/108.65
        self.assertAlmostEqual(lib.ratio_change(109.42, 108.65), 0.0070869765301426225, places=15)

    def test_ratio_change_negative_consensus(self):
        # 컨센 -0.10, 실적 -0.05 → 예상보다 덜 나빴으므로 +50%
        self.assertAlmostEqual(lib.ratio_change(-0.05, -0.10), 0.5)

    def test_margin(self):
        self.assertIsNone(lib.margin(None, 10))
        self.assertIsNone(lib.margin(1, 0))
        self.assertAlmostEqual(lib.margin(35.695, 109.42), 0.32622, places=5)


class ValidateTest(unittest.TestCase):
    """실제 데이터의 한 이벤트를 고쳐서 검증 규칙이 잡아내는지 확인"""

    def setUp(self):
        validate.errors.clear()
        validate.warnings.clear()
        self.companies = {c["ticker"]: c for c in lib.load("companies.json")["companies"]}
        self.q2 = {e["ticker"]: e for e in lib.load("seasons/2026Q2.json")["events"]}
        self.q3 = {e["ticker"]: e for e in lib.load("seasons/2026Q3.json")["events"]}

    def run_event(self, sid, e):
        validate.check_event(sid, e, self.companies[e["ticker"]], "2026-10-12")
        return list(validate.errors), list(validate.warnings)

    def test_real_data_is_clean(self):
        for sid, evs in (("2026Q2", self.q2), ("2026Q3", self.q3)):
            for e in evs.values():
                validate.check_event(sid, e, self.companies[e["ticker"]], "2026-10-12")
        self.assertEqual(validate.errors, [])
        self.assertEqual(validate.warnings, [])

    def test_gs_old_consensus_would_warn(self):
        e = copy.deepcopy(self.q2["GS"])
        e["metrics"]["revenue_consensus"] = {"value": 14.47}
        _, w = self.run_event("2026Q2", e)
        self.assertTrue(any("revenue_surprise" in x for x in w), w)

    def scheduled(self, t):
        """데이터가 갱신돼도 깨지지 않게, 미발표 상태로 만든 사본"""
        e = copy.deepcopy(self.q3[t])
        e["status"], e["stage"] = "scheduled", None
        e["metrics"] = {k: None for k in e["metrics"]}
        return e

    def test_scheduled_with_values_is_error(self):
        e = self.scheduled("JPM")
        e["metrics"]["revenue"] = {"value": 50.0}
        err, _ = self.run_event("2026Q3", e)
        self.assertTrue(any("미발표인데" in x for x in err), err)

    def test_percent_entered_as_whole_number_is_error(self):
        e = copy.deepcopy(self.q2["AAPL"])
        e["metrics"]["price_reaction"]["value"] = -8
        err, _ = self.run_event("2026Q2", e)
        self.assertTrue(any("소수로 저장" in x for x in err), err)

    def test_blank_value_needs_reason(self):
        e = copy.deepcopy(self.q2["005930"])
        e["metrics"]["price_reaction"] = {"value": None}
        err, _ = self.run_event("2026Q2", e)
        self.assertTrue(any("reason" in x for x in err), err)

    def test_bank_operating_income_is_error(self):
        e = copy.deepcopy(self.q2["JPM"])
        e["metrics"]["operating_income"] = {"value": 20.0}
        err, _ = self.run_event("2026Q2", e)
        self.assertTrue(any("영업이익 비적용" in x for x in err), err)

    def test_past_date_still_scheduled_warns(self):
        e = self.scheduled("JPM")
        e["announce"]["date"] = "2026-10-13"
        validate.check_event("2026Q3", e, self.companies["JPM"], "2026-10-14")
        self.assertTrue(any("입력대기" in x for x in validate.warnings), validate.warnings)

    def test_two_stage_needs_stage(self):
        e = copy.deepcopy(self.q3["005930"])
        e["stage"] = None
        err, _ = self.run_event("2026Q3", e)
        self.assertTrue(any("stage" in x for x in err), err)


if __name__ == "__main__":
    unittest.main()
