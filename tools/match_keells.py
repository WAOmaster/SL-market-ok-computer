#!/usr/bin/env python3
"""
Join the barcode table to the Keells catalogue, so a scanned packet shows the
exact Keells shelf price rather than an estimate.

    barcodes.json     barcode -> product name        (globalfoodcity mirror)
    keells-catalogue  name -> item code -> price     (One Market's Keells scrape)
                 match on name
    prices.json       barcode -> item code -> price  <- what the scanner reads

Why a join at all: no source anywhere maps a barcode to a Keells price. Keells'
site does not index EAN-13 at all - searching one returns "no results" - and
neither do Cargills or SPAR. The two halves exist separately and nowhere
together, so the table has to be built, once, offline.

Normalisation follows One Market's productMatchingService: fix the till's
abbreviations, pull the quantity out, drop the brand and the marketing noise,
compare what is left.

THE RULE THAT MATTERS: quantity and unit must agree exactly. "Maliban Lemon
Puff 200g" and "Maliban Lemon Puff 400g" are different SKUs at different
prices, and a matcher that treats them as one charges the shopper for the wrong
packet. Everything else here is a heuristic; this is not.
"""
import json, re, sys, unicodedata
from difflib import SequenceMatcher

# Till descriptions are abbreviated to fit a receipt; product listings are not.
SPELLING = {
    'pwd': 'powder', 'pdr': 'powder', 'pwdr': 'powder', 'coc': 'coconut',
    'chix': 'chicken', 'chkn': 'chicken', 'brn': 'brown', 'wht': 'white',
    'org': 'organic', 'veg': 'vegetable', 'vegs': 'vegetables',
    'tom': 'tomato', 'pot': 'potato', 'basmathi': 'basmati',
    'h/wash': 'handwash', 'f/c': 'full cream', 's/l': 'sliced',
    'w/m': 'whole milk', 'ltr': 'l', 'uht': 'uht', 'btl': 'bottle',
}

# Words that describe packaging or puffery, not the product.
NOISE = re.compile(
    r'\b(fresh|premium|quality|best|super|special|pack|packet|value|offer|bag|'
    r'box|bottle|can|tin|jar|pouch|sachet|tetra|imported|local|sri lankan|'
    r'ceylon|new|original)\b', re.I)

QTY = re.compile(r'(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|mg|l|ltr|ltrs|litre|ml|cl|'
                 r'pcs|pc|nos|rolls?|pack|x)\b', re.I)

UNIT_CANON = {
    'kgs': 'kg', 'gm': 'g', 'gms': 'g', 'ltr': 'l', 'ltrs': 'l', 'litre': 'l',
    'pc': 'pcs', 'nos': 'pcs', 'roll': 'rolls',
}
# Grams and millilitres are the same number on a label often enough that
# comparing 200G against 200ML would look like a match. They are not - keep the
# dimension, only fold synonyms of the same dimension together.
TO_BASE = {'kg': ('mass', 1000.0), 'g': ('mass', 1.0), 'mg': ('mass', 0.001),
           'l': ('vol', 1000.0), 'ml': ('vol', 1.0), 'cl': ('vol', 10.0),
           'pcs': ('count', 1.0), 'rolls': ('count', 1.0)}


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s)
                   if not unicodedata.combining(c))


def extract_quantity(text):
    """Return (base_value, dimension, text_without_quantity).

    A '10X' multiplier ("HARPIC POWER PLUS 10X 500ML") is a marketing claim,
    not a size, so it is dropped rather than read as a quantity.
    """
    text = re.sub(r'\b\d+\s*x\b', ' ', text, flags=re.I)
    best = None
    for m in QTY.finditer(text):
        unit = UNIT_CANON.get(m.group(2).lower(), m.group(2).lower())
        if unit not in TO_BASE:
            continue
        dim, mult = TO_BASE[unit]
        # The largest stated size is the pack size; a "2 x 100g" style trailing
        # number is usually the smaller one.
        cand = (float(m.group(1)) * mult, dim, m.group(0))
        if best is None or cand[0] > best[0]:
            best = cand
    if not best:
        return None, None, text
    return best[0], best[1], text.replace(best[2], ' ')


def normalize(name):
    """Reduce a product name to the words that identify the product itself."""
    t = strip_accents(str(name or '')).lower().strip()
    t = t.replace('&', ' and ')
    for abbrev, full in SPELLING.items():
        t = re.sub(r'(?<![a-z])' + re.escape(abbrev) + r'(?![a-z])', full, t)
    qty, dim, t = extract_quantity(t)
    t = NOISE.sub(' ', t)
    t = re.sub(r'[^a-z0-9\s]', ' ', t)
    tokens = [w for w in t.split() if len(w) > 1]
    return {'tokens': sorted(set(tokens)), 'text': ' '.join(tokens),
            'qty': qty, 'dim': dim}


