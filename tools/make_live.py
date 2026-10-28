"""Turn the downloaded artifact page into the live index.html.

usage: python3 tools/make_live.py <artifact index.html> [--bump]
  --bump  raises VERSION by 0.1 first (do this on every "zet live")
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
s = s.replace(old, '<!doctype html><html lang="en"><head><meta charset=utf8><title>Rudo Menge · Design &amp; Art Direction</title><meta name="description" content="Rudo Menge, graphic designer and art director in Groningen. Posters, identities, books and exhibitions.">', 1)
for x in ['<title>Website Menge.nl</title>\n', '<meta name="claude:viewport-fit-sides" content="cover">\n']:
    assert x in s; s = s.replace(x, '', 1)
x = '<button class="testbtn" id="testbtn" aria-expanded'
assert x in s; s = s.replace(x, '<button class="testbtn" id="testbtn" hidden aria-expanded', 1)
x = "const btn = $('testbtn'), panel = $('panel');\n"
assert x in s; s = s.replace(x, x + "// live site: test button only with ?test in the address (menge.nl/?test)\nif (new URLSearchParams(location.search).has('test')) btn.hidden = false;\n", 1)
# Cases tweak button (since artifact v95): also only with ?test
if 'id="casesTweak"' in s:
    x = 'casesTweak.hidden = false;'
    assert s.count(x) == 1
    s = s.replace(x, "if (new URLSearchParams(location.search).has('test')) casesTweak.hidden = false;", 1)
s = s.rstrip()
while s.endswith('</body></html>'): s = s[:-len('</body></html>')].rstrip()

# version label + visitor count, top left (live only)
s += f'''
<div class="ver" id="ver" aria-hidden="true">{v}</div>
<style>
.ver {{ position: fixed; z-index: 45; left: calc(10px + env(safe-area-inset-left, 0px)); top: calc(8px + env(safe-area-inset-top, 0px));
  font: 400 10px/1 "Inter", ui-sans-serif, system-ui, sans-serif; letter-spacing: .04em; font-variant-numeric: tabular-nums;
  color: #fff; mix-blend-mode: difference; opacity: .7; pointer-events: none; user-select: none; }}
/* only on the homepage: hidden while About or Cases is open */
body:has(#info:not([hidden])) .ver, body:has(#cases:not([hidden])) .ver {{ display: none; }}
</style>
<script>
(() => {{
  const el = document.getElementById('ver'), V = {v!r};
  let seen = false; try {{ seen = localStorage.getItem('mv') === '1'; }} catch (e) {{}}
  fetch('/api/count', {{ method: seen ? 'GET' : 'POST' }}).then(r => r.json()).then(d => {{
    if (typeof d.n !== 'number') return;
    el.textContent = V + ' \\u2013 ' + d.n;
    if (!seen) try {{ localStorage.setItem('mv', '1'); }} catch (e) {{}}
  }}).catch(() => {{}});
}})();
</script>
</body></html>
'''
(root / 'index.html').write_text(s)
print('version', v)
