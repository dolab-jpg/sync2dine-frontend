#!/usr/bin/env python3
import re, urllib.request
html = urllib.request.urlopen('https://sync2dine.io/', timeout=30).read().decode('utf-8','ignore')
# headings
hs = re.findall(r'<h[1-3][^>]*>([\s\S]*?)</h[1-3]>', html, re.I)
def clean(t):
    t=re.sub(r'<[^>]+>','',t)
    return re.sub(r'\s+',' ',t).strip()
print('HEADINGS:')
for h in hs:
    c=clean(h)
    if c and len(c)<120: print('-', c)
print('WIDGET_TYPES', len(re.findall(r'data-widget_type="([^"]+)"', html)))
print('CONTAINERS', html.count('data-elementor-type'))
