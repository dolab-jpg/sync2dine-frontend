#!/usr/bin/env python3
import re
import urllib.request
html = urllib.request.urlopen('https://sync2dine.io/?audit=2', timeout=30).read().decode('utf-8', 'ignore')
open('/tmp/home.html','w').write(html)
html2 = re.sub(r'<script[\s\S]*?</script>', '', html, flags=re.I)
html2 = re.sub(r'<style[\s\S]*?</style>', '', html2, flags=re.I)
text = re.sub(r'<[^>]+>', '\n', html2)
lines = [l.strip() for l in re.sub(r'\n+', '\n', text).split('\n') if l.strip()]
skip = re.compile(r'^(Home|Menu|Skip|Cookie|Privacy|Terms|Insights|How It Works|Contact Us|Strategic Audio|AI Phone)', re.I)
visible = [l for l in lines if len(l) > 2 and not skip.match(l)]
print('bytes', len(html))
print('visible_lines', len(visible))
print('word_est', sum(len(l.split()) for l in visible))
print('s2d_ids', re.findall(r'id="(s2d-[^"]+)"', html))
print('e_con_parent', html.count('e-con-parent'))
print('---COPY SAMPLE---')
for l in visible:
    if re.search(r'£|slash|Atmosphere|Judie|TRANSFORM|pricing|Launch|weekly|Enquire|We.ve slashed|Curated music', l, re.I) or (len(l) > 80 and len(l) < 200):
        print(l[:200])
