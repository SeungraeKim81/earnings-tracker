# earnings-tracker 작업 안내

주요 기업 분기 실적 트래커. **마스터 데이터는 `data/*.json`** 이다(2026-10-12부터). 구글 시트는 초기 참조 데이터였고 더 이상 쓰지 않는다.

- 계산 규칙: `scripts/lib.py` (화면은 `assets/calc.js`, 두 쪽이 같아야 함)
- 데이터 구조: `docs/DATA_MODEL.md` · 입력 규칙: `docs/METHODOLOGY.md`
- 주기적 업데이트 구상: `docs/UPDATE_PLAN.md` · 배포: `docs/DEPLOY.md`

## 실적 반영 절차 (발표 후)

1. 공식 자료부터 확인: IR 실적발표·8-K/6-K·10-Q, 한국은 DART 공시. 컨센서스는 신뢰할 만한 집계(보도)로 확인하고 집계기관·기준일을 남긴다.
2. `data/seasons/{시즌}.json`의 해당 이벤트를 고친다.
   - `status`: `scheduled` → `reported` (한국 기업은 `stage`: `preliminary` / `final`)
   - 각 지표 `value`와 함께 `basis`(GAAP/non-GAAP/IFRS), 컨센서스는 `provider`·`asOf`, 다른 집계는 `alts`, 공식 확인 값은 `src`와 `flag: verified`
   - 못 구한 값은 `value: null` + `reason`. 계산으로 만든 값은 `flag: derived` + `reason`
   - 회계 왜곡(지분평가이익 등)은 해당 지표 `caution`
   - `notes`(한국어)에 핵심 코멘트, 시즌 파일 `updated`를 오늘 날짜(방콕)로
3. 일정이 바뀌면 `announce`(date, timing, time/tz, certainty, alt_dates)를 고친다.
4. 번역: `python scripts/i18n.py export en > /tmp/en.json`(th도 같은 방식) → 영어·태국어로 번역한 `{키: 번역문}` 파일을 만들어 `python scripts/i18n.py apply en <파일>`. 숫자·티커·기호는 원문 그대로, 원화 '조'는 T.
5. 검증 후 커밋·푸시 (main에 푸시되면 검증 통과 시 자동 배포):

```
python scripts/validate.py
python -m unittest discover -s tests
```

오류 0건이어야 한다. 경고는 확인 후 데이터에 `caution`·`note`·`reason`을 남겨 해소한다.

## 새 시즌 만들기

직전 시즌 파일을 복사해 `id`·`label`·`highlights`를 바꾸고, 이벤트마다 `status: scheduled`, 지표는 모두 null, `label`·`period`·`announce`(예정일·확실도)를 새로 채운다. `data/index.json`의 `seasons`와 `current`를 갱신한다.

## 화면

`index.html` + `assets/app.js`·`style.css`·`calc.js`·`i18n.js` (빌드 없음, 외부 라이브러리 없음).
- 화면 문구는 `assets/i18n.js`의 `UI.ko/en/th`에 같이 추가한다.
- 계산 규칙을 바꾸면 `scripts/lib.py`와 `assets/calc.js`를 함께 고친다 — `tests/test_calc_parity.py`가 비교한다.
- 한국 종목(숫자 코드)은 화면에서 종목명으로 보인다. 새 한국 종목은 `companies.json`에 `name`(한글)과 `name_en`을 꼭 넣는다.

## 지켜야 할 것

- 확인 못 한 값은 추정으로 채우지 않는다. `value: null` + `reason`.
- 출처가 갈리면 고른 값과 다른 값(`alts`)을 모두 남긴다.
- 서프라이즈·영업이익률은 저장하지 않는다(계산 필드).
- 퍼센트는 소수로 저장한다(−8% → -0.08).
- 스크립트는 Python 표준 라이브러리만 쓴다.

## 지난 기록

`migration/`과 `scripts/import_sheet.py`·`snapshot_sheet.py`는 구글 시트에서 처음 옮길 때 쓴 것이다. 다시 돌리면 `data/`를 시트 기준으로 덮어쓰므로 쓰지 않는다.
