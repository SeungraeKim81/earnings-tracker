# 데이터 구조

```
data/
  companies.json         회사 기본 정보(지역·섹터·통화·회계연도 규칙·표시 순서)
  index.json             시즌 목록과 현재 시즌
  seasons/2026Q2.json    시즌별 발표 이벤트와 결과
  seasons/2026Q3.json
migration/
  sheet_snapshot.json    구글 시트 원본 값·수식 (이관 기준)
  overlay.json           시트에 없는 정보와 0단계 정정
```

## companies.json

| 필드 | 뜻 |
|---|---|
| `ticker`, `name`, `name_en` | 티커, 표시 이름 |
| `region` | `regions[].id` (US / KR / TW / NL) |
| `sector` | 섹터 (한글 표기) |
| `currency` | 입력 통화. TSMC는 TWD 보고지만 USD(ADR 환산)로 입력 (`currency_note`) |
| `order` | 표 정렬 순서 (지역 → 섹터 → 티커) |
| `fiscal.calendar` | 역년 분기면 true. false면 `fiscal.rule`에 규칙 설명 |
| `operating_income: false` | 영업이익 비적용 (은행) |
| `two_stage: true` | 잠정 → 확정 2단계 공시 (삼성전자) |
| `reaction_basis` | 주가반응 기본 기준. `after_hours`(시간외) / `intraday`(장중) / `close`(종가) |

## seasons/{id}.json

시즌 = "Q3 2026 실적 시즌"처럼 비슷한 시기에 발표되는 묶음. 회계기간과 다를 수 있다(MU FQ4, NVDA FQ3 FY27 등). 그래서 시즌 귀속은 날짜로 계산하지 않고 파일에 명시한다.

| 필드 | 뜻 |
|---|---|
| `id`, `label` | `2026Q3`, `Q3 2026` |
| `updated` | 이 파일 내용을 마지막으로 갱신한 날짜(방콕) |
| `sheet_updated` | 시트에서 옮겼을 때 시트 부제의 업데이트 날짜 |
| `highlights[]` | 시즌 전체 해석 메모 (마크다운) |
| `events[]` | 회사별 발표 1건씩 |

### events[]

| 필드 | 뜻 |
|---|---|
| `status` | `scheduled`(미발표) / `reported`(발표완료) / `awaiting_input`(입력대기) / `needs_check`(확인필요) |
| `stage` | 한국 기업 `preliminary`(잠정) / `final`(확정). 그 외 null |
| `label` | 회계기간 표기. 예: `FQ4 2026`, `Q3 2026` |
| `period` | `{start, end, approx}` 회계기간 날짜. `approx: true`는 회계 규칙으로 계산한 날짜 |
| `currency` | 보고통화 (회사 기본값과 같아야 함) |
| `announce` | `{date, timing, time, tz, certainty, alt_dates, note, final_expected}` |
| `announce.date` | 발표일 (미국 기업은 미국 날짜) |
| `announce.timing` | `bmo`(장 전) / `amc`(장 후) / `during`(장중) |
| `announce.certainty` | `confirmed`(8-K 등 공시로 확정) / `verified`(회사 캘린더 확인) / `estimated`(추정) |
| `metrics` | 아래 7개 지표. 값도 메모도 없으면 null |
| `notes` | 비고 / 핵심 코멘트 (마크다운) |
| `changes[]` | 시트 대비 바뀐 내용 `{field, from, to, reason}` (이관 기록) |

### metrics

키: `revenue`, `revenue_consensus`, `revenue_yoy`, `operating_income`, `eps`, `eps_consensus`, `price_reaction`

- 매출·영업이익: 보고통화 십억 단위. 원화는 1조원 = 1,000
- EPS: 주당, 보고통화
- YoY·주가반응: 소수 (−8% → -0.08)

각 지표 객체:

| 필드 | 뜻 |
|---|---|
| `value` | 숫자 또는 null |
| `reason` | 값이 비었을 때 사유, 또는 시트 값을 바꾼 이유 (둘 중 하나면 필수) |
| `sheet_value` | 시트 원래 값 (바꿨을 때만) |
| `flag` | `verified`(공식 자료로 확인) / `unverified`(출처 미상) / `derived`(다른 공식 수치로 계산) / `disputed`(출처 간 불일치). 없으면 시트에서 옮긴 값 그대로 |
| `basis` | 영업이익·EPS: `GAAP` / `non-GAAP` / `IFRS`. 주가반응: `after_hours` / `intraday` / `close` |
| `provider`, `asOf` | 컨센서스 집계기관과 기준일 |
| `alts[]` | 다른 집계기관 값 `{provider, value}` |
| `src[]` | 출처 `{title, url, asOf}` |
| `note` | 해석 메모 (예: 지분평가이익 포함) |

### 계산 필드 (저장하지 않음, `scripts/lib.py`)

- 매출 서프라이즈 = (매출 − 매출 컨센) / |매출 컨센|
- EPS 서프라이즈 = (EPS − EPS 컨센) / |EPS 컨센|
- 영업이익률 = 영업이익 / 매출

입력이 하나라도 비었거나 분모가 0이면 계산하지 않는다(시트와 같음).
