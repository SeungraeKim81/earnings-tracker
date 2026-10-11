# earnings-tracker 작업 안내

주요 기업 분기 실적 트래커. 데이터는 `data/*.json`, 계산 규칙은 `scripts/lib.py`, 구조는 `docs/DATA_MODEL.md`, 입력 규칙은 `docs/METHODOLOGY.md`.

## 지금 단계: 구글 시트가 마스터 (웹 전환 전)

실적 반영은 구글 시트에 하고, 웹 데이터는 시트에서 다시 만든다.

1. 시트 받기 — Google Sheets 커넥터 `get_spreadsheet`:
   - spreadsheetId `1hIpfaNEgPNARBJZZiv6bL6l1_X1BwwbGi-P_YztE200`
   - includeGridData `true`, ranges `["'Q2 2026'!A1:R45", "'Q3 2026'!A1:R45"]` (시즌 시트가 늘면 추가)
   - fields `["sheets.properties.title", "sheets.data.rowData.values.userEnteredValue", "sheets.data.rowData.values.effectiveValue"]`
   - 응답이 커서 파일로 저장되면 그 경로를 쓴다.
2. `python scripts/snapshot_sheet.py <응답 파일>`
3. `python scripts/import_sheet.py` — 시트 수식 결과와 코드 계산이 다르면 중단된다.
4. 시트에 없는 정보(일정 확실도, 회계기준, 출처, 정정)는 `migration/overlay.json`에 넣는다. 시트 값을 바꿀 때는 `reason` 필수.

## 웹 전환 후

`data/seasons/{시즌}.json`을 직접 고친다. 시트·overlay는 더 이상 쓰지 않는다.

## 커밋 전 항상

```
python scripts/validate.py
python -m unittest discover -s tests
```

오류 0건이어야 한다. 경고는 확인 후 데이터에 `note`나 `reason`을 남겨 해소한다.

## 화면

`index.html` + `assets/app.js`·`style.css`·`calc.js` (빌드 없음, 외부 라이브러리 없음). 계산 규칙을 바꾸면 `scripts/lib.py`와 `assets/calc.js`를 함께 고친다 — `tests/test_calc_parity.py`가 두 쪽을 비교한다.

## 지켜야 할 것

- 확인 못 한 값은 추정으로 채우지 않는다. `value: null` + `reason`.
- 출처가 갈리면 고른 값과 다른 값(`alts`)을 모두 남긴다.
- 서프라이즈·영업이익률은 저장하지 않는다(계산 필드).
- 회계 왜곡처럼 해석 주의가 필요하면 지표에 `caution`을 단다(화면에 ※). 단순 참고는 `note`.
- 퍼센트는 소수로 저장한다(−8% → -0.08).
- 스크립트는 Python 표준 라이브러리만 쓴다.