def quantities_agree(a, b):
    """Both sides silent about size = fine. Both stated = must be equal."""
    if a['qty'] is None and b['qty'] is None:
        return True
    if a['qty'] is None or b['qty'] is None:
        return False
    if a['dim'] != b['dim']:
        return False
    return abs(a['qty'] - b['qty']) < 0.001


def token_score(a, b):
    """Jaccard on the identifying words, nudged by raw string similarity."""
    sa, sb = set(a['tokens']), set(b['tokens'])
    if not sa or not sb:
        return 0.0
    jac = len(sa & sb) / len(sa | sb)
    seq = SequenceMatcher(None, a['text'], b['text']).ratio()
    return 0.7 * jac + 0.3 * seq


def match(barcodes, catalogue, threshold=0.62):
    """
    Compare every barcode name against the catalogue.

    Done naively this is one string-similarity call per pair - 5,875 barcodes
    against 10,000 products is sixty million of them, which does not finish in
    any useful time. Two prunings fix that without changing a single result:

      * Only consider products sharing at least one word. With no shared word
        the Jaccard term is zero and the score cannot exceed 0.3, which is below
        any usable threshold, so those pairs were never going to match.
      * Skip the expensive sequence comparison when even a perfect result could
        not beat the best score so far.
    """
    cat = []
    for item in catalogue:
        n = normalize(item['name'])
        if n['tokens']:
            cat.append((item, n))

    by_token = {}
    for idx, (_, n) in enumerate(cat):
        for tok in n['tokens']:
            by_token.setdefault(tok, []).append(idx)

    out, stats = {}, {'exact': 0, 'quantity': 0, 'fuzzy': 0, 'unmatched': 0,
                      'rejected_quantity': 0}
    for p in barcodes:
        bn = normalize(p['name'])
        if not bn['tokens']:
            stats['unmatched'] += 1
            continue

        candidates = set()
        for tok in bn['tokens']:
            candidates.update(by_token.get(tok, ()))

        best, best_score, blocked = None, 0.0, False
        sa = set(bn['tokens'])
        for idx in candidates:
            item, cn = cat[idx]
            sb = set(cn['tokens'])
            jac = len(sa & sb) / len(sa | sb)
            # Best possible score if the string similarity came back perfect.
            if 0.7 * jac + 0.3 <= best_score:
                continue
            score = 0.7 * jac + 0.3 * SequenceMatcher(None, bn['text'], cn['text']).ratio()
            if score <= best_score:
                continue
            if not quantities_agree(bn, cn):
                # Same words, different size: a real product, wrong packet.
                if score >= threshold:
                    blocked = True
                continue
            best, best_score = (item, cn), score

        if not best or best_score < threshold:
            stats['rejected_quantity' if blocked else 'unmatched'] += 1
            continue

        item, cn = best
        method = ('exact' if best_score >= 0.995
                  else 'quantity' if cn['qty'] is not None and best_score >= 0.85
                  else 'fuzzy')
        stats[method] += 1
        # A catalogue row may have no price. The sitemap gives item codes and
        # names for the whole shop but no prices, and that is still worth
        # matching: it establishes barcode -> item code, which is the link
        # nothing published provides. The price arrives later from a shelf
        # ticket or a bill, and lands on a product we can already name.
        price = float(item.get('price') or 0)
        out[p['code']] = {
            'itemCode': item['itemCode'],
            'name': item['name'],
            'price': round(price, 2),
            'uom': item.get('uom', 'NO'),
            'method': method,
            'confidence': round(best_score, 3),
            'scannedName': p['name'],
        }
        # Carry the promotion through. `price` is already what the till will
        # charge, so this is not needed to be correct - it is needed for the
        # shopper to SEE they are getting a deal, which is half of why anyone
        # checks a price in the aisle.
        for extra in ('wasPrice', 'discount', 'offers'):
            if item.get(extra):
                out[p['code']][extra] = item[extra]


    return flag_collisions(out, stats)


