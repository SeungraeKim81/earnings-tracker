// 어닝 트래커 화면. data/*.json을 읽어 요약·일정·비교 차트·기업 카드(또는 표)·상세 시트를 그린다.
'use strict';
const $ = id => document.getElementById(id);
const TZ_VIEW = 'Asia/Bangkok';
const ST = {
  index: null, companies: null, regions: null, seasons: {}, tr: {},
  sid: null, unit: 'jo', lang: 'ko',
  view: null,            // 'cards' | 'table' (null = 화면 너비로 자동)
  region: 'all', status: 'all', sort: null, metric: 'revenue_surprise', moreUpcoming: false,
  sheet: null,           // 상세 시트에 연 티커
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
};
const WIDE = () => window.matchMedia('(min-width: 760px)').matches;

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
const pctPlain = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';
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
const weekday = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};
function fmtDate(iso, withYear) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${withYear ? y + '.' : ''}${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${weekday(iso)})`;
}
const shortDate = iso => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
function todayIn(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const ddText = dd => (dd === 0 ? t('today') : dd > 0 ? 'D-' + dd : t('pastDate'));
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
const val = (e, k) => (e.metrics[k] ? e.metrics[k].value : null);
const season = () => ST.seasons[ST.sid];
const findEvent = tk => season().events.find(e => e.ticker === tk);

// 비교·정렬에 쓰는 지표. polar = 부호가 의미(상회/하회, 증감), cap = 막대 최대 범위
const METRIC = {
  revenue_surprise: { label: 'revSurprise', get: (e, d) => d.revenue_surprise, polar: true, cap: 0.25, keys: ['revenue', 'revenue_consensus'] },
  eps_surprise: { label: 'epsSurprise', get: (e, d) => d.eps_surprise, polar: true, cap: 0.25, keys: ['eps', 'eps_consensus'] },
  revenue_yoy: { label: 'mYoy', get: e => val(e, 'revenue_yoy'), polar: true, cap: 1.5, keys: ['revenue_yoy'] },
  op_margin: { label: 'mMargin', get: (e, d) => d.op_margin, polar: false, cap: 1, keys: ['operating_income', 'revenue'] },
  price_reaction: { label: 'mReaction', get: e => val(e, 'price_reaction'), polar: true, cap: 0.15, keys: ['price_reaction'] },
};
const dir = v => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const arrow = v => (v > 0 ? '▲' : v < 0 ? '▼' : '·');

// 지표 메모(툴팁·상세 공통). base = '{시즌}/{티커}/{지표}'
function metricBits(m, base, k, cur, html) {
  const b = [], e = html ? esc : s => s;
  if (m.basis) b.push(t('basis.' + m.basis) || m.basis);
  if (m.flag) b.push(t('flag.' + m.flag));
  if (m.provider) b.push(e(txt(base + '/provider', m.provider)) + (m.asOf ? ` (${m.asOf})` : ''));
  if (m.window) b.push(`${m.window[0]} → ${m.window[1]}`);
  (m.alts || []).forEach((a, i) => b.push(`${t('altAgg')} ${e(txt(`${base}/alts/${i}/provider`, a.provider))} ${fmtM(k, a.value, cur)}`));
  if (m.alts_note) b.push(e(txt(base + '/alts_note', m.alts_note)));
  if (m.note) b.push(e(txt(base + '/note', m.note)));
  if (m.caution) b.push((html ? `<b>${t('caution')}</b> ` : t('caution') + ': ') + e(txt(base + '/caution', m.caution)));
  if (m.reason) b.push((m.value == null ? t('blankReason') : '') + e(txt(base + '/reason', m.reason)));
  return b;
}
const flagSup = m => (m && m.flag && t('flagShort.' + m.flag) ? `<sup class="fl ${m.flag}">${t('flagShort.' + m.flag)}</sup>` : '');
const cautionOf = (e, keys) => keys.map(k => [k, e.metrics[k]]).filter(([, m]) => m && m.caution)
  .map(([k, m]) => txt(`${ST.sid}/${e.ticker}/${k}/caution`, m.caution));
const weakOf = (e, keys) => keys.some(k => e.metrics[k] && ['unverified', 'disputed'].includes(e.metrics[k].flag));

// 상회/하회 알약: ▲ 0.7% (색 + 기호 + 부호 — 색만으로 뜻을 전하지 않음)
function pill(v, e, keys) {
  if (v == null) return '';
  const warn = cautionOf(e, keys);
  const weak = weakOf(e, keys);
  return `<span class="pill ${dir(v)}${weak ? ' weak' : ''}"${weak ? ` title="${esc(t('weakTitle'))}"` : ''}>${arrow(v)} ${pctPlain(Math.abs(v))}${warn.length ? `<sup class="warn" title="${esc(warn.join(' / '))}">※</sup>` : ''}</span>`;
}
// 비어 있는 값 표시
function blank(e, c, key) {
  const m = e.metrics[key];
  if (key === 'operating_income' && c.operating_income === false) return `<span class="na">${t('na')}</span>`;
  if (m && m.reason) return `<span class="na" title="${esc(txt(`${ST.sid}/${e.ticker}/${key}/reason`, m.reason))}">—</span>`;
  return '<span class="na">—</span>';
}

// ---------- 칩·배지 ----------
function statusChips(e) {
  const c = [];
  if (e.status === 'reported') c.push(`<span class="chip done">${t('status.reported')}</span>`);
  else if (e.status !== 'scheduled') c.push(`<span class="chip ${e.status === 'awaiting_input' ? 'wait' : 'check'}">${t('status.' + e.status)}</span>`);
  if (e.stage) c.push(`<span class="chip ${e.stage === 'preliminary' ? 'prelim' : 'final'}">${t('stage.' + e.stage)}</span>`);
  return c.join('');
}
function schedBits(e, withDate) {
  const a = e.announce, bits = [];
  if (withDate) bits.push(fmtDate(a.date));
  if (a.timing) bits.push(t('timing.' + a.timing));
  if (a.time && a.tz) { const b = toView(a.date, a.time, a.tz); bits.push(`${t('bkk')} ${shortDate(b.date)} ${b.time}`); }
  if (a.alt_dates && a.alt_dates.length) bits.push(t('or') + ' ' + a.alt_dates.map(shortDate).join('·'));
  return bits;
}
const certChip = a => `<span class="chip ${a.certainty === 'estimated' ? 'est' : 'ok'}" title="${esc(t('certTitle'))}">${t('cert.' + a.certainty)}</span>`;
const periodText = (e, c) => esc(e.label) + (c.fiscal.calendar ? '' : ` · ${e.period.approx ? '≈' : ''}${shortDate(e.period.start)}–${shortDate(e.period.end)}`);
function nameBlock(e, c) {
  const main = isCode(e.ticker) ? coName(c) : e.ticker;
  const sub = isCode(e.ticker) ? `${e.ticker} · ${sectorName(c.sector)}` : `${coName(c)} · ${sectorName(c.sector)}`;
  return `<span class="tk">${esc(main)}</span><span class="nm">${esc(sub)}</span>`;
}

// ---------- 요약 ----------
function splitBar(b, m) {
  const n = b + m;
  if (!n) return '<div class="split empty"></div>';
  return `<div class="split" aria-hidden="true"><i class="up" style="flex:${b}"></i><i class="down" style="flex:${m}"></i></div>`;
}
function renderSummary(s, today) {
  const evs = s.events, total = evs.length;
  const done = evs.filter(e => e.status !== 'scheduled').length;
  const ds = evs.map(e => Calc.derived(e.metrics));
  const tally = k => { const v = ds.map(d => d[k]).filter(x => x != null); return [v.filter(x => x > 0).length, v.filter(x => x < 0).length]; };
  const [rb, rm] = tally('revenue_surprise'), [eb, em] = tally('eps_surprise');
  const upcoming = evs.filter(e => e.status === 'scheduled' && e.announce.date >= today).sort((a, b) => a.announce.date.localeCompare(b.announce.date));
  const overdue = evs.filter(e => e.status === 'scheduled' && e.announce.date < today);
  const bm = (b, m) => (b + m ? `<span class="nb"><b class="up">${b}</b><small>${t('beat')}</small></span> <span class="nb"><b class="down">${m}</b><small>${t('miss')}</small></span>` : '—');
  let last;
  if (overdue.length) {
    last = `<div class="tile alert"><span class="tt">${t('overdueTitle')}</span><span class="tv">${overdue.length}</span>
      <span class="ts"><b>${overdue.map(e => esc(label(e.ticker))).join(' · ')}</b> — ${t('overdueNote')}</span></div>`;
  } else if (upcoming.length) {
    const d0 = upcoming[0].announce.date, same = upcoming.filter(e => e.announce.date === d0);
    last = `<div class="tile"><span class="tt">${t('nextTitle')}</span><span class="tv">${fmtDate(d0)} <small>${ddText(dayDiff(d0, today))}</small></span>
      <span class="ts"><b>${same.map(e => esc(label(e.ticker))).join(' · ')}</b></span></div>`;
  } else {
    last = `<div class="tile"><span class="tt">${t('nextTitle')}</span><span class="tv">—</span><span class="ts">${t('noneLeft')}</span></div>`;
  }
  $('summary').innerHTML = `
    <div class="tile"><span class="tt">${t('progress')}</span><span class="tv">${done}<small>${t('ofCompanies', { n: total })}</small></span>
      <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${(done / total * 100).toFixed(1)}%"></i></div>
      <span class="ts">${t('reportedOf', { a: done, b: total - done })}</span></div>
    <div class="tile"><span class="tt">${t('revSurprise')}</span><span class="tv">${bm(rb, rm)}</span>${splitBar(rb, rm)}<span class="ts">${t('basedOn', { n: rb + rm })}</span></div>
    <div class="tile"><span class="tt">${t('epsSurprise')}</span><span class="tv">${bm(eb, em)}</span>${splitBar(eb, em)}<span class="ts">${t('epsNote')}</span></div>
    ${last}`;
}

// ---------- 다가오는 발표 (날짜별 타임라인) ----------
function renderUpcoming(s, today) {
  const sch = s.events.filter(e => e.status === 'scheduled').sort((a, b) => a.announce.date.localeCompare(b.announce.date) || ST.companies[a.ticker].order - ST.companies[b.ticker].order);
  $('upSec').hidden = !sch.length;
  $('duo').classList.toggle('single', !sch.length);   // 남은 발표가 없으면 비교 차트가 전체 폭
  if (!sch.length) return;
  const groups = [];
  sch.forEach(e => { const g = groups[groups.length - 1]; if (g && g.date === e.announce.date) g.evs.push(e); else groups.push({ date: e.announce.date, evs: [e] }); });
  const LIMIT = 4, shown = ST.moreUpcoming ? groups : groups.slice(0, LIMIT);
  const html = shown.map(g => {
    const dd = dayDiff(g.date, today);
    const [, m, d] = g.date.split('-');
    return `<li class="tl ${dd < 0 ? 'over' : dd <= 2 ? 'soon' : ''}">
      <div class="tld"><span class="tlm">${+m}/${+d}</span><span class="tlw">${weekday(g.date)}</span><span class="tldd">${ddText(dd)}</span></div>
      <div class="tle">${g.evs.map(e => `<button type="button" class="tlc" data-open="${esc(e.ticker)}" aria-label="${esc(t('openDetail', { x: label(e.ticker) }))}">
          <span class="tk">${esc(label(e.ticker))}</span><span class="tls">${esc(schedBits(e).join(' · '))}</span>${certChip(e.announce)}</button>`).join('')}</div></li>`;
  }).join('');
  const more = groups.length > LIMIT ? `<button type="button" class="linkbtn" id="moreUp">${ST.moreUpcoming ? t('lessUpcoming') : t('moreUpcoming', { n: groups.length - LIMIT })}</button>` : '';
  $('upcoming').innerHTML = `<ol class="timeline">${html}</ol>${more}`;
}

// ---------- 필터 ----------
function filtered(s) {
  return s.events.filter(e => (ST.region === 'all' || ST.companies[e.ticker].region === ST.region)
    && (ST.status === 'all' || (ST.status === 'reported' ? e.status !== 'scheduled' : e.status === 'scheduled')));
}
function renderFilters() {
  const regs = Object.keys(ST.regions);
  const chip = (grp, v, l, on) => `<button type="button" class="fchip" data-${grp}="${v}" aria-pressed="${on}">${l}</button>`;
  $('fRegion').innerHTML = chip('region', 'all', t('fAll'), ST.region === 'all') + regs.map(r => chip('region', r, `${ST.regions[r].flag} ${esc(regionName(r))}`, ST.region === r)).join('');
  $('fStatus').innerHTML = [['all', t('fAll')], ['reported', t('fReported')], ['scheduled', t('fUpcoming')]].map(([v, l]) => chip('status', v, l, ST.status === v)).join('');
  $('sortSel').innerHTML = `<option value="">${t('sortDefault')}</option>` + Object.keys(METRIC).map(k => `<option value="${k}" ${ST.sort === k ? 'selected' : ''}>${t(METRIC[k].label)}</option>`).join('');
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === curView()));
}
const curView = () => (WIDE() ? (ST.view || 'cards') : 'cards');   // 좁은 화면은 항상 카드

// ---------- 한눈에 비교 (막대 순위) ----------
function renderCompare(list) {
  const M = METRIC[ST.metric];
  $('cmpTabs').innerHTML = Object.keys(METRIC).map(k => `<button type="button" class="fchip" data-metric="${k}" aria-pressed="${ST.metric === k}">${t(METRIC[k].label)}</button>`).join('');
  const rows = list.map(e => ({ e, v: M.get(e, Calc.derived(e.metrics)) })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
  const missing = list.filter(e => e.status !== 'scheduled').length - rows.length;
  if (!rows.length) { $('compare').innerHTML = `<p class="empty">${t('cmpEmpty')}</p>`; return; }
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.v)));
  const scale = Math.min(M.cap, maxAbs) || 1;
  const html = rows.map(({ e, v }) => {
    const over = Math.abs(v) > scale + 1e-12;
    const w = Math.min(Math.abs(v) / scale, 1) * (M.polar ? 50 : 100);
    const pos = M.polar ? (v >= 0 ? `left:50%` : `right:50%`) : 'left:0';
    const cls = M.polar ? dir(v) : 'acc';
    const warn = cautionOf(e, M.keys), weak = weakOf(e, M.keys);
    const txtv = M.polar ? `${arrow(v)} ${pctPlain(Math.abs(v))}` : pctPlain(v);
    return `<button type="button" class="crow${weak ? ' weak' : ''}" data-open="${esc(e.ticker)}" aria-label="${esc(label(e.ticker) + ' ' + t(M.label) + ' ' + pct(v))}">
      <span class="cl">${esc(label(e.ticker))}</span>
      <span class="ct${M.polar ? ' polar' : ''}"><i class="${cls}${over ? ' over' : ''}" style="${pos};width:${w.toFixed(2)}%"></i>${over ? `<b class="cap ${v < 0 ? 'neg' : ''}" title="${esc(t('overCap'))}">≫</b>` : ''}</span>
      <span class="cv">${txtv}${warn.length ? `<sup class="warn" title="${esc(warn.join(' / '))}">※</sup>` : ''}</span></button>`;
  }).join('');
  const capTxt = M.polar ? t('cmpCap', { cap: pctPlain(scale, 0) }) : t('cmpCapPos', { cap: pctPlain(scale, 0) });
  $('compare').innerHTML = `<div class="cmp">${html}</div><p class="cap">${capTxt}${missing > 0 ? ' · ' + t('cmpMissing', { n: missing }) : ''}</p>`;
}

// ---------- 기업 카드 ----------
function sorted(list) {
  const base = list.slice().sort((a, b) => {
    const sa = a.status === 'scheduled', sb = b.status === 'scheduled';
    if (sa !== sb) return sa ? 1 : -1;                         // 발표한 회사 먼저
    if (sa) return a.announce.date.localeCompare(b.announce.date) || ST.companies[a.ticker].order - ST.companies[b.ticker].order;
    return ST.companies[a.ticker].order - ST.companies[b.ticker].order;
  });
  if (!ST.sort) return base;
  const get = METRIC[ST.sort].get;
  return base.slice().sort((a, b) => {
    const x = get(a, Calc.derived(a.metrics)), y = get(b, Calc.derived(b.metrics));
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return y - x;
  });
}
function metricBlock(e, c, kind) {
  const cur = e.currency, m = e.metrics, d = Calc.derived(m);
  const v = k => (m[k] && m[k].value != null ? m[k].value : null);
  if (kind === 'rev') {
    return `<div class="mb"><span class="ml">${t('bandRevenue')}</span>
      <span class="mv">${v('revenue') != null ? money(v('revenue'), cur) + flagSup(m.revenue) : blank(e, c, 'revenue')}</span>
      <span class="mc">${t('consShort')} ${v('revenue_consensus') != null ? money(v('revenue_consensus'), cur) + flagSup(m.revenue_consensus) : '—'}</span>
      ${pill(d.revenue_surprise, e, ['revenue', 'revenue_consensus'])}</div>`;
  }
  if (kind === 'op') {
    const mg = d.op_margin;
    return `<div class="mb"><span class="ml">${t('cardOp')}</span>
      <span class="mv">${v('operating_income') != null ? money(v('operating_income'), cur) + flagSup(m.operating_income) : blank(e, c, 'operating_income')}</span>
      <span class="mc">${t('marginShort')} ${mg != null ? pctPlain(mg) : '—'}</span>
      ${mg != null ? `<span class="meter" aria-hidden="true"><i style="width:${Math.max(0, Math.min(mg, 1)) * 100}%"></i></span>` : ''}</div>`;
  }
  return `<div class="mb"><span class="ml">EPS</span>
    <span class="mv">${v('eps') != null ? eps(v('eps'), cur) + flagSup(m.eps) : blank(e, c, 'eps')}</span>
    <span class="mc">${t('consShort')} ${v('eps_consensus') != null ? eps(v('eps_consensus'), cur) + flagSup(m.eps_consensus) : '—'}</span>
    ${pill(d.eps_surprise, e, ['eps', 'eps_consensus'])}</div>`;
}
function card(e, today) {
  const c = ST.companies[e.ticker], a = e.announce, open = t('openDetail', { x: label(e.ticker) });
  if (e.status === 'scheduled') {
    const dd = dayDiff(a.date, today);
    return `<article class="card sched" tabindex="0" role="button" data-open="${esc(e.ticker)}" aria-label="${esc(open)}">
      <div class="ch"><div class="cn">${nameBlock(e, c)}</div><span class="chip ${dd < 0 ? 'over' : dd <= 2 ? 'dd' : ''}">${ddText(dd)}</span></div>
      <div class="cp">${fmtDate(a.date)} · ${esc(schedBits(e).join(' · '))} ${certChip(a)}</div>
      <div class="cp mute">${periodText(e, c)}</div></article>`;
  }
  const yoy = val(e, 'revenue_yoy'), rx = val(e, 'price_reaction');
  return `<article class="card" tabindex="0" role="button" data-open="${esc(e.ticker)}" aria-label="${esc(open)}">
    <div class="ch"><div class="cn">${nameBlock(e, c)}</div><div class="cs">${statusChips(e)}</div></div>
    <div class="cp">${fmtDate(a.date)} · ${periodText(e, c)}</div>
    <div class="mg">${metricBlock(e, c, 'rev')}${metricBlock(e, c, 'op')}${metricBlock(e, c, 'eps')}</div>
    <div class="cf">
      <span><span class="ml">${t('mYoy')}</span> <b class="${yoy != null ? dir(yoy) + 't' : ''}">${yoy != null ? pct(yoy) : '—'}</b></span>
      <span><span class="ml">${t('mReaction')}</span> <b class="${rx != null ? dir(rx) + 't' : ''}">${rx != null ? `${arrow(rx)} ${pctPlain(Math.abs(rx))}` : '—'}</b></span>
      <span class="more">${t('details')} ›</span></div></article>`;
}
function renderCards(list, today) {
  const items = sorted(list);
  $('cards').innerHTML = items.length ? items.map(e => card(e, today)).join('') : `<p class="empty">${t('noneMatch')}</p>`;
}

// ---------- 표 (넓은 화면) ----------
function renderTable(list, today) {
  const rows = sorted(list);
  const head = `<thead>
    <tr class="band"><th colspan="3">${t('bandBasic')}</th><th colspan="4">${t('bandRevenue')}</th><th colspan="2">${t('bandOp')}</th><th colspan="3">${t('bandEps')}</th><th>${t('bandMarket')}</th></tr>
    <tr class="hd"><th class="l">${t('colCompany')}</th><th class="l">${t('colDate')}</th><th class="l">${t('colPeriod')}</th>
      <th class="g">${t('colActual')}</th><th>${t('colCons')}</th><th>${t('colSurprise')}</th><th>${t('colYoy')}</th>
      <th class="g">${t('colActual')}</th><th>${t('colMargin')}</th>
      <th class="g">${t('colActual')}</th><th>${t('colCons')}</th><th>${t('colSurprise')}</th>
      <th class="g">${t('colReaction')}</th></tr></thead>`;
  const cell = (e, c, k, fmt, cls = '') => {
    const m = e.metrics[k];
    if (!m || m.value == null) return `<td class="${cls}">${e.status === 'scheduled' ? '' : blank(e, c, k)}</td>`;
    const tip = metricBits(m, `${ST.sid}/${e.ticker}/${k}`, k, e.currency, false).join(' · ');
    return `<td class="${cls}">${tip ? `<span class="info" title="${esc(tip)}">${fmt(m.value)}</span>` : fmt(m.value)}${flagSup(m)}</td>`;
  };
  const body = rows.map(e => {
    const c = ST.companies[e.ticker], d = Calc.derived(e.metrics), cur = e.currency, a = e.announce;
    const when = e.status === 'scheduled'
      ? `<span class="chip ${dayDiff(a.date, today) <= 2 ? 'dd' : ''}">${ddText(dayDiff(a.date, today))}</span> ${certChip(a)}`
      : statusChips(e);
    const rx = val(e, 'price_reaction');
    return `<tr class="ev ${e.status === 'scheduled' ? 'pending' : ''}" data-open="${esc(e.ticker)}" tabindex="0">
      <td class="co">${nameBlock(e, c)}</td>
      <td class="l"><span class="d">${fmtDate(a.date)}</span><div class="chips">${when}</div></td>
      <td class="l">${periodText(e, c)}</td>
      ${cell(e, c, 'revenue', v => money(v, cur), 'g')}${cell(e, c, 'revenue_consensus', v => money(v, cur))}
      <td>${pill(d.revenue_surprise, e, ['revenue', 'revenue_consensus'])}</td>${cell(e, c, 'revenue_yoy', v => pct(v))}
      ${cell(e, c, 'operating_income', v => money(v, cur), 'g')}<td>${d.op_margin != null ? pctPlain(d.op_margin) : ''}</td>
      ${cell(e, c, 'eps', v => eps(v, cur), 'g')}${cell(e, c, 'eps_consensus', v => eps(v, cur))}
      <td>${pill(d.eps_surprise, e, ['eps', 'eps_consensus'])}</td>
      <td class="g">${rx != null ? `<b class="${dir(rx)}t">${arrow(rx)} ${pctPlain(Math.abs(rx))}</b>` : (e.status === 'scheduled' ? '' : blank(e, c, 'price_reaction'))}</td></tr>`;
  }).join('');
  $('tbl').innerHTML = rows.length ? head + '<tbody>' + body + '</tbody>' : `<tbody><tr><td class="empty">${t('noneMatch')}</td></tr></tbody>`;
}

// ---------- 상세 시트 ----------
function detailHTML(e, c) {
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
    return `<li><b>${t('metric.' + k)}</b> <span class="v">${m.value == null ? '—' : fmtM(k, m.value, e.currency)}</span><span class="x">${bits.join(' · ')}</span></li>`;
  }).join('');
  const a = e.announce, p = e.period;
  const sched = [fmtDate(a.date, true), a.timing && t('timing.' + a.timing), t('schedCert', { x: t('cert.' + a.certainty) }),
    a.time && a.tz && (() => { const b = toView(a.date, a.time, a.tz); return t('localToBkk', { t: a.time, d: fmtDate(b.date), t2: b.time }); })(),
    a.alt_dates && a.alt_dates.length && t('otherDates') + ' ' + a.alt_dates.map(x => fmtDate(x)).join(', '),
    a.note && txt(p0 + '/announce/note', a.note),
    a.final_expected && `${t('finalResults')} ${txt(p0 + '/announce/final_expected', a.final_expected)}`].filter(Boolean).map(esc).join(' · ');
  const rule = c.fiscal.rule ? txt(`co/${c.ticker}/rule`, c.fiscal.rule) : '';
  const chg = (e.changes || []).map((x, i) => `<li>${esc(t('metric.' + x.field) || (x.field === 'notes' ? t('notesField') : x.field))}${'from' in x ? `: ${esc(x.from ?? '—')} → ${esc(x.to)}` : ''} — ${esc(txt(`${p0}/changes/${i}/reason`, x.reason || ''))}</li>`).join('');
  const yoy = val(e, 'revenue_yoy'), rx = val(e, 'price_reaction');
  const figs = e.status === 'scheduled' ? `<p class="na">${t('notYet')}</p>` : `
    <div class="mg big">${metricBlock(e, c, 'rev')}${metricBlock(e, c, 'op')}${metricBlock(e, c, 'eps')}</div>
    <div class="cf"><span><span class="ml">${t('mYoy')}</span> <b class="${yoy != null ? dir(yoy) + 't' : ''}">${yoy != null ? pct(yoy) : '—'}</b></span>
      <span><span class="ml">${t('mReaction')}</span> <b class="${rx != null ? dir(rx) + 't' : ''}">${rx != null ? `${arrow(rx)} ${pctPlain(Math.abs(rx))}` : '—'}</b></span></div>`;
  return `
    <header class="sh" tabindex="-1"><div class="cn">${nameBlock(e, c)}</div><div class="cs">${statusChips(e)}${e.status === 'scheduled' ? certChip(a) : ''}</div>
      <button type="button" class="x" id="sheetClose" aria-label="${esc(t('close'))}">✕</button></header>
    <div class="sb">
      <section><h3>${t('keyFigures')}</h3>${figs}</section>
      <section><h3>${t('notesH')}${origTag}</h3><p class="notes-txt">${notes || `<span class="na">${t('noneYet')}</span>`}</p></section>
      <section><h3>${t('schedH')}</h3><p>${sched}</p></section>
      <section><h3>${t('periodH')}</h3><p>${esc(e.label)} · ${p.start} ~ ${p.end}${p.approx ? ` (${t('byRule')})` : ''}${rule ? `<br><span class="mute">${esc(rule)}</span>` : ''}</p></section>
      ${mrows ? `<section><h3>${t('metricsH')}</h3><ul class="mlist">${mrows}</ul></section>` : ''}
      ${chg ? `<section><h3>${t('changesH')}</h3><ul class="mlist">${chg}</ul></section>` : ''}
    </div>`;
}
function openSheet(tk, push = true) {
  const e = findEvent(tk);
  if (!e) return;
  ST.sheet = tk;
  const dlg = $('sheet');
  dlg.innerHTML = detailHTML(e, ST.companies[tk]);
  dlg.setAttribute('aria-label', label(tk));
  $('sheetClose').addEventListener('click', () => closeSheet());
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('.sh').focus({ preventScroll: true });   // 닫기 버튼 대신 제목에 포커스
  dlg.scrollTop = 0;
  if (push && location.hash !== `#${ST.sid}/${tk}`) history.pushState(null, '', `#${ST.sid}/${tk}`);
}
function closeSheet(fromHash) {
  const dlg = $('sheet');
  ST.sheet = null;
  if (dlg.open) dlg.close();
  if (!fromHash && location.hash.includes('/')) history.pushState(null, '', `#${ST.sid}`);
}

