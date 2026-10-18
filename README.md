# 어닝 트래커

미국·한국·대만·유럽 주요 15개사의 분기 실적을 한 화면에서 비교하는 트래커. 매출·영업이익·EPS를 컨센서스와 비교하고, 발표 직후 주가반응과 핵심 코멘트를 함께 기록한다.
구글 시트(`earnings_tracker`)에서 시작했고, 2026-10-12부터는 이 저장소의 `data/*.json`이 마스터다. 화면은 한국어·영어·태국어.

## 진행 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 결정 사항, 데이터 이슈 정리 | 완료 — `docs/DECISIONS.md`, `docs/DATA_ISSUES.md` |
| 1 | 데이터 모델, 시트 이관, 검증 | 완료 — `data/`, `scripts/`, `tests/` |
| 2 | MVP 화면: 시즌 비교표 | 완료 — `index.html`, `assets/` |
| 2+ | 다국어(한국어·영어·태국어), 한국 종목명 표시, 배포 설정 | 완료 — `assets/i18n.js`, `data/i18n/`, `docs/DEPLOY.md` |
| 3 | 요약·일정·차트, 모바일 화면 개편 | 완료 — 요약 타일, 일정 타임라인, 서프라이즈 비교 막대, 카드·상세 시트 |
| 4 | 자동화: 검증·배포·주가반응·미입력 알림, Claude 정기 루틴 | 완료 (엑셀 생성은 예정) |
| 5 | 기업 상세, 가이던스 대비 실적 | 예정 |

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html`, `assets/` | 화면 (모바일 우선 카드·표·비교 차트). `assets/calc.js`는 `scripts/lib.py`와 같은 계산 규칙 |
| `data/companies.json` | 회사 기본 정보 |
| `data/index.json` | 시즌 목록 |
| `data/seasons/*.json` | 시즌별 발표·결과 |
| `migration/sheet_snapshot.json` | 구글 시트 원본 값·수식 |
| `migration/overlay.json` | 시트에 없는 정보와 정정 |
| `scripts/lib.py` | 공통 정의, 서프라이즈·영업이익률 계산 |
| `scripts/snapshot_sheet.py` | (최초 이관용) 시트 API 응답 → 스냅샷 |
| `scripts/import_sheet.py` | (최초 이관용) 스냅샷 + overlay → `data/` |
| `scripts/validate.py` | 데이터 검증 |
| `scripts/i18n.py` | 데이터 문장 번역 관리 (`data/i18n/en.json`, `th.json`) |
| `scripts/price_reaction.py` | 주가반응 자동 수집(첫 거래일 종가, GitHub Actions에서 매일) |
| `scripts/overdue.py` | 발표가 지났는데 미반영인 회사 목록(미입력 알림 이슈) |
| `.github/workflows/` | `pages.yml` 검증·배포, `daily.yml` 매일 자동 갱신 |
| `docs/` | 결정 사항, 데이터 이슈, 데이터 구조, 작성 기준, 인수인계 문서 |

## 실행

```
python scripts/validate.py          # 검증 (오류 있으면 종료 코드 1)
python -m unittest discover -s tests
```

Python 3.9 이상, 표준 라이브러리만 사용.

## 화면 보기

`index.html`을 더블클릭하면 데이터를 못 읽습니다(브라우저 보안). 폴더에서 `python -m http.server` 실행 후 http://localhost:8000 으로 엽니다.

모바일 우선 화면입니다. 좁은 화면에서도 좌우 스크롤 없이 카드로 보고, 넓은 화면(760px 이상)에서는 카드/표를 바꿔 볼 수 있습니다.

- 위쪽 막대: 시즌 탭, 언어(한국어·English·ไทย), 원화 조원/십억원 전환
- 요약: 발표 진행률, 매출·EPS 컨센 상회/하회 수, 다음 발표일(지났는데 미반영이면 경고)
- 발표 일정: 날짜별 타임라인(방콕 날짜, D-n, 확실도)
- 서프라이즈 비교: 매출·EPS 서프라이즈, 매출 YoY, 영업이익률, 주가반응을 막대로 비교. 너무 큰 값은 상한까지 그리고 `≫` 표시
- 실적 카드: 매출·영업이익(률)·EPS와 컨센 대비, 주가반응. 지역·상태 필터와 지표별 정렬
- 카드·막대·표 행을 누르면 상세(비고, 지표별 기준·출처·다른 집계값, 발표 일정, 회계기간)가 열림 — 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 창
- 주소로 바로 열기: `#2026Q2`(시즌), `#2026Q3/AAPL`(상세). 뒤로 가기로 상세가 닫힘
- 색: 초록 ▲ = 상회·상승, 빨강 ▼ = 하회·하락. 색만으로 구분하지 않도록 기호와 부호를 함께 표시. 시스템 다크 모드 지원
- CSV 내려받기: 시트와 같은 18열(숫자는 십억 단위, 현재 언어)

배포는 `docs/DEPLOY.md`, 실적 반영 절차는 `CLAUDE.md`, 주기적 업데이트 구상은 `docs/UPDATE_PLAN.md`.

특정 종목의 매수·매도를 권하는 자료가 아닙니다.
