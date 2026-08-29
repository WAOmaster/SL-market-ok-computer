# Cart Scan - supermarket item scanner

Scan what goes into the trolley, count it, price it, and see the running total
before you reach the till.

It is a separate app from the SL Market price tracker in this repository - that
one watches market prices over time, this one adds up a single shopping trip -
but it lives alongside it and can share the same backend.

```
scanner/
  index.html        the whole app (four tabs: Scan, Cart, Catalog, Settings)
  scanner.css       styles
  js/barcode.js     EAN-13 validation and scale-label decoding
  js/catalog.js     code -> product, stored in localStorage
  js/cart.js        lines, counts, weights, discounts, totals
  js/label.js       reads the printed text of a label (OCR post-processing)
  js/scanlog.js     what each scan did, failures included
  js/report.js      the whole trip as one JSON object
  js/scanner.js     camera, photo decoding, lazy-loaded OCR
  js/api.js         optional sync with the backend
  js/app.js         UI wiring
  tests/            node --test suites for the pure logic
```

## Running it

Any static server works; the camera needs HTTPS or localhost.

```bash
python3 -m http.server 8000
# then open http://localhost:8000/scanner/index.html
```

On a phone, serve it over HTTPS (or through a tunnel) or the browser will refuse
camera access. Without a camera, "Scan a photo" and the typed-code box do the
same job.

## How a scan becomes a line

1. A code arrives - from the camera, a photo, the typed box, or a USB/Bluetooth
   barcode gun, which simply types digits and presses Enter.
2. `barcode.parse` classifies it: a plain retail barcode, a bare PLU, or an
   in-store scale label with a weight baked into it.
3. `catalog.find` resolves it to a product. A known code is priced and added
   straight away. An unknown one asks for a name and a price **once**, then it is
   remembered for good.
4. `cart.add` either starts a new line or, for a packet already in the trolley,
   bumps its count.

### Scale labels

Loose produce is weighed in-store and gets a printed sticker whose barcode
carries the item and the weight. The sample labels in this repository decode as:

```
9 2 3 0 1 0 | 1 | 0 1 2 1 8 | 8
\__________/  |   \________/  |
   item       |     weight    EAN-13 check digit
   923010     |     1.218 kg
              internal check digit
```

`923010` is Banana Seeni at Rs. 240.00/kg, so the line total is
1.218 x 240.00 = **Rs. 292.32** - exactly what the sticker prints.

Shops encode these differently. Settings -> "Scale label format" lists the known
layouts and lets you pin one, and the box underneath decodes any barcode you
paste so you can check a new store's format in a few seconds. When more than one
layout fits, the reading that agrees with the catalog price wins.

### When the barcode will not scan

Produce stickers get creased inside a knotted bag. "Read label text" runs OCR
(Tesseract.js, downloaded on first use) over the sticker and pulls out the name,
weight, unit price and total. The values and their captions are printed on
separate rows, so the parser matches them by column position rather than by
proximity, and derives whichever of the three numbers is missing from the other
two. The result opens in the item dialog for you to confirm - OCR is a helper,
not an authority.

## Counting and totals

- **Packets** are counted: scanning the same barcode again shows `x2` rather
  than adding a second line. Turn that off in Settings if you would rather keep
  every scan separate.
- **Weighed produce** gets a line per pack, because every pack weighs something
  different.
- Any line's price can be typed straight off the label; the override wins over
  the arithmetic and the line is tagged `LABEL PRICE`.
- Totals apply a percentage discount and a fixed discount first, then tax - and
  a discount can never push the bill below zero. Sri Lankan shelf prices already
  include VAT, so tax defaults to 0.
- Set a budget and the header total turns amber once you pass it.

Export a trip as CSV or JSON, or print it as a receipt.

## Exporting a trip for analysis

The Cart tab's **Download JSON** and **Copy JSON** produce one object describing
the whole trip - not just what ended up in the trolley, but how it got there.
On a phone, **Copy JSON** is the one you want: a downloaded file is awkward to
get back out of a phone, and the clipboard is not.

