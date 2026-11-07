"""Turn the downloaded artifact page into the live index.html.

usage: python3 tools/make_live.py <artifact index.html> [--bump]
  --bump  raises VERSION by 0.1 first (do this on every "zet live")
Copy the artifact's img/ and vid/ files in first: this script then makes them lighter (tools/optimize_media.py).
"""
import sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]).read_text()
vf = root / 'VERSION'
v = vf.read_text().strip()
if '--bump' in sys.argv:
    a, b = v.split('.'); b = int(b) + 1
    v = f'{int(a) + b // 10}.{b % 10}'
    vf.write_text(v + '\n')

s = src
old = '<!doctype html><html><head><meta charset=utf8>'
assert s.startswith(old)
s = s.replace(old, '<!doctype html><html lang="en"><head><meta charset=utf8><title>Rudo Menge - Art Direction &amp; Design</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><meta name="description" content="Rudo Menge, graphic designer and art director in Groningen. Posters, identities, books and exhibitions.">', 1)
# faster loading (2026-10-29): the artifact must load tiles only near the screen and Cases only when opened
assert 'new IntersectionObserver' in s and 'function loadCases()' in s, 'artifact lacks the lazy loading: port it from the live index.html first'
# lanes use the lane-sized copies in img/t/ (made by optimize_media.py below)
x = "'img/s/' + s.id + '.jpg');"
assert s.count(x) == 1; s = s.replace(x, "'img/t/' + s.id + '.jpg');", 1)
for x in ['<title>Website Menge.nl</title>\n', '<meta name="claude:viewport-fit-sides" content="cover">\n']:
    assert x in s; s = s.replace(x, '', 1)
x = '<button class="testbtn" id="testbtn" aria-expanded'
assert x in s; s = s.replace(x, '<button class="testbtn" id="testbtn" hidden aria-expanded', 1)
# no test panels on the live site at all (Menge, 2026-11-05): the test button and the Cases tweak
# button stay hidden for good, there is no ?test switch; testing happens in the artifact only
for b in ('casesTweak', 'aboutTweak'):
    if f'id="{b}"' in s:
        x = f'{b}.hidden = false;'
        assert x in s; s = s.replace(x, '')
# Neue Haas Grotesk: only live once Menge confirms the licence covers web use (asked 2026-11-07).
# Until then: toggle off (Inter), no @font-face rules, and the fonts/ files stay out of the repo.
NHG_LIVE = True   # Menge confirmed 2026-11-07: her licences cover web use
if not NHG_LIVE and 'id="nhgOn"' in s:
    x = 'id="nhgOn" checked>'
    assert s.count(x) == 1; s = s.replace(x, 'id="nhgOn">', 1)
    import re as _re
    s, k = _re.subn(r'@font-face\{font-family:"NHG (?:Text|Display)";src:url\(fonts/[^)]*\)[^}]*\}\n?', '', s)
    assert k and 'fonts/nhg' not in s
# the page comes wrapped in the artifact skeleton: keep one <head>, move the favicons into it
import re
m = re.search(r'</head><body>\n(<!doctype html><html><head>.*?</head><body>)\n', s)
if m:
    icons = ''.join(re.findall(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>', m.group(1)))
    s = s[:m.start(1)] + s[m.end(1) + 1:]
    x = '<style>:root{color-scheme'
    s = s.replace(x, icons + x, 1)
s = s.rstrip()
while s.endswith('</body></html>'): s = s[:-len('</body></html>')].rstrip()

# version label + visitor count, top left (live only)
s += f'''
<div class="ver" id="ver" aria-hidden="true">{v}</div>
<style>
.ver {{ position: fixed; z-index: 45; left: calc(10px + env(safe-area-inset-left, 0px)); top: calc(8px + env(safe-area-inset-top, 0px));
  font: 400 10px/1 "Inter", ui-sans-serif, system-ui, sans-serif; letter-spacing: .04em; font-variant-numeric: tabular-nums;
  color: #fff; mix-blend-mode: difference; opacity: .7; pointer-events: none; user-select: none; }}
/* no test buttons or settings panels on the live site, whatever the page does */
.testbtn, section.panel {{ display: none !important; }}
/* desk objects (pen, pocket knife, eraser) not on the live site for now (Menge, 2026-11-07) */
#sk .sk-desk {{ display: none !important; }}
/* only on the homepage: hidden while About or Cases is open */
body:has(#info:not([hidden])) .ver, body:has(#cases:not([hidden])) .ver {{ display: none; }}
</style>
<script>
(() => {{
  const el = document.getElementById('ver'), V = {v!r};
  // every visit counts once; the browser remembers which day/week/month it was last counted (no cookies)
  const ls = k => {{ try {{ return localStorage.getItem(k); }} catch (e) {{ return null; }} }};
  const p = {{}}; try {{ for (const x of new Intl.DateTimeFormat('en-CA', {{ timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }}).formatToParts(new Date())) p[x.type] = x.value; }} catch (e) {{}}
  const t = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7 + 3);
  const K = {{ day: p.year + '-' + p.month + '-' + p.day, week: t.getUTCFullYear() + '-W' + String(1 + Math.floor((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 6048e5)).padStart(2, '0'), month: p.year + '-' + p.month }};
  const f = {{ n: ls('mv') === '1' ? 0 : 1, d: ls('mvd') === K.day ? 0 : 1, w: ls('mvw') === K.week ? 0 : 1, m: ls('mvm') === K.month ? 0 : 1 }};
  fetch('/api/count', {{ method: 'POST', headers: {{ 'content-type': 'application/json' }}, body: JSON.stringify(f) }}).then(r => r.json()).then(d => {{
    if (typeof d.n !== 'number') return;
    el.textContent = V + ' \\u2013 ' + d.n;
    try {{ localStorage.setItem('mv', '1'); localStorage.setItem('mvd', d.day); localStorage.setItem('mvw', d.week); localStorage.setItem('mvm', d.month); }} catch (e) {{}}
  }}).catch(() => {{}});
}})();
</script>
</body></html>
'''
(root / 'index.html').write_text(s)
# lighter images and videos (skips files that were done before)
import subprocess; subprocess.run([sys.executable, str(root / 'tools' / 'optimize_media.py')], check=True)
print('version', v)
