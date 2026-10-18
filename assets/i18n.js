// 화면 문구 사전(한국어·영어·태국어)과 데이터 번역 해시.
// 데이터 문장(비고 등) 번역은 data/i18n/{en,th}.json — scripts/i18n.py가 관리한다.
(function (root) {
  // FNV-1a 32비트(UTF-16 단위). scripts/i18n.py의 fnv1a()와 같아야 한다.
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  const LANGS = [
    { id: 'ko', label: '한국어', locale: 'ko-KR' },
    { id: 'en', label: 'English', locale: 'en-US' },
    { id: 'th', label: 'ไทย', locale: 'th-TH' },
  ];

  const UI = {
    ko: {
      title: '어닝 트래커', kicker: '미국 · 한국 · 대만 · 유럽 주요 기업',
      season: '시즌', updated: '갱신', csv: 'CSV 내려받기',
      seasonSel: '시즌 선택', unitSel: '원화 단위', langSel: '언어',
      unitJo: '원화 조원', unitBil: '원화 십억원',
      progress: '발표 진행', ofCompanies: '/ {n}개사',
      revSurprise: '매출 서프라이즈', epsSurprise: 'EPS 서프라이즈', beat: '상회', miss: '하회',
      basedOn: '컨센서스가 있는 {n}개사 기준', epsNote: '지분평가이익 등 왜곡은 ※ 표시',
      nextTitle: '다음 발표 (미국 날짜)', noneLeft: '남은 발표 없음', then: '이후',
      overdueTitle: '발표일 지남 · 미입력', overdueNote: '실적 반영 차례', companies: '{n}개사',
      today: '오늘',
      tableTitle: '실적 비교', capDefault: '지역 → 섹터 순 · 행을 누르면 비고와 출처가 펼쳐집니다',
      capSorted: '정렬 중 — 같은 머리글을 다시 누르면 방향이 바뀌고, 세 번째에 원래 순서로 돌아갑니다',
      bandBasic: '기본 정보', bandRevenue: '매출', bandOp: '영업이익', bandEps: 'EPS', bandMarket: '시장',
      colCompany: '기업', colDate: '발표일', colPeriod: '회계기간', colActual: '실적', colCons: '컨센',
      colSurprise: '서프라이즈', colYoy: 'YoY', colMargin: '이익률', colReaction: '주가반응',
      sortBy: '{x} 정렬', na: '해당 없음',
      status: { scheduled: '미발표', reported: '발표완료', awaiting_input: '입력대기', needs_check: '확인필요' },
      stage: { preliminary: '잠정', final: '확정' },
      cert: { confirmed: '확정', verified: '확인', estimated: '추정' }, certTitle: '일정 확실도',
      timing: { bmo: '장 전', amc: '장 후', during: '장중' },
      pastDate: '발표일 지남', bkk: '방콕', or: '또는', finalExp: '확정 {x}',
      flag: { verified: '공식 확인', unverified: '출처 미확인', derived: '계산값', disputed: '출처 불일치' },
      flagShort: { unverified: '미확인', derived: '계산', disputed: '불일치' },
      basis: { GAAP: 'GAAP', 'non-GAAP': '비GAAP', IFRS: 'IFRS', after_hours: '시간외', intraday: '장중', close: '종가' },
      metric: { revenue: '매출', revenue_consensus: '매출 컨센', revenue_yoy: '매출 YoY', operating_income: '영업이익', eps: 'EPS', eps_consensus: 'EPS 컨센', price_reaction: '주가반응' },
      notesH: '비고 · 핵심 코멘트', noneYet: '아직 없음', schedH: '발표 일정', periodH: '회계기간',
      byRule: '회계 규칙으로 계산', metricsH: '지표별 기준·출처', changesH: '이관 시 정정', notesField: '비고',
      blankReason: '공란 사유: ', caution: '주의', altAgg: '다른 집계', schedCert: '일정 {x}',
      localToBkk: '현지 {t} → 방콕 {d} {t2}', otherDates: '다른 전망', finalResults: '확정실적',
      original: '한국어 원문', weakTitle: '입력값 중 출처 미확인 값이 있음',
      lgBeat: '상회(beat)', lgMiss: '하회(miss)', lgDerived: '공식 수치로 계산한 값', lgUnverified: '출처 미확인',
      lgDisputed: '출처 간 불일치', lgInfoA: '점선 밑줄', lgInfoB: '출처·기준 있음 (행을 펼치면 상세)', lgCaution: '※ 해석 주의(지분평가이익 등 회계 왜곡)',
      highlightsH: '시즌 메모',
      footer: [
        '<b>단위</b> · 매출·영업이익은 보고통화 기준(USD·EUR은 십억, 원화는 위 버튼으로 조원/십억원 선택). TSMC는 USD(ADR 환산) 기준. 통화가 다르면 절대값 대신 서프라이즈·YoY·영업이익률·주가반응(%)으로 비교합니다.',
        '<b>계산</b> · 서프라이즈 = (실적 − 컨센) ÷ |컨센|, 영업이익률 = 영업이익 ÷ 매출. 입력이 하나라도 비면 계산하지 않습니다. 은행(JPM·GS)은 영업이익 비적용.',
        '<b>주가반응</b> · 발표 후 첫 거래일 종가 ÷ 직전 거래일 종가 − 1(Yahoo Finance 종가로 매일 자동 반영, 2026-10-12부터). 그 전에 입력한 값은 미국 시간외·한국 장중 기준이며, 값마다 기준을 표시합니다. 같은 날 시장 전체가 급락했으면 비고에 적었습니다.',
        '<b>회계기간</b> · 마이크론·엔비디아·애플·마이크로소프트는 역년 분기와 기간이 달라 회계기간 아래에 날짜를 적었습니다(≈는 회계 규칙으로 계산한 날짜).',
        '<b>출처</b> · 각사 실적발표·IR·공시(10-Q, 8-K, DART 등)와 공개 보도. 컨센서스는 집계기관·기준일에 따라 다르며, 고른 값과 다른 집계값을 함께 남겼습니다. 특정 종목의 매수·매도를 권하는 자료가 아닙니다.',
      ],
      loadErr: '데이터를 불러오지 못했습니다 ({x}). 이 페이지는 웹 서버에서 열어야 합니다: 폴더에서 <code>python -m http.server</code> 실행 후 http://localhost:8000',
      csvHead: ['상태', '티커', '기업', '섹터', '발표일', '회계기간', '통화', '매출(십억)', '매출 컨센', '매출 서프라이즈', '매출 YoY', '영업이익(십억)', '영업이익률', 'EPS', 'EPS 컨센', 'EPS 서프라이즈', '주가반응', '비고'],
    },
    en: {
      title: 'Earnings Tracker', kicker: 'Major companies · US · Korea · Taiwan · Europe',
      season: 'Season', updated: 'Updated', csv: 'Download CSV',
      seasonSel: 'Select season', unitSel: 'KRW unit', langSel: 'Language',
      unitJo: 'KRW trillion', unitBil: 'KRW billion',
      progress: 'Reported', ofCompanies: '/ {n}',
      revSurprise: 'Revenue surprise', epsSurprise: 'EPS surprise', beat: 'beat', miss: 'miss',
      basedOn: 'Among {n} companies with consensus', epsNote: '※ marks distortions such as equity-investment gains',
      nextTitle: 'Next report (US date)', noneLeft: 'No upcoming reports', then: 'Then',
      overdueTitle: 'Past date · not entered', overdueNote: 'results to be entered', companies: v => (v.n === 1 ? '1 company' : `${v.n} companies`),
      today: 'Today',
      tableTitle: 'Results', capDefault: 'Ordered by region → sector · Click a row for notes and sources',
      capSorted: 'Sorted — click the same header to reverse; a third click restores the default order',
      bandBasic: 'Company', bandRevenue: 'Revenue', bandOp: 'Operating income', bandEps: 'EPS', bandMarket: 'Market',
      colCompany: 'Company', colDate: 'Report date', colPeriod: 'Fiscal period', colActual: 'Actual', colCons: 'Cons.',
      colSurprise: 'Surprise', colYoy: 'YoY', colMargin: 'Margin', colReaction: 'Reaction',
      sortBy: 'Sort by {x}', na: 'n/a',
      status: { scheduled: 'Upcoming', reported: 'Reported', awaiting_input: 'Awaiting input', needs_check: 'Needs check' },
      stage: { preliminary: 'Prelim.', final: 'Final' },
      cert: { confirmed: 'confirmed', verified: 'verified', estimated: 'estimated' }, certTitle: 'Schedule certainty',
      timing: { bmo: 'Pre-market', amc: 'After close', during: 'Intraday' },
      pastDate: 'Past date', bkk: 'Bangkok', or: 'or', finalExp: 'Final {x}',
      flag: { verified: 'Officially verified', unverified: 'Source unverified', derived: 'Derived', disputed: 'Sources disagree' },
      flagShort: { unverified: 'unverified', derived: 'calc', disputed: 'disputed' },
      basis: { GAAP: 'GAAP', 'non-GAAP': 'non-GAAP', IFRS: 'IFRS', after_hours: 'after-hours', intraday: 'intraday', close: 'close' },
      metric: { revenue: 'Revenue', revenue_consensus: 'Revenue cons.', revenue_yoy: 'Revenue YoY', operating_income: 'Operating income', eps: 'EPS', eps_consensus: 'EPS cons.', price_reaction: 'Price reaction' },
      notesH: 'Notes · key comments', noneYet: 'None yet', schedH: 'Report schedule', periodH: 'Fiscal period',
      byRule: 'computed from the fiscal calendar rule', metricsH: 'Basis & sources by metric', changesH: 'Corrections at migration', notesField: 'Notes',
      blankReason: 'Blank: ', caution: 'Caution', altAgg: 'Other estimate', schedCert: 'date {x}',
      localToBkk: 'local {t} → Bangkok {d} {t2}', otherDates: 'Other expected dates', finalResults: 'Final results',
      original: 'Korean original', weakTitle: 'Includes an input with an unverified source',
      lgBeat: 'Beat', lgMiss: 'Miss', lgDerived: 'Derived from official figures', lgUnverified: 'Source unverified',
      lgDisputed: 'Sources disagree', lgInfoA: 'Dotted underline', lgInfoB: 'has sources/basis (expand the row for details)', lgCaution: '※ Interpretation caution (e.g. equity-investment gains)',
      highlightsH: 'Season notes',
      footer: [
        '<b>Units</b> · Revenue and operating income are in the reporting currency (USD and EUR in billions; KRW in trillions or billions via the toggle above). TSMC is in USD (ADR-converted). Across currencies, compare percentages — surprise, YoY, operating margin and price reaction — not absolute amounts.',
        '<b>Calculations</b> · Surprise = (actual − consensus) ÷ |consensus|; operating margin = operating income ÷ revenue. Not calculated if any input is blank. Operating income does not apply to banks (JPM, GS).',
        '<b>Price reaction</b> · Close on the first trading day after the report ÷ previous close − 1 (filled daily from Yahoo Finance closing prices since 2026-10-12). Earlier entries use US after-hours / Korean intraday moves; each value shows its basis. If the whole market fell sharply the same day, it is noted.',
        '<b>Fiscal periods</b> · Micron, Nvidia, Apple and Microsoft do not follow calendar quarters, so their period dates are shown under the fiscal period (≈ means computed from the fiscal calendar rule).',
        '<b>Sources</b> · Company earnings releases, IR materials and filings (10-Q, 8-K, DART, etc.) and public reporting. Consensus varies by aggregator and date; the chosen value and other estimates are both kept. Not investment advice.',
      ],
      loadErr: 'Could not load data ({x}). Open this page from a web server: run <code>python -m http.server</code> in the folder, then http://localhost:8000',
      csvHead: ['Status', 'Ticker', 'Company', 'Sector', 'Report date', 'Fiscal period', 'Currency', 'Revenue (bn)', 'Revenue cons.', 'Revenue surprise', 'Revenue YoY', 'Operating income (bn)', 'Operating margin', 'EPS', 'EPS cons.', 'EPS surprise', 'Price reaction', 'Notes'],
    },
    th: {
      title: 'ติดตามผลประกอบการ', kicker: 'บริษัทชั้นนำ · สหรัฐฯ · เกาหลีใต้ · ไต้หวัน · ยุโรป',
      season: 'รอบ', updated: 'อัปเดต', csv: 'ดาวน์โหลด CSV',
      seasonSel: 'เลือกรอบ', unitSel: 'หน่วยเงินวอน', langSel: 'ภาษา',
      unitJo: 'วอน: ล้านล้าน', unitBil: 'วอน: พันล้าน',
      progress: 'ประกาศแล้ว', ofCompanies: '/ {n} บริษัท',
      revSurprise: 'เซอร์ไพรส์รายได้', epsSurprise: 'เซอร์ไพรส์ EPS', beat: 'สูงกว่าคาด', miss: 'ต่ำกว่าคาด',
      basedOn: 'จาก {n} บริษัทที่มีคอนเซนซัส', epsNote: '※ = มีปัจจัยบิดเบือน เช่น กำไรจากการตีมูลค่าเงินลงทุน',
      nextTitle: 'ประกาศถัดไป (วันที่สหรัฐฯ)', noneLeft: 'ไม่มีกำหนดประกาศที่เหลือ', then: 'ถัดไป',
      overdueTitle: 'เลยวันประกาศ · ยังไม่บันทึก', overdueNote: 'รอบันทึกผล', companies: '{n} บริษัท',
      today: 'วันนี้',
      tableTitle: 'เปรียบเทียบผลประกอบการ', capDefault: 'เรียงตามภูมิภาค → กลุ่มธุรกิจ · คลิกแถวเพื่อดูหมายเหตุและแหล่งที่มา',
      capSorted: 'กำลังเรียงลำดับ — คลิกหัวคอลัมน์เดิมเพื่อกลับทิศ ครั้งที่สามเพื่อกลับสู่ลำดับเดิม',
      bandBasic: 'ข้อมูลพื้นฐาน', bandRevenue: 'รายได้', bandOp: 'กำไรจากการดำเนินงาน', bandEps: 'EPS', bandMarket: 'ตลาด',
      colCompany: 'บริษัท', colDate: 'วันประกาศ', colPeriod: 'งวดบัญชี', colActual: 'จริง', colCons: 'คอนเซนซัส',
      colSurprise: 'เซอร์ไพรส์', colYoy: 'YoY', colMargin: 'อัตรากำไร', colReaction: 'ราคาหุ้น',
      sortBy: 'เรียงตาม {x}', na: 'ไม่มี',
      status: { scheduled: 'ยังไม่ประกาศ', reported: 'ประกาศแล้ว', awaiting_input: 'รอบันทึก', needs_check: 'ต้องตรวจสอบ' },
      stage: { preliminary: 'เบื้องต้น', final: 'ฉบับสมบูรณ์' },
      cert: { confirmed: 'ยืนยันแล้ว', verified: 'ตรวจสอบแล้ว', estimated: 'ประมาณการ' }, certTitle: 'ความแน่นอนของกำหนดการ',
      timing: { bmo: 'ก่อนตลาดเปิด', amc: 'หลังตลาดปิด', during: 'ระหว่างวัน' },
      pastDate: 'เลยวันประกาศ', bkk: 'กรุงเทพฯ', or: 'หรือ', finalExp: 'ฉบับสมบูรณ์ {x}',
      flag: { verified: 'ยืนยันจากแหล่งทางการ', unverified: 'ยังไม่ยืนยันแหล่งที่มา', derived: 'ค่าคำนวณ', disputed: 'แหล่งข้อมูลไม่ตรงกัน' },
      flagShort: { unverified: 'ยังไม่ยืนยัน', derived: 'คำนวณ', disputed: 'ไม่ตรงกัน' },
      basis: { GAAP: 'GAAP', 'non-GAAP': 'non-GAAP', IFRS: 'IFRS', after_hours: 'หลังตลาดปิด', intraday: 'ระหว่างวัน', close: 'ราคาปิด' },
      metric: { revenue: 'รายได้', revenue_consensus: 'คอนเซนซัสรายได้', revenue_yoy: 'รายได้ YoY', operating_income: 'กำไรจากการดำเนินงาน', eps: 'EPS', eps_consensus: 'คอนเซนซัส EPS', price_reaction: 'ราคาหุ้น' },
      notesH: 'หมายเหตุ · ประเด็นสำคัญ', noneYet: 'ยังไม่มี', schedH: 'กำหนดการประกาศ', periodH: 'งวดบัญชี',
      byRule: 'คำนวณจากปฏิทินบัญชี', metricsH: 'เกณฑ์และแหล่งที่มารายตัวชี้วัด', changesH: 'การแก้ไขตอนย้ายข้อมูล', notesField: 'หมายเหตุ',
      blankReason: 'เว้นว่างเพราะ: ', caution: 'ข้อควรระวัง', altAgg: 'ประมาณการอื่น', schedCert: 'กำหนดการ{x}',
      localToBkk: 'เวลาท้องถิ่น {t} → กรุงเทพฯ {d} {t2}', otherDates: 'วันที่คาดการณ์อื่น', finalResults: 'ผลฉบับสมบูรณ์',
      original: 'ต้นฉบับภาษาเกาหลี', weakTitle: 'มีข้อมูลที่ยังไม่ยืนยันแหล่งที่มา',
      lgBeat: 'สูงกว่าคาด', lgMiss: 'ต่ำกว่าคาด', lgDerived: 'คำนวณจากตัวเลขทางการ', lgUnverified: 'ยังไม่ยืนยันแหล่งที่มา',
      lgDisputed: 'แหล่งข้อมูลไม่ตรงกัน', lgInfoA: 'เส้นประใต้ตัวเลข', lgInfoB: 'มีแหล่งที่มา/เกณฑ์ (คลิกแถวเพื่อดูรายละเอียด)', lgCaution: '※ ข้อควรระวังในการตีความ (เช่น กำไรจากการตีมูลค่าเงินลงทุน)',
      highlightsH: 'บันทึกประจำรอบ',
      footer: [
        '<b>หน่วย</b> · รายได้และกำไรจากการดำเนินงานเป็นสกุลเงินที่รายงาน (USD และ EUR เป็นพันล้าน วอนเลือกล้านล้านหรือพันล้านได้จากปุ่มด้านบน) TSMC เป็น USD (แปลงตามเกณฑ์ ADR) เมื่อสกุลเงินต่างกัน ให้เปรียบเทียบด้วยร้อยละ — เซอร์ไพรส์ YoY อัตรากำไรจากการดำเนินงาน และราคาหุ้น — ไม่ใช่มูลค่าสัมบูรณ์',
        '<b>การคำนวณ</b> · เซอร์ไพรส์ = (จริง − คอนเซนซัส) ÷ |คอนเซนซัส| อัตรากำไรจากการดำเนินงาน = กำไรจากการดำเนินงาน ÷ รายได้ ไม่คำนวณหากข้อมูลใดว่าง กำไรจากการดำเนินงานไม่ใช้กับธนาคาร (JPM, GS)',
        '<b>ราคาหุ้น</b> · ราคาปิดวันทำการแรกหลังประกาศ ÷ ราคาปิดวันทำการก่อนหน้า − 1 (บันทึกอัตโนมัติทุกวันจากราคาปิดของ Yahoo Finance ตั้งแต่ 2026-10-12) ค่าที่บันทึกก่อนหน้านั้นใช้ราคาหลังตลาดปิดของสหรัฐฯ / ราคาระหว่างวันของเกาหลี และแสดงเกณฑ์ไว้ทุกค่า หากตลาดทั้งหมดร่วงหนักในวันเดียวกันจะระบุไว้ในหมายเหตุ',
        '<b>งวดบัญชี</b> · Micron, Nvidia, Apple และ Microsoft มีงวดบัญชีไม่ตรงกับไตรมาสปฏิทิน จึงแสดงวันที่ไว้ใต้งวดบัญชี (≈ คือวันที่คำนวณจากปฏิทินบัญชี)',
        '<b>แหล่งที่มา</b> · ประกาศผลประกอบการ เอกสาร IR และเอกสารที่ยื่นต่อหน่วยงาน (10-Q, 8-K, DART ฯลฯ) และข่าวสาธารณะ คอนเซนซัสแตกต่างตามผู้รวบรวมและวันที่ จึงเก็บทั้งค่าที่เลือกและประมาณการอื่นไว้ ไม่ใช่คำแนะนำการลงทุน',
      ],
      loadErr: 'โหลดข้อมูลไม่ได้ ({x}) ต้องเปิดหน้านี้ผ่านเว็บเซิร์ฟเวอร์: รัน <code>python -m http.server</code> ในโฟลเดอร์ แล้วเปิด http://localhost:8000',
      csvHead: ['สถานะ', 'ตัวย่อ', 'บริษัท', 'กลุ่มธุรกิจ', 'วันประกาศ', 'งวดบัญชี', 'สกุลเงิน', 'รายได้ (พันล้าน)', 'คอนเซนซัสรายได้', 'เซอร์ไพรส์รายได้', 'รายได้ YoY', 'กำไรจากการดำเนินงาน (พันล้าน)', 'อัตรากำไรจากการดำเนินงาน', 'EPS', 'คอนเซนซัส EPS', 'เซอร์ไพรส์ EPS', 'ราคาหุ้น', 'หมายเหตุ'],
    },
  };

  // 지역·섹터 이름 (원문은 companies.json의 한국어)
  const REGION = {
    US: { en: 'United States', th: 'สหรัฐฯ' }, KR: { en: 'South Korea', th: 'เกาหลีใต้' },
    TW: { en: 'Taiwan', th: 'ไต้หวัน' }, NL: { en: 'Europe · Netherlands', th: 'ยุโรป · เนเธอร์แลนด์' },
  };
  const SECTOR = {
    '빅테크': { en: 'Big Tech', th: 'บิ๊กเทค' },
    '반도체(메모리)': { en: 'Semiconductors (memory)', th: 'เซมิคอนดักเตอร์ (หน่วยความจำ)' },
    '반도체(GPU/AI가속기)': { en: 'Semiconductors (GPU/AI accelerators)', th: 'เซมิคอนดักเตอร์ (GPU/ตัวเร่ง AI)' },
    '은행': { en: 'Banks', th: 'ธนาคาร' },
    '스트리밍': { en: 'Streaming', th: 'สตรีมมิง' },
    '자동차/AI': { en: 'Autos/AI', th: 'ยานยนต์/AI' },
    '반도체/전자': { en: 'Semiconductors/Electronics', th: 'เซมิคอนดักเตอร์/อิเล็กทรอนิกส์' },
    '반도체(파운드리)': { en: 'Semiconductors (foundry)', th: 'เซมิคอนดักเตอร์ (รับจ้างผลิตชิป)' },
    '반도체(장비)': { en: 'Semiconductors (equipment)', th: 'เซมิคอนดักเตอร์ (อุปกรณ์)' },
  };

  // 화면 개편(카드·비교 차트·상세 시트) 문구
  Object.assign(UI.ko, {
    secUpcoming: '다가오는 발표', secCompare: '한눈에 비교', secResults: '기업별 실적', secNotes: '시즌 메모',
    mYoy: '매출 YoY', mMargin: '영업이익률', mReaction: '주가반응',
    fAll: '전체', fRegion: '지역', fStatus: '상태', fReported: '발표완료', fUpcoming: '발표 예정',
    sortLabel: '정렬', sortDefault: '기본 순서', viewCards: '카드', viewTable: '표', viewSel: '보기',
    cardOp: '영업이익', marginShort: '이익률', consShort: '컨센', details: '자세히', close: '닫기',
    notYet: '아직 발표 전', noneMatch: '조건에 맞는 기업이 없습니다', moreUpcoming: '{n}개 날짜 더 보기', lessUpcoming: '접기',
    cmpEmpty: '아직 비교할 값이 없습니다', cmpMissing: '{n}개사는 값이 없어 빠졌습니다',
    cmpCap: '막대는 ±{cap}까지 그렸습니다. 넘는 값은 ≫ 표시', cmpCapPos: '막대는 {cap}까지 그렸습니다',
    overCap: '범위 초과', methodology: '기준·출처', settings: '설정', reportedOf: '발표완료 {a} · 예정 {b}',
    beatRate: '{n}개사 중 상회 {b}', keyFigures: '핵심 수치', openDetail: '{x} 자세히 보기',
    disclaimer: '특정 종목의 매수·매도를 권하는 자료가 아닙니다.',
  });
  Object.assign(UI.en, {
    secUpcoming: 'Upcoming reports', secCompare: 'At a glance', secResults: 'Results by company', secNotes: 'Season notes',
    mYoy: 'Revenue YoY', mMargin: 'Operating margin', mReaction: 'Price reaction',
    fAll: 'All', fRegion: 'Region', fStatus: 'Status', fReported: 'Reported', fUpcoming: 'Upcoming',
    sortLabel: 'Sort', sortDefault: 'Default order', viewCards: 'Cards', viewTable: 'Table', viewSel: 'View',
    cardOp: 'Op. income', marginShort: 'Margin', consShort: 'Cons.', details: 'Details', close: 'Close',
    notYet: 'Not reported yet', noneMatch: 'No companies match these filters', moreUpcoming: 'Show {n} more dates', lessUpcoming: 'Show less',
    cmpEmpty: 'Nothing to compare yet', cmpMissing: '{n} companies left out (no value)',
    cmpCap: 'Bars drawn up to ±{cap}; ≫ marks values beyond', cmpCapPos: 'Bars drawn up to {cap}',
    overCap: 'beyond range', methodology: 'Methodology & sources', settings: 'Settings', reportedOf: '{a} reported · {b} upcoming',
    beatRate: '{b} of {n} beat', keyFigures: 'Key figures', openDetail: 'Open details for {x}',
    disclaimer: 'Not investment advice.',
  });
  Object.assign(UI.th, {
    secUpcoming: 'กำหนดประกาศที่จะถึง', secCompare: 'เปรียบเทียบภาพรวม', secResults: 'ผลประกอบการรายบริษัท', secNotes: 'บันทึกประจำรอบ',
    mYoy: 'รายได้ YoY', mMargin: 'อัตรากำไรจากการดำเนินงาน', mReaction: 'ราคาหุ้น',
    fAll: 'ทั้งหมด', fRegion: 'ภูมิภาค', fStatus: 'สถานะ', fReported: 'ประกาศแล้ว', fUpcoming: 'กำลังจะประกาศ',
    sortLabel: 'เรียงตาม', sortDefault: 'ลำดับเริ่มต้น', viewCards: 'การ์ด', viewTable: 'ตาราง', viewSel: 'มุมมอง',
    cardOp: 'กำไรดำเนินงาน', marginShort: 'อัตรากำไร', consShort: 'คาดการณ์', details: 'รายละเอียด', close: 'ปิด',
    notYet: 'ยังไม่ประกาศ', noneMatch: 'ไม่มีบริษัทที่ตรงเงื่อนไข', moreUpcoming: 'ดูเพิ่มอีก {n} วัน', lessUpcoming: 'ย่อ',
    cmpEmpty: 'ยังไม่มีข้อมูลให้เปรียบเทียบ', cmpMissing: 'ไม่แสดง {n} บริษัทเพราะไม่มีข้อมูล',
    cmpCap: 'แท่งแสดงถึง ±{cap} ค่าที่เกินมีเครื่องหมาย ≫', cmpCapPos: 'แท่งแสดงถึง {cap}',
    overCap: 'เกินช่วง', methodology: 'เกณฑ์และแหล่งที่มา', settings: 'ตั้งค่า', reportedOf: 'ประกาศแล้ว {a} · กำลังจะประกาศ {b}',
    beatRate: 'สูงกว่าคาด {b} จาก {n} บริษัท', keyFigures: 'ตัวเลขสำคัญ', openDetail: 'ดูรายละเอียด {x}',
    disclaimer: 'ไม่ใช่คำแนะนำการลงทุน',
  });

  const api = { hash, LANGS, UI, REGION, SECTOR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(this);