```jsonc
{
  "format": "cart-scan.trip.v1",
  "generatedAt": "2026-08-29T14:14:06.112Z",
  "environment": { "userAgent": "...", "nativeBarcodeDetector": true, ... },
  "trip":   { "store": "...", "settings": {...}, "items": [...], "totals": {...} },
  "verification": {            // every line recomputed from its own parts
    "recomputedSubtotal": 2403.08,
    "reportedSubtotal": 2403.08,
    "subtotalAgrees": true,
    "disagreements": [],       // lines whose stored total drifted from the arithmetic
    "lines": [ { "name": "Banana - Seeni", "arithmetic": 292.32,
                 "overriddenTo": null, "reported": 292.32, "agrees": true } ]
  },
  "billCheck": {               // present once the till total is entered
    "tillTotal": 2400, "appTotal": 2403.08, "difference": -3.08, "matches": false,
    "note": "The app counted more than the till charged - ..."
  },
  "scanLog": {
    "summary": { "events": 7, "byOutcome": {"added": 4, "prompted": 1, "confirmed": 1, "rejected": 1},
                 "ruleHits": {"sl-weight-5": 4}, "checkDigitFailures": [], "unresolved": [...] },
    "events": [ { "seq": 1, "at": "...", "source": "camera", "engine": "native",
                  "raw": "9230101012188",
                  "parsed": { "type": "embedded", "valid": true, "itemCode": "923010",
                              "candidates": [ {"ruleId": "sl-weight-5", "kind": "weight",
                                               "weightKg": 1.218, "score": 130} ] },
                  "catalog": { "hit": true, "name": "Banana - Seeni", "unitPrice": 240 },
                  "outcome": "added",
                  "line": { "weightKg": 1.218, "unitPrice": 240, "lineTotal": 292.32 } } ]
  }
}
```

Three things make this worth reading after a test run:

- **The scan log keeps the failures.** Scans that were rejected, that needed a
  prompt, or that errored are recorded alongside the ones that worked, and the
  summary lists them under `unresolved`. A trip where everything worked is not
  the interesting case.
- **`verification` recomputes rather than repeats.** It adds the lines up from
  their own weights and prices instead of copying the app's totals, so a bug in
  the totalling shows up as a disagreement instead of being confirmed by itself.
  A line priced straight off the label is reported as `overriddenTo`, not as an
  error.
- **`billCheck` is the actual test.** Type what the till charged into "Check
  against the till" on the Cart tab, and the export carries the variance and
  which way it went - the app counting more usually means a double scan, the
  till charging more usually means a missed item or a stale catalog price.

Clearing the cart clears the scan log with it, so an export never mixes two
trips. `Settings -> Scan log` shows the running counts and can clear the log on
its own; the raw OCR text of each label read is only kept if you switch that on
there.

## Offline first

Everything - the catalog, the trolley, the settings - lives in `localStorage`.
The app is fully usable with no network at all, which is the normal condition in
a supermarket basement. If storage is unavailable (private mode, a sandboxed
frame) the app still runs; it just forgets between visits.

## Optional backend

With the FastAPI service in `backend/` running, put its URL in Settings and the
app will share its catalog and store finished trips:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/scanner/catalog` | the shared catalog (`?search=` filters it) |
| `POST` | `/api/scanner/catalog` | add or update a product by code |
| `DELETE` | `/api/scanner/catalog/{code}` | remove a product |
| `GET` | `/api/scanner/lookup/{code}` | resolve a code, decoding a scale label's weight |
| `POST` | `/api/scanner/sessions` | save a finished trip |
| `GET` | `/api/scanner/sessions` | recent trips |
| `GET` | `/api/scanner/sessions/{id}` | one trip with its lines |

Line totals are recalculated server side, so a stale client cannot save a basket
that does not add up.

## Tests

```bash
node --test "scanner/tests/*.test.js"      # barcode, cart and label logic
cd backend && python3 -m pytest tests/test_scanner.py -q
```

The camera and OCR layers need a real browser and are checked by hand; the
decoding, pricing and totalling logic they feed is covered by the suites above,
including the four sample labels reproducing their printed totals to the cent.

## Browser support

| | Barcode source |
| --- | --- |
| Chrome / Edge on Android, Chrome on desktop | native `BarcodeDetector`, no download |
| Firefox, Safari, iOS | ZXing, fetched from a CDN on first camera start |
| No camera at all | photo upload, typed codes, or a barcode gun |
