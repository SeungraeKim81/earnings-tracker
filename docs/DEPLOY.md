# 배포 안내 (GitHub Pages)

이 저장소는 `main`에 푸시될 때마다 `.github/workflows/pages.yml`이 다음을 한다.

1. **검증**: `scripts/validate.py` + 테스트. 하나라도 실패하면 여기서 멈추고 배포하지 않는다(사이트는 직전 버전 유지).
2. **배포**: 통과하면 화면에 필요한 파일(`index.html`, `assets/`, `data/`)만 모아 GitHub Pages에 올린다. 문서·스크립트·이관 기록은 올라가지 않는다.

저장소가 비공개인 동안은 2번을 건너뛴다(무료 요금제에서는 비공개 저장소의 Pages를 쓸 수 없음).

사이트 주소: **https://seungraekim81.github.io/earnings-tracker/**

---

## 1. 공개 전에 확인할 것

저장소를 공개하면 지금 파일과 **커밋 이력 전체**가 누구에게나 보인다.

| 항목 | 위치 | 확인할 것 |
|---|---|---|
| 구글 시트 링크·ID | `docs/handoff.md`, `CLAUDE.md`, `scripts/snapshot_sheet.py`, `migration/sheet_snapshot.json` | 시트 공유 설정이 '제한됨'이면 링크가 보여도 다른 사람은 열 수 없다. 시트 오른쪽 위 **공유 → 일반 액세스**가 '제한됨'인지 확인 |
| 인수인계 문서 | `docs/handoff.md` | 작업 경과·개인 메모가 들어 있다. 공개가 꺼려지면 공개 전에 지워 달라고 하면 된다(이력에서도 지우려면 별도 작업 필요) |
| 비고·해석 | `data/seasons/*.json`, `data/i18n/` | 사이트에 그대로 보인다(사이트 공개가 목적이므로 정상) |
| 비밀값 | 없음 | API 키·비밀번호는 저장소에 없다. 앞으로 DART API 키 등은 저장소가 아니라 GitHub **Secrets**에 넣는다 |

## 2. 저장소 공개로 바꾸기

1. https://github.com/SeungraeKim81/earnings-tracker 접속
2. 위쪽 메뉴 **Settings** (톱니바퀴)
3. **General** 화면 맨 아래 **Danger Zone** → **Change repository visibility** → **Change visibility**
4. **Change to public** 선택 → 안내문을 읽고 확인 문구(저장소 이름)를 입력 → 확인

## 3. GitHub Pages 켜기 (한 번만)

1. 같은 **Settings** 왼쪽 메뉴에서 **Pages**
2. **Build and deployment → Source**를 **GitHub Actions**로 선택
   - 'Deploy from a branch'가 아니다. Actions 방식이어야 검증을 통과한 것만 올라간다.
3. 저장할 버튼은 따로 없다. 선택하면 바로 적용된다.

## 4. 첫 배포

설정 직후에는 아직 올라간 것이 없다. 둘 중 하나로 시작한다.

- **Actions** 탭 → 왼쪽 **검증·배포** → 오른쪽 **Run workflow** → Branch `main` → **Run workflow**
- 또는 아무 변경이나 `main`에 푸시(Claude에게 "배포 한 번 돌려줘"라고 해도 된다)

1~2분 뒤 실행 기록에 초록 체크가 뜨고, **deploy** 상자에 사이트 주소가 나온다. Settings → Pages 맨 위에도 "Your site is live at …"이 표시된다.

## 5. 그 다음부터

- **따로 할 일이 없다.** 실적을 반영해 `main`에 푸시하면(Claude가 하든 직접 하든) 검증 → 배포가 자동으로 돈다. 보통 1~2분 걸린다.
- **검증에 실패하면** 배포되지 않고, GitHub가 저장소 주인에게 실패 알림 메일을 보낸다. 사이트는 직전 버전 그대로다. Claude에게 "배포 실패 고쳐줘"라고 하면 된다.
- **바로 안 바뀌어 보이면** 브라우저 캐시 때문일 수 있다. 강력 새로고침(Windows `Ctrl+Shift+R`, Mac `Cmd+Shift+R`).
- 주소 끝에 `#2026Q2`를 붙이면 그 시즌으로 바로 열린다. 언어 선택은 브라우저에 기억된다.

## 6. 선택 사항

- **개인 도메인**: Settings → Pages → Custom domain에 도메인을 넣고, 도메인 관리 화면에서 CNAME을 `seungraekim81.github.io`로 지정. 그다음 **Enforce HTTPS** 체크.
- **사이트 내리기**: Settings → Pages → 위쪽 메뉴의 **Unpublish site**. 저장소를 다시 비공개로 바꿔도 무료 요금제에서는 사이트가 내려간다.

## 7. 문제가 생기면

| 증상 | 원인 | 해결 |
|---|---|---|
| 사이트 주소가 404 | Pages를 아직 안 켰거나 첫 배포 전 | 3·4번 |
| deploy 단계 오류 "Get Pages site failed" / "Not Found" | Source가 GitHub Actions로 설정되지 않음 | 3번 |
| deploy 단계가 회색(skipped) | 저장소가 아직 비공개이거나 `main`이 아닌 브랜치 | 2번 / `main`에 푸시 |
| 화면에 "데이터를 불러오지 못했습니다" | `data/` 파일 누락 또는 JSON 형식 오류 | 검증이 보통 먼저 잡는다. Actions 실행 기록을 Claude에게 보여 주면 된다 |
| 글꼴이 다르게 보임 | 글꼴 CDN(jsDelivr, Google Fonts) 접속이 막힌 환경 | 화면 동작에는 영향 없음 |
