// 어닝 트래커 화면. data/*.json을 읽어 시즌 비교표를 그린다.
'use strict';
const $ = id => document.getElementById(id);
const TZ_VIEW = 'Asia/Bangkok';
const ST = { index: null, companies: null, regions: null, seasons: {}, tr: {}, sid: null, unit: 'jo', lang: 'ko', sort: null, open: new Set() };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
};

// ---------- 언어 ----------
const HANGUL = /[가-힣]/;
function t(key, vars) {
  const pick = d => key.split('.').reduce((o, k) => (o == null ? o : o[k]), d);
  let s = pick(I18N.UI[ST.lang]);
  if (s == null) s = pick(I18N.UI.ko);
  if (typeof s === 'function') return s(vars || {});
  if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
}
// 데이터 문장 번역: 원문 해시가 맞는 번역만 쓰고, 없거나 오래됐으면 한국어 원문
function tx(key, ko) {
  if (!ko || ST.lang === 'ko' || !HANGUL.test(ko)) return { text: ko, orig: false };
  const e = (ST.tr[ST.lang] || {})[key];
  if (e && e.src === I18N.hash(ko)) return { text: e.text, orig: false };
  return { text: ko, orig: true };
}
const txt = (key, ko) => tx(key, ko).text;
const locale = () => I18N.LANGS.find(l => l.id === ST.lang).locale;
const isCode = tk => /^\d+$/.test(tk);                 // 한국 종목코드
const coName = c => (ST.lang === 'ko' ? c.name : c.name_en || c.name);
const label = tk => (isCode(tk) ? coName(ST.companies[tk]) : tk);
const sectorName = s => (ST.lang === 'ko' ? s : (I18N.SECTOR[s] || {})[ST.lang] || s);
const regionName = id => (ST.lang === 'ko' ? ST.regions[id].label : (I18N.REGION[id] || {})[ST.lang] || ST.regions[id].label);

