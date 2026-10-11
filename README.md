# 어닝 트래커

미국·한국·대만·유럽 주요 15개사의 분기 실적을 한 화면에서 비교하는 트래커. 매출·영업이익·EPS를 컨센서스와 비교하고, 발표 직후 주가반응과 핵심 코멘트를 함께 기록한다.
구글 시트(`earnings_tracker`)로 관리하던 것을 웹으로 옮기는 중이다.

## 진행 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 결정 사항, 데이터 이슈 정리 | 완료 — `docs/DECISIONS.md`, `docs/DATA_ISSUES.md` |
| 1 | 데이터 모델, 시트 이관, 검증 | 완료 — `data/`, `scripts/`, `tests/` |
| 2 | MVP 화면: 시즌 비교표 | 완료 — `index.html`, `assets/` |
| 3 | 요약·일정·차트 | 예정 |
| 4 | 자동화: 검증·엑셀 생성·배포·알림 | 예정 |
| 5 | 기업 상세, 가이던스 대비 실적 | 예정 |

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html`, `assets/` | 화면 (시즌 비교표). `assets/calc.js`는 `scripts/lib.py`와 같은 계산 규칙 |
| `data/companies.json` | 회사 기본 정보 |
| `data/index.json` | 시즌 목록 |
| `data/seasons/*.json` | 시즌별 발표·결과 |
| `migration/sheet_snapshot.json` | 구글 시트 원본 값·수식 |
| `migration/overlay.json` | 시트에 없는 정보와 정정 |
| `scripts/lib.py` | 공통 정의, 서프라이즈·영업이익률 계산 |
| `scripts/snapshot_sheet.py` | 시트 API 응답 → 스냅샷 |
| `scripts/import_sheet.py` | 스냅샷 + overlay → `data/` (시트 수식과 계산 일치 확인) |
| `scripts/validate.py` | 데이터 검증 |
| `docs/` | 결정 사항, 데이터 이슈, 데이터 구조, 작성 기준, 인수인계 문서 |

## 실행

```
python scripts/import_sheet.py      # 시트 스냅샷에서 data/ 다시 만들기
python scripts/validate.py          # 검증 (오류 있으면 종료 코드 1)
python -m unittest discover -s tests
```

Python 3.9 이상, 표준 라이브러리만 사용.

## 화면 보기

`index.html`을 더블클릭하면 데이터를 못 읽습니다(브라우저 보안). 폴더에서 `python -m http.server` 실행 후 http://localhost:8000 으로 엽니다.

- 시즌 탭(주소 끝 `#2026Q2`처럼 바로 열 수 있음), 원화 조원/십억원 전환
- % 열 머리글을 누르면 정렬(내림차순 → 오름차순 → 원래 순서)
- 행을 누르면 비고, 지표별 기준·출처·다른 집계값, 발표 일정(방콕 시각), 회계기간이 펼쳐짐
- CSV 내려받기: 시트와 같은 18열(숫자는 십억 단위)

특정 종목의 매수·매도를 권하는 자료가 아닙니다.
