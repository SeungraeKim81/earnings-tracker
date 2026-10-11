// 어닝 트래커 화면. data/*.json을 읽어 시즌 비교표를 그린다.
'use strict';
const $ = id => document.getElementById(id);
const TZ_VIEW = 'Asia/Bangkok';
const ST = { index: null, companies: null, regions: null, seasons: {}, sid: null, unit: 'jo', sort: null, open: new Set() };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
};

// ---------- 표기 ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
const pct = (v, d = 1) => sign(v) + Math.abs(v * 100).toFixed(d) + '%';
const num = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const SYM = { USD: '$', EUR: '€' };
function money(v, cur) {                       // 매출·영업이익 (십억 단위 저장)
  if (cur === 'KRW') return ST.unit === 'jo' ? num(v / 1000, 1) + '조' : num(v, 1);
  return sign(v).replace('+', '') + SYM[cur] + num(Math.abs(v), 2) + 'B';
}
function eps(v, cur) {
  if (cur === 'KRW') return num(v, 0) + '원';
  return sign(v).replace('+', '') + SYM[cur] + num(Math.abs(v), 2);
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(iso, withYear) {
  const [y, m, d] = iso.split('-').map(Number);
  const w = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withYear ? y + '.' : ''}${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${w})`;
}
const shortDate = iso => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
function todayIn(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
// 현지 시각(tz) → 방콕 시각
function tzOffset(ts, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - ts;
}
function toView(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const utc = guess - tzOffset(guess, tz);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ_VIEW, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(utc)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const STATUS = { scheduled: '미발표', reported: '발표완료', awaiting_input: '입력대기', needs_check: '확인필요' };
const STAGE = { preliminary: '잠정', final: '확정' };
const CERT = { confirmed: '확정', verified: '확인', estimated: '추정' };
const TIMING = { bmo: '장 전', amc: '장 후', during: '장중' };
const FLAG = { verified: '공식 확인', unverified: '출처 미확인', derived: '계산값', disputed: '출처 불일치' };
const FLAG_SHORT = { unverified: '미확인', derived: '계산', disputed: '불일치' };
const BASIS = { GAAP: 'GAAP', 'non-GAAP': '비GAAP', IFRS: 'IFRS', after_hours: '시간외', intraday: '장중', close: '종가' };
const MLABEL = { revenue: '매출', revenue_consensus: '매출 컨센', revenue_yoy: '매출 YoY', operating_income: '영업이익', eps: 'EPS', eps_consensus: 'EPS 컨센', price_reaction: '주가반응' };

// ---------- 데이터 ----------
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}
async function loadSeason(sid) {
  if (!ST.seasons[sid]) ST.seasons[sid] = await getJSON(`data/seasons/${sid}.json`);
  return ST.seasons[sid];
}

// ---------- 셀 ----------
function detailText(m) {
  if (!m) return '';
  const t = [];
  if (m.basis) t.push(BASIS[m.basis] || m.basis);
  if (m.flag) t.push(FLAG[m.flag]);
  if (m.provider) t.push(m.provider + (m.asOf ? ` (${m.asOf})` : ''));
  (m.alts || []).forEach(a => t.push(`다른 집계 ${a.provider} ${a.value}`));
  if (m.alts_note) t.push(m.alts_note);
  if (m.note) t.push(m.note);
  if (m.caution) t.push('주의: ' + m.caution);
  if (m.reason) t.push(m.reason);
  return t.join(' · ');
}
function valueCell(ev, co, key, fmt, extra = '') {
  const m = ev.metrics[key];
  const v = m ? m.value : null;
  if (v == null) {
    if (ev.status === 'scheduled') return `<td class="${extra}"></td>`;
    if (key === 'operating_income' && co.operating_income === false) return `<td class="${extra}"><span class="na">해당 없음</span></td>`;
    if (m && m.reason) return `<td class="${extra}"><span class="miss info" title="${esc(m.reason)}">—</span></td>`;
    return `<td class="${extra}"><span class="miss">—</span></td>`;
  }
  const tip = detailText(m);
  const fl = m.flag && FLAG_SHORT[m.flag] ? `<sup class="fl ${m.flag}">${FLAG_SHORT[m.flag]}</sup>` : '';
  const body = tip ? `<span class="info" title="${esc(tip)}">${fmt(v)}</span>` : fmt(v);
  return `<td class="${extra}">${body}${fl}</td>`;
}
// 계산 필드 셀: 색, 입력값 표시(미확인·불일치면 흐리게), 해석 주의(※)
function derivedCell(v, inputs, extra = '', colored = true) {
  if (v == null) return `<td class="${extra}"></td>`;
  const ms = inputs.filter(Boolean);
  const weak = ms.some(m => m.flag === 'unverified' || m.flag === 'disputed');
  const cautions = ms.map(m => m.caution).filter(Boolean);
  const cls = [extra, colored ? (v > 0 ? 'up' : v < 0 ? 'down' : '') : '', weak ? 'weak' : ''].join(' ');
  const warn = cautions.length ? `<sup class="warn" title="${esc(cautions.join(' / '))}">※</sup>` : '';
  const title = weak ? ' title="입력값 중 출처 미확인 값이 있음"' : '';
  const txt = colored ? pct(v) : (v * 100).toFixed(1) + '%';
  return `<td class="${cls}"><span${title}>${txt}</span>${warn}</td>`;
}

function whenCell(ev, co, today) {
  const a = ev.announce;
  const chips = [];
  let sub = '';
  if (ev.status === 'scheduled') {
    const dd = dayDiff(a.date, today);
    if (dd < 0) chips.push('<span class="chip over">발표일 지남</span>');
    else chips.push(`<span class="chip ${dd <= 2 ? 'dd' : ''}">${dd === 0 ? '오늘' : 'D-' + dd}</span>`);
    chips.push(`<span class="chip ${a.certainty === 'estimated' ? 'est' : ''}" title="일정 확실도">${CERT[a.certainty]}</span>`);
    const bits = [];
    if (a.timing) bits.push(TIMING[a.timing]);
    if (a.time && a.tz) { const b = toView(a.date, a.time, a.tz); bits.push(`방콕 ${shortDate(b.date)} ${b.time}`); }
    if (a.alt_dates && a.alt_dates.length) bits.push('또는 ' + a.alt_dates.map(shortDate).join('·'));
    sub = bits.join(' · ');
  } else {
    if (ev.status === 'reported') chips.push(`<span class="chip done">${STATUS.reported}</span>`);
    if (ev.status === 'awaiting_input') chips.push(`<span class="chip wait">${STATUS.awaiting_input}</span>`);
    if (ev.status === 'needs_check') chips.push(`<span class="chip check">${STATUS.needs_check}</span>`);
    if (ev.stage) chips.push(`<span class="chip ${ev.stage === 'preliminary' ? 'prelim' : 'final'}">${STAGE[ev.stage]}</span>`);
    if (ev.stage === 'preliminary' && a.final_expected) sub = `확정 ${a.final_expected}`;
  }
  return `<td class="when l"><span class="d">${fmtDate(a.date)}</span><div class="chips">${sub ? `<span class="sub">${esc(sub)}</span>` : ''}${chips.join('')}</div></td>`;
}
function periodCell(ev, co) {
  const p = ev.period;
  const sub = co.fiscal.calendar ? '' : `<span class="sub" title="${esc(co.fiscal.rule || '')}">${p.approx ? '≈' : ''}${shortDate(p.start)}–${shortDate(p.end)}</span>`;
  return `<td class="l">${esc(ev.label)}${sub}</td>`;
}

// ---------- 표 ----------
const SORTABLE = {
  revenue_surprise: { label: '서프라이즈', get: (e, d) => d.revenue_surprise },
  revenue_yoy: { label: 'YoY', get: e => e.metrics.revenue_yoy && e.metrics.revenue_yoy.value },
  op_margin: { label: '이익률', get: (e, d) => d.op_margin },
  eps_surprise: { label: '서프라이즈', get: (e, d) => d.eps_surprise },
  price_reaction: { label: '주가반응', get: e => e.metrics.price_reaction && e.metrics.price_reaction.value },
};
const sortBtn = k => {
  const dir = ST.sort && ST.sort.key === k ? ST.sort.dir : '';
  return `<button type="button" class="sort" data-sort="${k}" data-dir="${dir}" aria-label="${SORTABLE[k].label} 정렬">${SORTABLE[k].label}</button>`;
};
const NCOL = 13;

function renderTable(season, today) {
  const co = ST.companies;
  const rows = season.events.map(e => ({ e, c: co[e.ticker], d: Calc.derived(e.metrics) }));
  const head = `<thead>
    <tr class="band"><th colspan="3">기본 정보</th><th colspan="4">매출</th><th colspan="2">영업이익</th><th colspan="3">EPS</th><th>시장</th></tr>
    <tr class="hd"><th class="l">기업</th><th class="l">발표일</th><th class="l">회계기간</th>
      <th class="g">실적</th><th>컨센</th><th>${sortBtn('revenue_surprise')}</th><th>${sortBtn('revenue_yoy')}</th>
      <th class="g">실적</th><th>${sortBtn('op_margin')}</th>
      <th class="g">실적</th><th>컨센</th><th>${sortBtn('eps_surprise')}</th>
      <th class="g">${sortBtn('price_reaction')}</th></tr></thead>`;

  let list = rows;
  if (ST.sort) {
    const { key, dir } = ST.sort, get = SORTABLE[key].get;
    list = rows.slice().sort((a, b) => {
      const x = get(a.e, a.d), y = get(b.e, b.d);
      if (x == null && y == null) return a.c.order - b.c.order;
      if (x == null) return 1;
      if (y == null) return -1;
      return dir === 'desc' ? y - x : x - y;
    });
  }
  let html = '', region = null;
  for (const { e, c, d } of list) {
    if (!ST.sort && c.region !== region) {
      region = c.region;
      const r = ST.regions[region], n = rows.filter(x => x.c.region === region).length;
      html += `<tr class="grp"><td colspan="${NCOL}"><span>${r.flag} ${esc(r.label)} · ${n}개사</span></td></tr>`;
    }
    const m = e.metrics, cur = e.currency, open = ST.open.has(e.ticker);
    html += `<tr class="ev ${e.status === 'scheduled' ? 'pending' : ''} ${open ? 'open' : ''}" data-t="${esc(e.ticker)}">
      <td class="co"><button type="button" class="tog" aria-expanded="${open}" aria-controls="det-${esc(e.ticker)}"><span class="car">▶</span><span class="tk">${esc(e.ticker)}</span><span class="nm">${esc(c.name)} · ${esc(c.sector)}</span></button></td>
      ${whenCell(e, c, today)}${periodCell(e, c)}
      ${valueCell(e, c, 'revenue', v => money(v, cur), 'g')}${valueCell(e, c, 'revenue_consensus', v => money(v, cur))}
      ${derivedCell(d.revenue_surprise, [m.revenue, m.revenue_consensus])}${valueCell(e, c, 'revenue_yoy', v => pct(v))}
      ${valueCell(e, c, 'operating_income', v => money(v, cur), 'g')}${derivedCell(d.op_margin, [m.operating_income, m.revenue], '', false)}
      ${valueCell(e, c, 'eps', v => eps(v, cur), 'g')}${valueCell(e, c, 'eps_consensus', v => eps(v, cur))}
      ${derivedCell(d.eps_surprise, [m.eps, m.eps_consensus])}
      ${reactionCell(e)}
    </tr>
    <tr class="det" id="det-${esc(e.ticker)}" ${open ? '' : 'hidden'}><td colspan="${NCOL}">${open ? detail(e, c) : ''}</td></tr>`;
  }
  $('tbl').innerHTML = head + '<tbody>' + html + '</tbody>';
}
function reactionCell(e) {
  const m = e.metrics.price_reaction;
  if (!m || m.value == null) return valueCell(e, ST.companies[e.ticker], 'price_reaction', v => pct(v), 'g');
  const v = m.value, tip = detailText(m);
  return `<td class="g ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${tip ? `<span class="info" title="${esc(tip)}">${pct(v)}</span>` : pct(v)}</td>`;
}

