#!/usr/bin/env python3
"""
Self-check for the barcode -> Keells item-code matcher.

    python tools/test_match_keells.py

The ground truth is a real Keells bill (Panadura 3, 29-Aug-2026): every pair
below is a barcode that was scanned and the till line it produced, so a
regression here is a product that would be priced wrong in an aisle.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match_keells import normalize, quantities_agree, match, extract_quantity

CATALOGUE = [
    {"itemCode": "14163",  "name": "HARPIC POWER PLUS 10X 500ML",              "price": 480.0, "uom": "NO"},
    {"itemCode": "6591",   "name": "LIFEBUOY H/WASH TOTAL POUCH 180ML",        "price": 350.0, "uom": "NO"},
    {"itemCode": "128519", "name": "SUNLIGHT MATIC LIQUID POUCH 1L",           "price": 600.0, "uom": "NO"},
    {"itemCode": "23036",  "name": "HARISCHANDRA PLAIN NOODLES 400G",          "price": 280.0, "uom": "NO"},
    {"itemCode": "9726",   "name": "MALIBAN LEMON PUFF 200G",                  "price": 270.0, "uom": "NO"},
    {"itemCode": "92951",  "name": "AMBEWELA FULL CREAM UHT MILK TETRA 200ML", "price": 140.0, "uom": "NO"},
    {"itemCode": "915013", "name": "POTATOES",                                 "price": 390.0, "uom": "KG"},
]

# barcode, the name the offline table gives, the item code the bill proves
TRUTH = [
    ("4792037107741", "Harpic Toilet Cleaner Power Plus 500ml",   "14163"),
    ("4792081018024", "Lifebuoy Handwash Total 10 (180ml)",       "6591"),
    ("4792081044740", "SUNLIGHT MATIC LIQUID 1L ROSE VALUE PACK", "128519"),
    ("4792083010118", "Harischandra Noodles 400G",                "23036"),
    ("4791034017015", "Maliban Lemon Puff 200g",                  "9726"),
    ("4792116211109", "Ambewela Fresh Milk Full Cream 200ml",     "92951"),
]

failures = []


def check(label, cond, detail=""):
    if cond:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label} {detail}")
        failures.append(label)


print("every pair the bill proves:")
prices, stats = match([{"code": c, "name": n} for c, n, _ in TRUTH], CATALOGUE)
for code, name, expect in TRUTH:
    got = prices.get(code, {}).get("itemCode")
    check(f"{name[:34]:36} -> {expect}", got == expect, f"(got {got})")

print("\nthe rule that stops a wrong-packet price:")
# Same product, different size: must never match, at any similarity.
wrong_size = match([{"code": "X", "name": "Maliban Lemon Puff 400g"}], CATALOGUE)[0]
check("200g catalogue entry is refused for a 400g packet", "X" not in wrong_size,
      f"(matched {wrong_size.get('X', {}).get('itemCode')})")

# Grams vs millilitres are different dimensions, not the same number.
a, b = normalize("Coconut Oil 200ml"), normalize("Coconut Oil 200g")
check("200ml and 200g are not the same size", not quantities_agree(a, b))

# A "10X" claim is marketing, not a pack size - reading it as one loses Harpic.
qty, dim, _ = extract_quantity("harpic power plus 10x 500ml")
check("'10X 500ML' reads as 500ml, not 10", qty == 500.0 and dim == "vol",
      f"(got {qty} {dim})")

print("\nnothing is invented when there is no real match:")
junk = match([{"code": "Y", "name": "Nikado Baby Papadam 70g"}], CATALOGUE)[0]
check("an unrelated product stays unmatched", "Y" not in junk,
      f"(matched {junk.get('Y', {}).get('name')})")

print("\ntwo barcodes on one item code are flagged, not silently merged:")
dup, _ = match([
    {"code": "A", "name": "Sunlight Matic Liquid 1L"},
    {"code": "B", "name": "SUNLIGHT MATIC LIQUID 1L ROSE VALUE PACK"},
], CATALOGUE)
both = "A" in dup and "B" in dup
flagged = sum(1 for c in ("A", "B") if dup.get(c, {}).get("ambiguous"))
check("both priced, exactly one marked ambiguous", both and flagged == 1,
      f"(matched {list(dup)}, flagged {flagged})")

print()
if failures:
    print(f"{len(failures)} FAILED: {failures}")
    sys.exit(1)
print("all checks passed")