def flag_collisions(out, stats):
    """
    Two barcodes claiming the same Keells item code cannot both be that packet.

    Sometimes it is innocent - one product, reissued barcode. Sometimes it is
    two real variants ("Sunlight Matic 1L" and "Sunlight Matic 1L Rose Value
    Pack") collapsing onto whichever one the catalogue happens to list. The
    matcher cannot tell those apart, so it does not pretend to: the best-scoring
    barcode keeps the match cleanly and the rest are marked ambiguous. They
    still show a price - it is the right price for *a* packet of that item - but
    the scanner labels it, and the bill settles it for good.
    """
    by_item = {}
    for code, m in out.items():
        by_item.setdefault(m['itemCode'], []).append(code)

    for item_code, codes in by_item.items():
        if len(codes) < 2:
            continue
        codes.sort(key=lambda c: out[c]['confidence'], reverse=True)
        for c in codes[1:]:
            out[c]['ambiguous'] = True
            stats['ambiguous'] = stats.get('ambiguous', 0) + 1
    return out, stats


def load_catalogues(paths):
    """
    Merge catalogues, earliest wins.

    Order is the point, and the right order is FRESHEST FIRST.

    Put the live catalogue ahead of the hand-built fixture. Both are true, but
    they answer different questions: the fixture holds a bill's LINE price,
    which is gross, while the live endpoint knows the promotion running today.
    Maliban Lemon Puff bills at 270 and then has 68 taken off it further down
    the receipt as a Nexus discount - 202 is what the card was charged, and 202
    is what a shopper wants to see in the aisle.

    The fixture still earns its place behind it. Item 128519 is not in the
    sitemap at all, so without the shelf ticket that product would have no
    price from any source.

    Checked both ways against eight products photographed or billed in store:
    freshest-first agrees with all eight, fixture-first with six.
    """
    merged, sources, captured = {}, [], ''
    for path in paths:
        doc = json.load(open(path, encoding='utf-8'))
        sources.append(doc.get('source', path))
        captured = captured or doc.get('capturedAt', '')
        for item in doc['items']:
            code = str(item['itemCode']).lstrip('0') or str(item['itemCode'])
            if code not in merged:
                merged[code] = item
    return list(merged.values()), ' + '.join(sources), captured


def main(barcodes_path, catalogue_path, out_path):
    barcodes = json.load(open(barcodes_path, encoding='utf-8'))['products']
    paths = [p.strip() for p in str(catalogue_path).split(',') if p.strip()]
    catalogue, merged_source, merged_captured = load_catalogues(paths)
    cat_doc = json.load(open(paths[0], encoding='utf-8'))
    cat_doc['source'] = merged_source
    cat_doc['capturedAt'] = cat_doc.get('capturedAt') or merged_captured

    prices, stats = match(barcodes, catalogue)

    # Every catalogue row, keyed by item code. A shelf-edge tag scans as its
    # item code, so this prices a product the moment the shopper points the
    # camera at the ticket - no name matching involved, and it covers the whole
    # catalogue rather than only the rows a barcode happened to match.
    items = {}
    for it in catalogue:
        code = str(it['itemCode']).lstrip('0') or str(it['itemCode'])
        row = {
            'name': it['name'],
            'price': round(float(it.get('price') or 0), 2),
            'uom': it.get('uom', 'NO'),
        }
        for extra in ('wasPrice', 'discount', 'offers'):
            if it.get(extra):
                row[extra] = it[extra]
        # Keep a row even with no price. A ticket for it can then say
        # "KEELLS TURMERIC POWDER 100G - price not known yet" instead of
        # "unknown item code", which is the difference between a named line the
        # bill can settle and a dead end in the aisle.
        items[code] = row

    doc = {
        'format': 'slscan.prices.v1',
        'store': 'keells',
        'outlet': cat_doc.get('outlet', ''),
        'source': cat_doc.get('source', ''),
        'catalogueCapturedAt': cat_doc.get('capturedAt', ''),
        'builtAt': __import__('time').strftime('%Y-%m-%dT%H:%M:%SZ',
                                               __import__('time').gmtime()),
        'count': len(prices),
        'itemCount': len(items),
        'prices': prices,
        'items': items,
    }
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))

    print(f"barcodes {len(barcodes)}  x  keells catalogue {len(catalogue)}")
    for k, v in stats.items():
        print(f"  {k:20} {v}")
    print(f"wrote {len(prices)} priced barcodes -> {out_path}")
    return 0


if __name__ == '__main__':
    a = sys.argv[1:]
    sys.exit(main(a[0] if a else 'scanner/data/barcodes.json',
                  a[1] if len(a) > 1 else 'tools/fixtures/keells-catalogue.json',
                  a[2] if len(a) > 2 else 'scanner/data/prices.json'))