// 펼친 상세: 비고 + 지표별 출처·기준 + 일정·기간 + 시트 대비 정정
function detail(e, c) {
  const notes = esc(e.notes || '').replace(/\s(?=[★※])/g, '<br>');
  const cur = e.currency;
  const fmtM = (k, v) => (k === 'revenue_yoy' || k === 'price_reaction' ? pct(v) : k.startsWith('eps') ? eps(v, cur) : money(v, cur));
  const mrows = Object.keys(MLABEL).map(k => {
    const m = e.metrics[k];
    if (!m) return '';
    const extra = [];
    if (m.basis) extra.push(BASIS[m.basis] || m.basis);
    if (m.flag) extra.push(FLAG[m.flag]);
    if (m.provider) extra.push(esc(m.provider) + (m.asOf ? ` · ${m.asOf}` : ''));
    (m.alts || []).forEach(a => extra.push(`다른 집계 ${esc(a.provider)} ${fmtM(k, a.value)}`));
    if (m.alts_note) extra.push(esc(m.alts_note));
    if (m.note) extra.push(esc(m.note));
    if (m.caution) extra.push('<b>주의</b> ' + esc(m.caution));
    if (m.reason) extra.push((m.value == null ? '공란 사유: ' : '') + esc(m.reason));
    (m.src || []).forEach(s => extra.push(`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`));
    if (!extra.length) return '';
    return `<div class="mrow"><b>${MLABEL[k]}</b><span>${m.value == null ? '—' : fmtM(k, m.value)}</span><span class="x">${extra.join(' · ')}</span></div>`;
  }).join('');
  const a = e.announce, p = e.period;
  const sched = [fmtDate(a.date, true), a.timing && TIMING[a.timing], `일정 ${CERT[a.certainty]}`,
    a.time && a.tz && (() => { const b = toView(a.date, a.time, a.tz); return `현지 ${a.time} → 방콕 ${fmtDate(b.date)} ${b.time}`; })(),
    a.alt_dates && a.alt_dates.length && '다른 전망 ' + a.alt_dates.map(x => fmtDate(x)).join(', '),
    a.note, a.final_expected && `확정실적 ${a.final_expected}`].filter(Boolean).map(esc).join(' · ');
  const chg = (e.changes || []).map(x => `<div class="chg">${esc(MLABEL[x.field] || (x.field === 'notes' ? '비고' : x.field))}${'from' in x ? `: ${esc(x.from ?? '공란')} → ${esc(x.to)}` : ''} — ${esc(x.reason || '')}</div>`).join('');
  return `<div class="detin">
    <div><h3>비고 · 핵심 코멘트</h3><p>${notes || '<span class="na">아직 없음</span>'}</p></div>
    <dl>
      <div><dt>발표 일정</dt><dd>${sched}</dd></div>
      <div><dt>회계기간</dt><dd>${esc(e.label)} · ${p.start} ~ ${p.end}${p.approx ? ' (회계 규칙으로 계산)' : ''}${c.fiscal.rule ? `<br><span class="chg">${esc(c.fiscal.rule)}</span>` : ''}</dd></div>
      ${mrows ? `<div><dt>지표별 기준·출처</dt><dd>${mrows}</dd></div>` : ''}
      ${chg ? `<div><dt>시트 대비 정정</dt><dd>${chg}</dd></div>` : ''}
    </dl></div>`;
}

