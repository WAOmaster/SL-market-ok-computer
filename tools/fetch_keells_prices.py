#!/usr/bin/env python3
"""
Put a price against every Keells item code.

    python tools/fetch_keells_prices.py [catalogue.json] [out.json]

The sitemap gives item codes and names for the whole shop but no prices.
`GetProductDetails` gives the rest, and it is public - no session, no header,
plain HTTP - so this is the same request a product page makes when anyone opens
it. Verified against evidence collected in the store: item 124575 comes back at
Rs 1,315.00, matching the shelf ticket photographed under it, and 9726 at
Rs 270.00, matching the 29-Aug till receipt.

BEING A GOOD GUEST IS THE POINT HERE. Ten thousand requests against a
supermarket's site deserves care, so this one:

  - runs a handful at a time, with a delay, rather than as fast as it can
  - identifies itself honestly in the User-Agent
  - saves as it goes and skips what it already has, so an interrupted run
    resumes instead of starting the whole thing again
  - backs off and gives up on repeated failures rather than hammering

Re-run it whenever prices need refreshing; with the resume file in place it
only fetches what changed or what it never reached.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = ('https://zebraliveback.keellssuper.com/1.0/WebV2/GetProductDetails'
       '?itemCode={code}&locationCode={outlet}')
UA = 'SLScan-price-lookup/1.0 (personal shopping-list app for one shopper)'

OUTLET = os.environ.get('KEELLS_OUTLET', 'SCDR')
WORKERS = 4          # a handful at a time, not a flood
PAUSE = 0.25         # seconds each worker waits between products
FAIL_LIMIT = 40      # consecutive failures that mean "stop, something is wrong"

consecutive_failures = 0


def fetch_one(code):
    """Return a catalogue row, or None. Never raises - a miss is not fatal."""
    global consecutive_failures
    url = API.format(code=code, outlet=OUTLET)
    req = urllib.request.Request(url, headers={'User-Agent': UA,
                                               'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode('utf-8', 'replace')
        if not body:
            consecutive_failures += 1
            return None
        result = json.loads(body).get('result') or {}
        detail = result.get('itemDetail') or {}
    except (urllib.error.URLError, ValueError, TimeoutError):
        consecutive_failures += 1
        return None

    consecutive_failures = 0
    time.sleep(PAUSE)

    # Keells pads names out to a fixed width with spaces; a product with no
    # price is not sold here and would be a fake row in the catalogue.
    name = str(detail.get('name') or '').strip()
    listed = float(detail.get('amount') or 0)
    if not name or listed <= 0:
        return None

    # `amount` is the price BEFORE any promotion. The shelf ticket shows the
    # discounted one - item 128797 lists at 790.00 with a promotionDiscountValue
    # of 158.00, and the ticket photographed under it reads Rs 632.00. Saving
    # `amount` would overprice every promoted item by exactly its discount,
    # which is most of the gap between a trolley estimate and the real bill.
    discount = float(detail.get('promotionDiscountValue') or 0)
    price = listed - discount if detail.get('isPromotionApplied') else listed
    if price <= 0:
        price = listed
        discount = 0.0

    row = {
        'itemCode': str(detail.get('itemCode') or code).lstrip('0') or code,
        'name': name,
        'price': round(price, 2),
        'uom': 'KG' if detail.get('uom') == 'KG' else 'NO',
        'category': detail.get('categoryCode') or '',
        'available': bool(detail.get('isAvailable', True)),
    }
    if discount > 0:
        row['wasPrice'] = round(listed, 2)
        row['discount'] = round(discount, 2)
    offers = [str(o.get('description') or '').strip()
              for o in (result.get('itemOfferDetailList') or [])
              if o.get('description')]
    if offers:
        # Multi-buy and basket-value offers, which the shelf price does not
        # reflect. Worth keeping: they are part of why a bill lands under the
        # shelf total, and the scanner can say "may qualify for ...".
        row['offers'] = offers
    return row


def load_json(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save(out_path, rows):
    doc = {
        'format': 'slscan.keells-catalogue.v1',
        'source': 'keellssuper.com GetProductDetails (public product endpoint)',
        'outlet': OUTLET,
        'capturedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'count': len(rows),
        'items': sorted(rows.values(), key=lambda r: r['itemCode']),
    }
    tmp = out_path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    os.replace(tmp, out_path)


def main(argv):
    src = argv[0] if argv else 'tools/fixtures/keells-catalogue-sitemap.json'
    out = argv[1] if len(argv) > 1 else 'tools/fixtures/keells-catalogue-priced.json'

    codes = [str(i['itemCode']) for i in load_json(src, {'items': []})['items']]
    have = {r['itemCode']: r for r in load_json(out, {'items': []})['items']}
    todo = [c for c in codes if c not in have]

    print(f'{len(codes)} item codes, {len(have)} already priced, {len(todo)} to fetch')
    if not todo:
        print('nothing to do')
        return 0
    print(f'{WORKERS} at a time, {PAUSE}s apart, outlet {OUTLET}\n')

    done = 0
    started = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for row in pool.map(fetch_one, todo):
            done += 1
            if row:
                have[row['itemCode']] = row
            if done % 200 == 0:
                rate = done / max(1e-9, time.time() - started)
                left = (len(todo) - done) / max(1e-9, rate)
                print(f'  {done:>6}/{len(todo)}  priced {len(have):>6}  '
                      f'~{left/60:.0f} min left', flush=True)
                save(out, have)
            if consecutive_failures >= FAIL_LIMIT:
                print(f'\n{FAIL_LIMIT} failures in a row - stopping and keeping '
                      f'what we have. Re-run to resume.', file=sys.stderr)
                break

    save(out, have)
    print(f'\nwrote {len(have)} priced products -> {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
