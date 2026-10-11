"""화면(assets/*.js)과 Python 스크립트가 같은 결과를 내는지 확인. node가 없으면 건너뜀.

- 계산 필드: assets/calc.js ↔ scripts/lib.py
- 번역 해시: assets/i18n.js hash() ↔ scripts/i18n.py fnv1a()
"""
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import i18n  # noqa: E402
import lib  # noqa: E402

JS = """
const C = require(process.argv[1]);
const seasons = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = {};
for (const [sid, evs] of Object.entries(seasons))
  for (const e of evs) out[sid + ' ' + e.ticker] = C.derived(e.metrics);
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(shutil.which("node"), "node 없음")
class ParityTest(unittest.TestCase):
    def test_js_matches_python(self):
        idx = lib.load("index.json")
        seasons = {s["id"]: lib.load(f"seasons/{s['id']}.json")["events"] for s in idx["seasons"]}
        res = subprocess.run(["node", "-e", JS, str(ROOT / "assets" / "calc.js")],
                             input=json.dumps(seasons), capture_output=True, text=True, check=True)
        js = json.loads(res.stdout)
        n = 0
        for sid, evs in seasons.items():
            for e in evs:
                py = lib.derived(e["metrics"])
                for k, v in py.items():
                    j = js[f"{sid} {e['ticker']}"][k]
                    if v is None:
                        self.assertIsNone(j, f"{sid} {e['ticker']} {k}")
                    else:
                        self.assertAlmostEqual(v, j, places=12, msg=f"{sid} {e['ticker']} {k}")
                    n += 1
        self.assertEqual(n, 90)

    def test_hash_matches_python(self):
        texts = [t for _, t in i18n.items()] + ["", "a", "★※ 😀 ไทย 한국어"]
        js = "const I=require(process.argv[1]);const a=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify(a.map(I.hash)))"
        res = subprocess.run(["node", "-e", js, str(ROOT / "assets" / "i18n.js")],
                             input=json.dumps(texts), capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(res.stdout), [i18n.fnv1a(t) for t in texts])


if __name__ == "__main__":
    unittest.main()
