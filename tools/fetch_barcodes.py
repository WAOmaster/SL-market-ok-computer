#!/usr/bin/env python3
"""
Build the offline barcode -> product table the scanner uses to name an unknown
packet without asking the shopper.

Source: globalfoodcity.com's WooCommerce Store API, which is public and — unlike
every supermarket we tested (Keells, Cargills, SPAR all return "no results" for
an EAN-13) — stores the real barcode in its SKU field.

Pulled ONCE into a file we ship, not called per scan. Three reasons: the shop is
a small business and hammering it would be rude, a supermarket aisle has poor
signal, and a local table cannot break at the till.

Prices are deliberately NOT kept. They run 5-10% below Keells, so they would be
wrong at the shelf. This table answers "what is this packet", never "what does
it cost" - that comes from the shop you are standing in.
"""
import json, sys, time, urllib.request, urllib.error

API = "https://globalfoodcity.com/wp-json/wc/store/v1/products"
UA = "SLScan-catalog-builder/1.0 (personal shopping-list app; one-off catalogue pull)"
PER_PAGE = 100
DELAY = 1.0          # be a good citizen: one request per second


def get(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            if attempt == tries - 1:
                raise
            time.sleep(2 * (attempt + 1))
    return None


def is_barcode(sku):
    sku = (sku or "").strip()
    return sku.isdigit() and len(sku) in (8, 12, 13, 14)


def load_existing(path):
    """Previous table, so an incremental run only has to look at the new tail."""
    try:
        with open(path, encoding="utf-8") as f:
            return {p["code"]: p for p in json.load(f).get("products", [])}
    except (OSError, ValueError):
        return {}


def main(out_path, max_pages=200, incremental=False):
    """
    Full run walks the whole catalogue. Incremental walks it newest-first and
    stops as soon as a page adds nothing, which in practice is one request.

    Worth knowing why that is safe: this table holds *identity* - barcode, name,
    category, image - and a barcode is bound to its product permanently. Names
    and categories do not drift. Prices do, which is exactly why prices are not
    kept here. So the only thing a repeat run can discover is products that did
    not exist last time, and those sort to the front.
    """
    seen = load_existing(out_path) if incremental else {}
    before = len(seen)
    page = 1
    while page <= max_pages:
        try:
            # orderby=id is not decoration. The Store API's default ordering is
            # not stable across requests, so products shuffle between pages: a
            # first crawl saw page 46 return 100 products and zero new barcodes,
            # and silently lost items that were provably in the catalogue.
            order = "date&order=desc" if incremental else "id&order=asc"
            batch = get(f"{API}?per_page={PER_PAGE}&page={page}&orderby={order}")
        except Exception as e:
            print(f"  page {page} failed after retries: {e} - stopping early", file=sys.stderr)
            break
        if not batch:
            break
        found_before = len(seen)
        for p in batch:
            sku = (p.get("sku") or "").strip()
            if not is_barcode(sku) or sku in seen:
                continue
            cats = [c["name"] for c in (p.get("categories") or [])]
            imgs = p.get("images") or []
            seen[sku] = {
                "code": sku,
                "name": (p.get("name") or "").strip(),
                "category": cats[0] if cats else "",
                "image": imgs[0].get("src", "") if imgs else "",
            }
        added = len(seen) - found_before
        print(f"  page {page:>3}  +{len(batch):>3} products  ->  {len(seen)} barcodes"
              f"{f' (+{added} new)' if incremental else ''}", flush=True)
        # Newest-first: a page with nothing new means everything after it is
        # older still, so there is no reason to keep asking.
        if incremental and added == 0:
            break
        if len(batch) < PER_PAGE:
            break
        page += 1
        time.sleep(DELAY)

    table = {
        "format": "slscan.barcodes.v1",
        "source": "globalfoodcity.com (WooCommerce Store API)",
        "note": "identity only - names/categories/images. Prices come from the shop you are in.",
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(seen),
        "products": sorted(seen.values(), key=lambda x: x["code"]),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(table, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(seen)} barcodes -> {out_path}"
          + (f" ({len(seen) - before} new)" if incremental else ""))
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = args[0] if args else "scanner/data/barcodes.json"
    sys.exit(main(out, incremental="--incremental" in sys.argv))
