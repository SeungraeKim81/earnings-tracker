// 계산 필드. scripts/lib.py와 같은 규칙 — tests/test_calc_parity.py가 두 쪽 결과를 비교한다.
// 입력이 하나라도 비었거나 분모가 0이면 null(시트: 공란). 컨센서스가 음수면 분모에 절대값.
(function (root) {
  const ratioChange = (a, b) => (a == null || b == null || b === 0 ? null : (a - b) / Math.abs(b));
  const margin = (op, rev) => (op == null || rev == null || rev === 0 ? null : op / rev);
  const val = (ms, k) => (ms[k] ? ms[k].value : null);
  const derived = ms => ({
    revenue_surprise: ratioChange(val(ms, 'revenue'), val(ms, 'revenue_consensus')),
    eps_surprise: ratioChange(val(ms, 'eps'), val(ms, 'eps_consensus')),
    op_margin: margin(val(ms, 'operating_income'), val(ms, 'revenue')),
  });
  const api = { ratioChange, margin, derived };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
