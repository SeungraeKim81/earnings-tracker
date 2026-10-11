"""데이터 문장(비고·사유·메모 등)의 영어·태국어 번역 관리. 원문은 항상 한국어(data/*.json).

    python scripts/i18n.py status                 # 언어별 번역 없음·오래됨 개수
    python scripts/i18n.py export en > todo.json  # 번역이 필요한 항목 {키: 한국어 원문}
    python scripts/i18n.py apply en done.json     # {키: 번역문}을 data/i18n/en.json에 반영

번역 파일 항목은 {"src": 원문 해시, "text": 번역문}. 원문이 바뀌면 해시가 달라져 '오래됨'이 되고,
화면은 그 항목을 한국어 원문으로 보여 준다. 해시는 assets/i18n.js의 hash()와 같은 FNV-1a 32비트(UTF-16 단위).
한글이 없는 문장(예: 'Yahoo Finance')은 번역 대상이 아니다.
"""
import json
import re
import sys

from lib import DATA, dump, load

LANGS = ("en", "th")
HANGUL = re.compile(r"[가-힣]")


def fnv1a(s):
    h = 0x811C9DC5
    b = s.encode("utf-16-le")
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")


def items():
    """(키, 한국어 원문) — 키 규칙은 assets/app.js의 tx() 호출과 같아야 한다."""
    out = []
    comp = load("companies.json")
    for c in comp["companies"]:
        for f in ("rule",):
            if c["fiscal"].get(f):
                out.append((f"co/{c['ticker']}/{f}", c["fiscal"][f]))
        if c.get("currency_note"):
            out.append((f"co/{c['ticker']}/currency_note", c["currency_note"]))
    for s in load("index.json")["seasons"]:
        sid = s["id"]
        season = load(f"seasons/{sid}.json")
        for i, h in enumerate(season.get("highlights", [])):
            out.append((f"{sid}/highlights/{i}", h))
        for e in season["events"]:
            p = f"{sid}/{e['ticker']}"
            if e.get("notes"):
                out.append((f"{p}/notes", e["notes"]))
            for f in ("note", "final_expected"):
                if e["announce"].get(f):
                    out.append((f"{p}/announce/{f}", e["announce"][f]))
            for mk, m in e["metrics"].items():
                if not m:
                    continue
                for f in ("note", "caution", "reason", "alts_note", "provider"):
                    if m.get(f):
                        out.append((f"{p}/{mk}/{f}", m[f]))
                for i, a in enumerate(m.get("alts", [])):
                    out.append((f"{p}/{mk}/alts/{i}/provider", a["provider"]))
            for i, ch in enumerate(e.get("changes", [])):
                if ch.get("reason"):
                    out.append((f"{p}/changes/{i}/reason", ch["reason"]))
    return [(k, t) for k, t in out if HANGUL.search(t)]


def path(lang):
    return DATA / "i18n" / f"{lang}.json"


def read(lang):
    p = path(lang)
    return json.loads(p.read_text(encoding="utf-8"))["items"] if p.exists() else {}


def state(lang):
    tr = read(lang)
    missing, stale = [], []
    for k, t in items():
        e = tr.get(k)
        if e is None:
            missing.append(k)
        elif e["src"] != fnv1a(t):
            stale.append(k)
    unused = sorted(set(tr) - {k for k, _ in items()})
    return missing, stale, unused


def main(argv):
    cmd = argv[0] if argv else "status"
    if cmd == "status":
        for lang in LANGS:
            m, s, u = state(lang)
            print(f"{lang}: 번역 없음 {len(m)} · 오래됨 {len(s)} · 쓰이지 않음 {len(u)} (전체 {len(items())})")
    elif cmd == "export":
        lang = argv[1]
        m, s, _ = state(lang)
        src = dict(items())
        json.dump({k: src[k] for k in m + s}, sys.stdout, ensure_ascii=False, indent=1)
        print()
    elif cmd == "apply":
        lang, f = argv[1], argv[2]
        new = json.loads(open(f, encoding="utf-8").read())
        src = dict(items())
        bad = sorted(set(new) - set(src))
        if bad:
            sys.exit(f"원문에 없는 키: {bad}")
        tr = read(lang)
        for k, text in new.items():
            tr[k] = {"src": fnv1a(src[k]), "text": text}
        for k in state(lang)[2]:      # 원문에서 사라진 항목 정리
            tr.pop(k, None)
        path(lang).parent.mkdir(exist_ok=True)
        dump(path(lang), {"lang": lang, "items": dict(sorted(tr.items()))})
        print(f"{lang}: {len(new)}개 반영")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