// ---------- 표기 ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
const pct = (v, d = 1) => sign(v) + Math.abs(v * 100).toFixed(d) + '%';
const num = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const SYM = { USD: '$', EUR: '€' };
function money(v, cur) {                       // 매출·영업이익 (십억 단위 저장)
  const neg = v < 0 ? '−' : '', a = Math.abs(v);
  if (cur === 'KRW') {
    if (ST.lang === 'ko') return neg + (ST.unit === 'jo' ? num(a / 1000, 1) + '조' : num(a, 1));
    return neg + '₩' + (ST.unit === 'jo' ? num(a / 1000, 1) + 'T' : num(a, 1) + 'B');
  }
  return neg + SYM[cur] + num(a, 2) + 'B';
}
function eps(v, cur) {
  const neg = v < 0 ? '−' : '', a = Math.abs(v);
  if (cur === 'KRW') return ST.lang === 'ko' ? neg + num(a, 0) + '원' : neg + '₩' + num(a, 0);
  return neg + SYM[cur] + num(a, 2);
}
const fmtM = (k, v, cur) => (k === 'revenue_yoy' || k === 'price_reaction' ? pct(v) : k.startsWith('eps') ? eps(v, cur) : money(v, cur));
function fmtDate(iso, withYear) {
  const [y, m, d] = iso.split('-').map(Number);
  const w = new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
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
async function loadTr(lang) {
  if (lang === 'ko' || ST.tr[lang]) return;
  ST.tr[lang] = await getJSON(`data/i18n/${lang}.json`).then(d => d.items).catch(() => ({}));
}

// ---------- 셀 ----------
// 지표 메모(툴팁·상세 공통). base = '{시즌}/{티커}/{지표}'
function metricBits(m, base, k, cur, html) {
  const b = [], e = html ? esc : s => s;
  if (m.basis) b.push(t('basis.' + m.basis) || m.basis);
  if (m.flag) b.push(t('flag.' + m.flag));
  if (m.provider) b.push(e(txt(base + '/provider', m.provider)) + (m.asOf ? ` (${m.asOf})` : ''));
  (m.alts || []).forEach((a, i) => b.push(`${t('altAgg')} ${e(txt(`${base}/alts/${i}/provider`, a.provider))} ${fmtM(k, a.value, cur)}`));
  if (m.alts_note) b.push(e(txt(base + '/alts_note', m.alts_note)));
  if (m.note) b.push(e(txt(base + '/note', m.note)));
  if (m.caution) b.push((html ? `<b>${t('caution')}</b> ` : t('caution') + ': ') + e(txt(base + '/caution', m.caution)));
  if (m.reason) b.push((m.value == null ? t('blankReason') : '') + e(txt(base + '/reason', m.reason)));
  return b;
}
function valueCell(ev, co, key, fmt, extra = '') {
  const m = ev.metrics[key], base = `${ST.sid}/${ev.ticker}/${key}`;
  const v = m ? m.value : null;
  if (v == null) {
    if (ev.status === 'scheduled') return `<td class="${extra}"></td>`;
    if (key === 'operating_income' && co.operating_income === false) return `<td class="${extra}"><span class="na">${t('na')}</span></td>`;
    if (m && m.reason) return `<td class="${extra}"><span class="miss info" title="${esc(txt(base + '/reason', m.reason))}">—</span></td>`;
    return `<td class="${extra}"><span class="miss">—</span></td>`;
  }
  const tip = metricBits(m, base, key, ev.currency, false).join(' · ');
  const fl = m.flag && t('flagShort.' + m.flag) ? `<sup class="fl ${m.flag}">${t('flagShort.' + m.flag)}</sup>` : '';
  const body = tip ? `<span class="info" title="${esc(tip)}">${fmt(v)}</span>` : fmt(v);
  const cls = key === 'price_reaction' ? `${extra} ${v > 0 ? 'up' : v < 0 ? 'down' : ''}` : extra;
  return `<td class="${cls}">${body}${fl}</td>`;
}
// 계산 필드 셀: 색, 입력값 표시(미확인·불일치면 흐리게), 해석 주의(※)
function derivedCell(v, ev, keys, extra = '', colored = true) {
  if (v == null) return `<td class="${extra}"></td>`;
  const ms = keys.map(k => [k, ev.metrics[k]]).filter(x => x[1]);
  const weak = ms.some(([, m]) => m.flag === 'unverified' || m.flag === 'disputed');
  const cautions = ms.filter(([, m]) => m.caution).map(([k, m]) => txt(`${ST.sid}/${ev.ticker}/${k}/caution`, m.caution));
  const cls = [extra, colored ? (v > 0 ? 'up' : v < 0 ? 'down' : '') : '', weak ? 'weak' : ''].join(' ');
  const warn = cautions.length ? `<sup class="warn" title="${esc(cautions.join(' / '))}">※</sup>` : '';
  const title = weak ? ` title="${esc(t('weakTitle'))}"` : '';
  const s = colored ? pct(v) : (v * 100).toFixed(1) + '%';
  return `<td class="${cls}"><span${title}>${s}</span>${warn}</td>`;
}

function whenCell(ev, today) {
  const a = ev.announce, chips = [];
  let sub = '';
  if (ev.status === 'scheduled') {
    const dd = dayDiff(a.date, today);
    if (dd < 0) chips.push(`<span class="chip over">${t('pastDate')}</span>`);
    else chips.push(`<span class="chip ${dd <= 2 ? 'dd' : ''}">${dd === 0 ? t('today') : 'D-' + dd}</span>`);
    chips.push(`<span class="chip ${a.certainty === 'estimated' ? 'est' : ''}" title="${esc(t('certTitle'))}">${t('cert.' + a.certainty)}</span>`);
    const bits = [];
    if (a.timing) bits.push(t('timing.' + a.timing));
    if (a.time && a.tz) { const b = toView(a.date, a.time, a.tz); bits.push(`${t('bkk')} ${shortDate(b.date)} ${b.time}`); }
    if (a.alt_dates && a.alt_dates.length) bits.push(t('or') + ' ' + a.alt_dates.map(shortDate).join('·'));
    sub = bits.join(' · ');
  } else {
    if (ev.status !== 'reported') chips.push(`<span class="chip ${ev.status === 'awaiting_input' ? 'wait' : 'check'}">${t('status.' + ev.status)}</span>`);
    else chips.push(`<span class="chip done">${t('status.reported')}</span>`);
    if (ev.stage) chips.push(`<span class="chip ${ev.stage === 'preliminary' ? 'prelim' : 'final'}">${t('stage.' + ev.stage)}</span>`);
    if (ev.stage === 'preliminary' && a.final_expected) sub = t('finalExp', { x: txt(`${ST.sid}/${ev.ticker}/announce/final_expected`, a.final_expected) });
  }
  return `<td class="when l"><span class="d">${fmtDate(a.date)}</span><div class="chips">${sub ? `<span class="sub">${esc(sub)}</span>` : ''}${chips.join('')}</div></td>`;
}
function periodCell(ev, co) {
  const p = ev.period;
  const rule = co.fiscal.rule ? txt(`co/${co.ticker}/rule`, co.fiscal.rule) : '';
  const sub = co.fiscal.calendar ? '' : `<span class="sub" title="${esc(rule)}">${p.approx ? '≈' : ''}${shortDate(p.start)}–${shortDate(p.end)}</span>`;
  return `<td class="l">${esc(ev.label)}${sub}</td>`;
}
// 기업 셀: 숫자 코드(한국 종목)는 종목명을 크게, 코드는 작게
function companyCell(e, c, open) {
  const main = isCode(e.ticker) ? coName(c) : e.ticker;
  const sub = isCode(e.ticker) ? `${e.ticker} · ${sectorName(c.sector)}` : `${coName(c)} · ${sectorName(c.sector)}`;
  return `<td class="co"><button type="button" class="tog" aria-expanded="${open}" aria-controls="det-${esc(e.ticker)}"><span class="car">▶</span><span class="tk">${esc(main)}</span><span class="nm">${esc(sub)}</span></button></td>`;
}

// ---------- 표 ----------
const SORTABLE = {
  revenue_surprise: { label: 'colSurprise', get: (e, d) => d.revenue_surprise },
  revenue_yoy: { label: 'colYoy', get: e => e.metrics.revenue_yoy && e.metrics.revenue_yoy.value },
  op_margin: { label: 'colMargin', get: (e, d) => d.op_margin },
  eps_surprise: { label: 'colSurprise', get: (e, d) => d.eps_surprise },
  price_reaction: { label: 'colReaction', get: e => e.metrics.price_reaction && e.metrics.price_reaction.value },
};
const sortBtn = k => {
  const dir = ST.sort && ST.sort.key === k ? ST.sort.dir : '', l = t(SORTABLE[k].label);
  return `<button type="button" class="sort" data-sort="${k}" data-dir="${dir}" aria-label="${esc(t('sortBy', { x: l }))}">${esc(l)}</button>`;
};
const NCOL = 13;

function renderTable(season, today) {
  const rows = season.events.map(e => ({ e, c: ST.companies[e.ticker], d: Calc.derived(e.metrics) }));
  const head = `<thead>
    <tr class="band"><th colspan="3">${t('bandBasic')}</th><th colspan="4">${t('bandRevenue')}</th><th colspan="2">${t('bandOp')}</th><th colspan="3">${t('bandEps')}</th><th>${t('bandMarket')}</th></tr>
    <tr class="hd"><th class="l">${t('colCompany')}</th><th class="l">${t('colDate')}</th><th class="l">${t('colPeriod')}</th>
      <th class="g">${t('colActual')}</th><th>${t('colCons')}</th><th>${sortBtn('revenue_surprise')}</th><th>${sortBtn('revenue_yoy')}</th>
      <th class="g">${t('colActual')}</th><th>${sortBtn('op_margin')}</th>
      <th class="g">${t('colActual')}</th><th>${t('colCons')}</th><th>${sortBtn('eps_surprise')}</th>
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
      const n = rows.filter(x => x.c.region === region).length;
      html += `<tr class="grp"><td colspan="${NCOL}"><span>${ST.regions[region].flag} ${esc(regionName(region))} · ${t('companies', { n })}</span></td></tr>`;
    }
    const cur = e.currency, open = ST.open.has(e.ticker);
    html += `<tr class="ev ${e.status === 'scheduled' ? 'pending' : ''} ${open ? 'open' : ''}" data-t="${esc(e.ticker)}">
      ${companyCell(e, c, open)}${whenCell(e, today)}${periodCell(e, c)}
      ${valueCell(e, c, 'revenue', v => money(v, cur), 'g')}${valueCell(e, c, 'revenue_consensus', v => money(v, cur))}
      ${derivedCell(d.revenue_surprise, e, ['revenue', 'revenue_consensus'])}${valueCell(e, c, 'revenue_yoy', v => pct(v))}
      ${valueCell(e, c, 'operating_income', v => money(v, cur), 'g')}${derivedCell(d.op_margin, e, ['operating_income', 'revenue'], '', false)}
      ${valueCell(e, c, 'eps', v => eps(v, cur), 'g')}${valueCell(e, c, 'eps_consensus', v => eps(v, cur))}
      ${derivedCell(d.eps_surprise, e, ['eps', 'eps_consensus'])}
      ${valueCell(e, c, 'price_reaction', v => pct(v), 'g')}
    </tr>
    <tr class="det" id="det-${esc(e.ticker)}" ${open ? '' : 'hidden'}><td colspan="${NCOL}">${open ? detail(e, c) : ''}</td></tr>`;
  }
  $('tbl').innerHTML = head + '<tbody>' + html + '</tbody>';
}

// 펼친 상세: 비고 + 지표별 출처·기준 + 일정·기간 + 정정 기록
function detail(e, c) {
  const p0 = `${ST.sid}/${e.ticker}`;
  const n = tx(p0 + '/notes', e.notes || '');
  const notes = esc(n.text).replace(/\s(?=[★※])/g, '<br>');
  const origTag = n.orig ? ` <span class="chip est">${t('original')}</span>` : '';
  const mrows = Object.keys(I18N.UI.ko.metric).map(k => {
    const m = e.metrics[k];
    if (!m) return '';
    const bits = metricBits(m, `${p0}/${k}`, k, e.currency, true);
    (m.src || []).forEach(s => bits.push(`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`));
    if (!bits.length) return '';
    return `<div class="mrow"><b>${t('metric.' + k)}</b><span>${m.value == null ? '—' : fmtM(k, m.value, e.currency)}</span><span class="x">${bits.join(' · ')}</span></div>`;
  }).join('');
  const a = e.announce, p = e.period;
  const sched = [fmtDate(a.date, true), a.timing && t('timing.' + a.timing), t('schedCert', { x: t('cert.' + a.certainty) }),
    a.time && a.tz && (() => { const b = toView(a.date, a.time, a.tz); return t('localToBkk', { t: a.time, d: fmtDate(b.date), t2: b.time }); })(),
    a.alt_dates && a.alt_dates.length && t('otherDates') + ' ' + a.alt_dates.map(x => fmtDate(x)).join(', '),
    a.note && txt(p0 + '/announce/note', a.note),
    a.final_expected && `${t('finalResults')} ${txt(p0 + '/announce/final_expected', a.final_expected)}`].filter(Boolean).map(esc).join(' · ');
  const rule = c.fiscal.rule ? txt(`co/${c.ticker}/rule`, c.fiscal.rule) : '';
  const chg = (e.changes || []).map((x, i) => `<div class="chg">${esc(t('metric.' + x.field) || (x.field === 'notes' ? t('notesField') : x.field))}${'from' in x ? `: ${esc(x.from ?? '—')} → ${esc(x.to)}` : ''} — ${esc(txt(`${p0}/changes/${i}/reason`, x.reason || ''))}</div>`).join('');
  return `<div class="detin">
    <div><h3>${t('notesH')}${origTag}</h3><p>${notes || `<span class="na">${t('noneYet')}</span>`}</p></div>
    <dl>
      <div><dt>${t('schedH')}</dt><dd>${sched}</dd></div>
      <div><dt>${t('periodH')}</dt><dd>${esc(e.label)} · ${p.start} ~ ${p.end}${p.approx ? ` (${t('byRule')})` : ''}${rule ? `<br><span class="chg">${esc(rule)}</span>` : ''}</dd></div>
      ${mrows ? `<div><dt>${t('metricsH')}</dt><dd>${mrows}</dd></div>` : ''}
      ${chg ? `<div><dt>${t('changesH')}</dt><dd>${chg}</dd></div>` : ''}
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
  const bm = (b, m) => (b + m ? `${b}<small>${t('beat')}</small> ${m}<small>${t('miss')}</small>` : '—');
  let next = `<span class="v">—</span><span class="s">${t('noneLeft')}</span>`;
  if (upcoming.length) {
    const d0 = upcoming[0].announce.date, same = upcoming.filter(e => e.announce.date === d0), dd = dayDiff(d0, today);
    const after = upcoming.filter(e => e.announce.date > d0).slice(0, 4).map(e => `${esc(label(e.ticker))} ${shortDate(e.announce.date)}`).join(' · ');
    const how = same.map(e => [e.announce.timing && t('timing.' + e.announce.timing), t('cert.' + e.announce.certainty)].filter(Boolean).join(' ')).filter((x, i, arr) => arr.indexOf(x) === i).join(' / ');
    next = `<span class="v">${fmtDate(d0)}<small>${dd === 0 ? t('today') : 'D-' + dd}</small></span>
      <span class="s"><b>${same.map(e => esc(label(e.ticker))).join(' · ')}</b> ${esc(how)}${after ? `<br>${t('then')} ${after}` : ''}</span>`;
  }
  const tiles = [
    `<div class="stat"><span class="t">${t('progress')}</span><span class="v">${done.length}<small>${t('ofCompanies', { n: total })}</small></span><div class="prog"><i style="width:${(done.length / total * 100).toFixed(1)}%"></i></div></div>`,
    `<div class="stat"><span class="t">${t('revSurprise')}</span><span class="v">${bm(rb, rm)}</span><span class="s">${t('basedOn', { n: rb + rm })}</span></div>`,
    `<div class="stat"><span class="t">${t('epsSurprise')}</span><span class="v">${bm(eb, em)}</span><span class="s">${t('epsNote')}</span></div>`,
    overdue.length
      ? `<div class="stat alert"><span class="t">${t('overdueTitle')}</span><span class="v">${overdue.length}</span><span class="s"><b>${overdue.map(e => esc(label(e.ticker))).join(' · ')}</b> — ${t('overdueNote')}</span></div>`
      : `<div class="stat"><span class="t">${t('nextTitle')}</span>${next}</div>`,
  ];
  $('summary').innerHTML = tiles.join('');
}

// ---------- CSV (시트와 같은 18열, 숫자는 십억 단위, 현재 언어) ----------
function csv(season) {
  const q = s => (s == null ? '' : /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const v = (e, k) => (e.metrics[k] ? e.metrics[k].value : null);
  const lines = [t('csvHead').join(',')].concat(season.events.map(e => {
    const c = ST.companies[e.ticker], d = Calc.derived(e.metrics);
    return [t('status.' + e.status) + (e.stage ? `(${t('stage.' + e.stage)})` : ''), e.ticker, coName(c), sectorName(c.sector), e.announce.date, e.label, e.currency,
      v(e, 'revenue'), v(e, 'revenue_consensus'), d.revenue_surprise, v(e, 'revenue_yoy'), v(e, 'operating_income'), d.op_margin,
      v(e, 'eps'), v(e, 'eps_consensus'), d.eps_surprise, v(e, 'price_reaction'), txt(`${season.id}/${e.ticker}/notes`, e.notes)].map(q).join(',');
  }));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `earnings_${season.id}_${ST.lang}.csv` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 그리기 ----------
function renderStatic() {
  document.documentElement.lang = ST.lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $('footer').innerHTML = t('footer').map(p => `<p>${p}</p>`).join('');
  document.querySelectorAll('#langSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === ST.lang));
  document.querySelectorAll('[data-unit]').forEach(b => b.setAttribute('aria-pressed', b.dataset.unit === ST.unit));
}
async function render() {
  await loadTr(ST.lang);
  const season = await loadSeason(ST.sid);
  const today = todayIn(TZ_VIEW);
  renderStatic();
  $('seasonTxt').textContent = season.label;
  $('updTxt').textContent = season.updated;
  document.querySelectorAll('#seasonSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sid === ST.sid));
  renderSummary(season, today);
  renderTable(season, today);
  $('tblCap').textContent = ST.sort ? t('capSorted') : t('capDefault');
  $('hlSec').hidden = !season.highlights.length;
  $('highlights').innerHTML = season.highlights.map((h, i) => `<li>${esc(txt(`${season.id}/highlights/${i}`, h))}</li>`).join('');
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
  $('langSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    ST.lang = b.dataset.lang; store.set('lang', ST.lang); render();
  });
  $('tbl').addEventListener('click', e => {
    const s = e.target.closest('.sort');
    if (s) {
      const k = s.dataset.sort, cur = ST.sort && ST.sort.key === k ? ST.sort.dir : null;
      ST.sort = cur === null ? { key: k, dir: 'desc' } : cur === 'desc' ? { key: k, dir: 'asc' } : null;
      render(); return;
    }
    const row = e.target.closest('tr.ev');
    if (!row || e.target.closest('a')) return;
    const tk = row.dataset.t;
    ST.open.has(tk) ? ST.open.delete(tk) : ST.open.add(tk);
    const det = row.nextElementSibling, open = ST.open.has(tk);
    row.classList.toggle('open', open);
    row.querySelector('.tog').setAttribute('aria-expanded', open);
    det.hidden = !open;
    if (open) det.firstElementChild.innerHTML = detail(ST.seasons[ST.sid].events.find(x => x.ticker === tk), ST.companies[tk]);
  });
  $('csvBtn').addEventListener('click', () => csv(ST.seasons[ST.sid]));
}

function initialLang() {
  const saved = store.get('lang');
  if (I18N.LANGS.some(l => l.id === saved)) return saved;
  const nav = (navigator.language || '').slice(0, 2);
  return I18N.LANGS.some(l => l.id === nav) ? nav : 'ko';
}

async function boot() {
  ST.lang = initialLang();
  try {
    const [index, comp] = await Promise.all([getJSON('data/index.json'), getJSON('data/companies.json')]);
    ST.index = index;
    ST.companies = Object.fromEntries(comp.companies.map(c => [c.ticker, c]));
    ST.regions = Object.fromEntries(comp.regions.map(r => [r.id, r]));
    const h = location.hash.slice(1);
    ST.sid = index.seasons.some(s => s.id === h) ? h : index.current;
    ST.unit = store.get('unit') === 'bil' ? 'bil' : 'jo';
    $('seasonSeg').innerHTML = index.seasons.map(s => `<button type="button" data-sid="${s.id}" aria-pressed="false">${esc(s.label)}</button>`).join('');
    $('langSeg').innerHTML = I18N.LANGS.map(l => `<button type="button" data-lang="${l.id}" lang="${l.id}" aria-pressed="false">${l.label}</button>`).join('');
    bind();
    await render();
  } catch (e) {
    document.querySelector('.wrap').insertAdjacentHTML('afterbegin', `<p class="err">${t('loadErr', { x: esc(e.message) })}</p>`);
  }
}
boot();
