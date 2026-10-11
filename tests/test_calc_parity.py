"""화면 계산(assets/calc.js)과 scripts/lib.py가 모든 이벤트에서 같은 결과를 내는지 확인. node가 없으면 건너뜀."""
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
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


if __name__ == "__main__":
    unittest.main()