// ---------- 요약 ----------
function renderSummary(season, today) {
  const evs = season.events, total = evs.length;
  const done = evs.filter(e => e.status !== 'scheduled');
  const ds = evs.map(e => Calc.derived(e.metrics));
  const tally = k => { const v = ds.map(d => d[k]).filter(x => x != null); return [v.filter(x => x > 0).length, v.filter(x => x < 0).length]; };
  const [rb, rm] = tally('revenue_surprise'), [eb, em] = tally('eps_surprise');
  const upcoming = evs.filter(e => e.status === 'scheduled' && e.announce.date >= today).sort((a, b) => a.announce.date.localeCompare(b.announce.date));
  const overdue = evs.filter(e => e.status === 'scheduled' && e.announce.date < today);
  let next = '<span class="v">—</span><span class="s">남은 발표 없음</span>';
  if (upcoming.length) {
    const d0 = upcoming[0].announce.date, same = upcoming.filter(e => e.announce.date === d0), dd = dayDiff(d0, today);
    const after = upcoming.filter(e => e.announce.date > d0).slice(0, 4).map(e => `${e.ticker} ${shortDate(e.announce.date)}`).join(' · ');
    next = `<span class="v">${fmtDate(d0)}<small>${dd === 0 ? '오늘' : 'D-' + dd}</small></span>
      <span class="s"><b>${same.map(e => e.ticker).join(' · ')}</b> ${same.map(e => [e.announce.timing && TIMING[e.announce.timing], CERT[e.announce.certainty]].filter(Boolean).join(' ')).filter((x, i, arr) => arr.indexOf(x) === i).join(' / ')}${after ? `<br>이후 ${after}` : ''}</span>`;
  }
  const tiles = [
    `<div class="stat"><span class="t">발표 진행</span><span class="v">${done.length}<small>/ ${total}개사</small></span><div class="prog"><i style="width:${(done.length / total * 100).toFixed(1)}%"></i></div></div>`,
    `<div class="stat"><span class="t">매출 서프라이즈</span><span class="v">${rb + rm ? `${rb}<small>상회</small> ${rm}<small>하회</small>` : '—'}</span><span class="s">컨센서스가 있는 ${rb + rm}개사 기준</span></div>`,
    `<div class="stat"><span class="t">EPS 서프라이즈</span><span class="v">${eb + em ? `${eb}<small>상회</small> ${em}<small>하회</small>` : '—'}</span><span class="s">지분평가이익 등 왜곡은 ※ 표시</span></div>`,
    overdue.length
      ? `<div class="stat alert"><span class="t">발표일 지남 · 미입력</span><span class="v">${overdue.length}<small>개사</small></span><span class="s"><b>${overdue.map(e => e.ticker).join(' · ')}</b> — 실적 반영 차례</span></div>`
      : `<div class="stat"><span class="t">다음 발표 (미국 날짜)</span>${next}</div>`,
  ];
  $('summary').innerHTML = tiles.join('');
}