// ---------- CSV (시트와 같은 18열, 숫자는 십억 단위, 현재 언어) ----------
function csv(s) {
  const q = x => (x == null ? '' : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x));
  const lines = [t('csvHead').join(',')].concat(s.events.map(e => {
    const c = ST.companies[e.ticker], d = Calc.derived(e.metrics);
    return [t('status.' + e.status) + (e.stage ? `(${t('stage.' + e.stage)})` : ''), e.ticker, coName(c), sectorName(c.sector), e.announce.date, e.label, e.currency,
      val(e, 'revenue'), val(e, 'revenue_consensus'), d.revenue_surprise, val(e, 'revenue_yoy'), val(e, 'operating_income'), d.op_margin,
      val(e, 'eps'), val(e, 'eps_consensus'), d.eps_surprise, val(e, 'price_reaction'), txt(`${s.id}/${e.ticker}/notes`, e.notes)].map(q).join(',');
  }));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `earnings_${s.id}_${ST.lang}.csv` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 그리기 ----------
function renderStatic() {
  document.documentElement.lang = ST.lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $('footer').innerHTML = t('footer').map(p => `<p>${p}</p>`).join('');
  $('langSel').value = ST.lang;
  $('unitSel').innerHTML = `<option value="jo">${t('unitJo')}</option><option value="bil">${t('unitBil')}</option>`;
  $('unitSel').value = ST.unit;
}
function renderBody() {
  const s = season(), today = todayIn(TZ_VIEW), list = filtered(s);
  renderFilters();
  renderCompare(list);
  const v = curView();
  $('cards').hidden = v !== 'cards';
  $('tblWrap').hidden = v !== 'table';
  if (v === 'cards') renderCards(list, today); else renderTable(list, today);
}
async function render() {
  await loadTr(ST.lang);
  const s = await loadSeason(ST.sid);
  const today = todayIn(TZ_VIEW);
  renderStatic();
  $('updTxt').textContent = `${t('updated')} ${s.updated}`;
  document.querySelectorAll('#seasonSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sid === ST.sid));
  renderSummary(s, today);
  renderUpcoming(s, today);
  renderBody();
  $('hlSec').hidden = !s.highlights.length;
  $('highlights').innerHTML = s.highlights.map((h, i) => `<li>${esc(txt(`${s.id}/highlights/${i}`, h))}</li>`).join('');
  if (ST.sheet) openSheet(ST.sheet, false);
}

// 주소: #2026Q3 또는 #2026Q3/AAPL (상세 시트)
function parseHash() {
  const [sid, tk] = location.hash.slice(1).split('/');
  return { sid: ST.index.seasons.some(s => s.id === sid) ? sid : null, tk: tk || null };
}
async function onHash() {
  const { sid, tk } = parseHash();
  if (sid && sid !== ST.sid) { ST.sid = sid; ST.sheet = null; await render(); }
  if (tk && findEvent(tk)) openSheet(tk, false); else if ($('sheet').open) closeSheet(true);
}

function bind() {
  document.addEventListener('click', e => {
    const b = e.target.closest('button, [data-open]');
    if (!b || e.target.closest('a')) return;
    if (b.dataset.sid) { location.hash = b.dataset.sid; return; }
    if (b.dataset.region) { ST.region = b.dataset.region; renderBody(); return; }
    if (b.dataset.status) { ST.status = b.dataset.status; renderBody(); return; }
    if (b.dataset.metric) { ST.metric = b.dataset.metric; renderCompare(filtered(season())); return; }
    if (b.dataset.view) { ST.view = b.dataset.view; store.set('view', ST.view); renderBody(); return; }
    if (b.id === 'moreUp') { ST.moreUpcoming = !ST.moreUpcoming; renderUpcoming(season(), todayIn(TZ_VIEW)); return; }
    if (b.id === 'csvBtn') { csv(season()); return; }
    if (b.dataset.open) openSheet(b.dataset.open);
  });
  document.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('[data-open][role="button"], tr[data-open]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSheet(el.dataset.open); }
  });
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });   // 바깥(배경) 누르면 닫기
  $('sheet').addEventListener('close', () => { if (ST.sheet) closeSheet(); });
  $('langSel').addEventListener('change', e => { ST.lang = e.target.value; store.set('lang', ST.lang); render(); });
  $('unitSel').addEventListener('change', e => { ST.unit = e.target.value; store.set('unit', ST.unit); render(); });
  $('sortSel').addEventListener('change', e => { ST.sort = e.target.value || null; renderBody(); });
  window.addEventListener('hashchange', onHash);
  window.addEventListener('popstate', onHash);
  let wide = WIDE();
  window.addEventListener('resize', () => { if (WIDE() !== wide) { wide = WIDE(); renderBody(); } });
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
    const { sid, tk } = parseHash();
    ST.sid = sid || index.current;
    ST.sheet = tk;
    ST.unit = store.get('unit') === 'bil' ? 'bil' : 'jo';
    ST.view = ['cards', 'table'].includes(store.get('view')) ? store.get('view') : null;
    $('seasonSeg').innerHTML = index.seasons.map(s => `<button type="button" data-sid="${s.id}" aria-pressed="false">${esc(s.label)}</button>`).join('');
    $('langSel').innerHTML = I18N.LANGS.map(l => `<option value="${l.id}" lang="${l.id}">${l.label}</option>`).join('');
    bind();
    await render();
  } catch (e) {
    document.querySelector('main').insertAdjacentHTML('afterbegin', `<p class="err">${t('loadErr', { x: esc(e.message) })}</p>`);
    throw e;
  }
}
boot();
