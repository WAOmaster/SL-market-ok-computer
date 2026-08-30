#!/usr/bin/env python3
"""
Turn Keells' sitemap into a catalogue of item codes and names.

    python tools/parse_keells_sitemap.py [sitemap.xml] [out.json]
    # fetches the sitemap itself if no local copy is given

Every product URL in the sitemap carries both halves we need:

    productDetail?itemcode=112840&MD_NECTAR_ORANGE_1L
                           ^^^^^^ ^^^^^^^^^^^^^^^^^^^
                           the till's key   the product

That is the whole catalogue - 10,000-odd products - from a single file the site
publishes for automated clients and advertises in its own robots.txt. No
crawling, no pagination, no session.

WHAT IT DOES NOT GIVE IS PRICE, and that is fine. Price is the part that
changes weekly and the part we already get exactly: from the shopper's till
receipt, and from the shelf ticket they point a camera at. What the sitemap
supplies is identity at full coverage, which is what the barcode matcher needs
to work against and what lets a scanned ticket be NAMED even when its price is
not known yet.

Names arrive in the URL slug as the till writes them - underscores for spaces,
sometimes abbreviated - which is the same shape the matcher already normalises
for bill lines.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

SITEMAP_URL = 'https://www.keellssuper.com/sitemap.xml'
UA = 'SLScan-catalogue/1.0 (personal shopping-list app; reads the published sitemap)'

# productDetail?itemcode=112840&MD_NECTAR_ORANGE_1L  (& may be XML-escaped)
PRODUCT_RE = re.compile(
    r'itemcode=(\d+)(?:&amp;|&)([^<\s]*)', re.IGNORECASE)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode('utf-8', 'replace')


def clean_name(slug):
    """
    `MD_NECTAR_ORANGE_1L` -> `MD NECTAR ORANGE 1L`.

    Percent-escapes and stray punctuation appear in a few slugs; leave the words
    themselves alone, because the matcher wants the till's own wording rather
    than a prettified version of it.
    """
    name = urllib.parse.unquote(slug or '')
    name = name.replace('_', ' ').replace('+', ' ')
    name = re.sub(r'\s+', ' ', name).strip(' -/')
    return name


def parse(xml_text):
    items = {}
    for code, slug in PRODUCT_RE.findall(xml_text):
        key = code.lstrip('0') or code
        name = clean_name(slug)
        # A slug that is only digits or empty tells us nothing a shopper could
        # read, and would poison name matching.
        if not name or name.isdigit() or len(name) < 3:
            continue
        if key not in items:
            items[key] = {'itemCode': key, 'name': name}
    return items


def main(argv):
    src = argv[0] if argv else None
    out = argv[1] if len(argv) > 1 else 'tools/fixtures/keells-catalogue-sitemap.json'

    if src and not src.endswith('.json'):
        xml_text = open(src, encoding='utf-8', errors='replace').read()
        origin = src
    else:
        print(f'fetching {SITEMAP_URL} ...')
        xml_text = fetch(SITEMAP_URL)
        origin = SITEMAP_URL

    items = parse(xml_text)
    if len(items) < 500:
        print(f'only {len(items)} products - that is not the whole sitemap, '
              f'refusing to write', file=sys.stderr)
        return 1

    doc = {
        'format': 'slscan.keells-catalogue.v1',
        'source': f'{origin} (item codes and names; prices come from tickets and bills)',
        'capturedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'count': len(items),
        'items': sorted(items.values(), key=lambda i: i['itemCode']),
    }
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f'wrote {len(items)} products -> {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