// ---------- CSV (시트와 같은 18열, 숫자는 십억 단위) ----------
function csv(season) {
  const H = ['상태', '티커', '기업', '섹터', '발표일', '회계기간', '통화', '매출(십억)', '매출 컨센', '매출 서프라이즈', '매출 YoY', '영업이익(십억)', '영업이익률', 'EPS', 'EPS 컨센', 'EPS 서프라이즈', '주가반응', '비고'];
  const q = s => (s == null ? '' : /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const v = (e, k) => (e.metrics[k] ? e.metrics[k].value : null);
  const lines = [H.join(',')].concat(season.events.map(e => {
    const c = ST.companies[e.ticker], d = Calc.derived(e.metrics);
    return [STATUS[e.status] + (e.stage ? `(${STAGE[e.stage]})` : ''), e.ticker, c.name, c.sector, e.announce.date, e.label, e.currency,
      v(e, 'revenue'), v(e, 'revenue_consensus'), d.revenue_surprise, v(e, 'revenue_yoy'), v(e, 'operating_income'), d.op_margin,
      v(e, 'eps'), v(e, 'eps_consensus'), d.eps_surprise, v(e, 'price_reaction'), e.notes].map(q).join(',');
  }));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `earnings_${season.id}.csv` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 그리기 ----------
async function render() {
  const season = await loadSeason(ST.sid);
  const today = todayIn(TZ_VIEW);
  $('seasonTxt').textContent = season.label;
  $('updTxt').textContent = season.updated + (season.sheet_updated && season.sheet_updated !== season.updated ? ` (시트 ${season.sheet_updated})` : '');
  document.querySelectorAll('#seasonSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sid === ST.sid));
  document.querySelectorAll('[data-unit]').forEach(b => b.setAttribute('aria-pressed', b.dataset.unit === ST.unit));
  renderSummary(season, today);
  renderTable(season, today);
  $('tblCap').textContent = ST.sort ? '정렬 중 — 같은 머리글을 다시 누르면 방향이 바뀌고, 세 번째에 원래 순서로 돌아갑니다' : '지역 → 섹터 순 · 행을 누르면 비고와 출처가 펼쳐집니다';
  $('hlSec').hidden = !season.highlights.length;
  $('highlights').innerHTML = season.highlights.map(h => `<li>${esc(h)}</li>`).join('');
}

function bind() {
  $('seasonSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    location.hash = b.dataset.sid;
  });
  window.addEventListener('hashchange', () => {
    const sid = location.hash.slice(1);
    if (ST.index.seasons.some(s => s.id === sid) && sid !== ST.sid) { ST.sid = sid; ST.open.clear(); render(); }
  });
  document.querySelectorAll('[data-unit]').forEach(b => b.addEventListener('click', () => {
    ST.unit = b.dataset.unit; store.set('unit', ST.unit); render();
  }));
  $('tbl').addEventListener('click', e => {
    const s = e.target.closest('.sort');
    if (s) {
      const k = s.dataset.sort, cur = ST.sort && ST.sort.key === k ? ST.sort.dir : null;
      ST.sort = cur === null ? { key: k, dir: 'desc' } : cur === 'desc' ? { key: k, dir: 'asc' } : null;
      render(); return;
    }
    const row = e.target.closest('tr.ev');
    if (!row || e.target.closest('a')) return;
    const t = row.dataset.t;
    ST.open.has(t) ? ST.open.delete(t) : ST.open.add(t);
    const det = row.nextElementSibling, open = ST.open.has(t);
    row.classList.toggle('open', open);
    row.querySelector('.tog').setAttribute('aria-expanded', open);
    det.hidden = !open;
    if (open) det.firstElementChild.innerHTML = detail(ST.seasons[ST.sid].events.find(x => x.ticker === t), ST.companies[t]);
  });
  $('csvBtn').addEventListener('click', () => csv(ST.seasons[ST.sid]));
}

async function boot() {
  try {
    const [index, comp] = await Promise.all([getJSON('data/index.json'), getJSON('data/companies.json')]);
    ST.index = index;
    ST.companies = Object.fromEntries(comp.companies.map(c => [c.ticker, c]));
    ST.regions = Object.fromEntries(comp.regions.map(r => [r.id, r]));
    const h = location.hash.slice(1);
    ST.sid = index.seasons.some(s => s.id === h) ? h : index.current;
    ST.unit = store.get('unit') === 'bil' ? 'bil' : 'jo';
    $('seasonSeg').innerHTML = index.seasons.map(s => `<button type="button" data-sid="${s.id}" aria-pressed="false">${esc(s.label)}</button>`).join('');
    bind();
    await render();
  } catch (e) {
    document.querySelector('.wrap').insertAdjacentHTML('afterbegin',
      `<p class="err">데이터를 불러오지 못했습니다 (${esc(e.message)}). 이 페이지는 웹 서버에서 열어야 합니다: 폴더에서 <code>python -m http.server</code> 실행 후 http://localhost:8000</p>`);
  }
}
boot();
