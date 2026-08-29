"""
Endpoints for the Cart Scan supermarket scanner app.

The app works entirely offline against browser storage; these endpoints are the
optional shared layer, so a product named on one phone is priced on every other
and a finished trip can be kept beyond the life of a browser cache.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

# In-store scale labels here start 91/92 and carry the net weight in grams.
SCALE_PREFIXES = ("91", "92")


def _ean13_check_digit(body: str) -> int:
    """Check digit for the first twelve digits of an EAN-13."""
    total = 0
    for i, char in enumerate(reversed(body)):
        total += int(char) * (3 if i % 2 == 0 else 1)
    return (10 - total % 10) % 10


def decode_scale_label(code: str) -> Optional[dict]:
    """
    Split a scale label into its item code and net weight.

    ``9230101012188`` -> item 923010, internal check digit 1, 1.218 kg, check 8.
    Returns None when the code is not a scale label.
    """
    digits = "".join(c for c in str(code or "") if c.isdigit())
    if len(digits) != 13 or not digits.startswith(SCALE_PREFIXES):
        return None

    weight_kg = int(digits[7:12]) / 1000
    if not 0 < weight_kg <= 40:
        return None

    return {
        "itemCode": digits[:6],
        "weightKg": round(weight_kg, 3),
        "checkDigitOk": _ean13_check_digit(digits[:12]) == int(digits[12]),
    }


def _product_out(row: models.ScannerProduct) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "unitPrice": row.unit_price,
        "pricing": row.pricing,
        "unit": row.unit,
        "category": row.category,
        "updatedAt": row.updated_at or row.created_at,
    }


def _item_out(row: models.ScanSessionItem) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "barcode": row.barcode,
        "name": row.name,
        "category": row.category,
        "pricing": row.pricing,
        "qty": row.quantity,
        "weightKg": row.weight_kg,
        "unitPrice": row.unit_price,
        "lineTotal": row.line_total,
        "source": row.source,
    }


def _session_out(row: models.ScanSession) -> dict:
    return {
        "id": row.id,
        "client_id": row.client_id,
        "store": row.store,
        "currency": row.currency,
        "subtotal": row.subtotal,
        "discount": row.discount,
        "tax": row.tax,
        "total": row.total,
        "item_count": row.item_count,
        "started_at": row.started_at,
        "created_at": row.created_at,
        "items": [_item_out(i) for i in row.items],
    }


@router.get("/catalog", response_model=schemas.ScannerCatalog)
async def get_catalog(
    search: Optional[str] = Query(None, description="Filter by name, code or category"),
    db: Session = Depends(get_db),
):
    """
    The shared product catalog the app imports on connect.

    - **search**: optional filter applied to name, code and category
    """
    query = db.query(models.ScannerProduct)
    if search:
        like = f"%{search}%"
        query = query.filter(
            models.ScannerProduct.name.ilike(like)
            | models.ScannerProduct.code.ilike(like)
            | models.ScannerProduct.category.ilike(like)
        )
    rows = query.order_by(models.ScannerProduct.name).all()
    return {"count": len(rows), "products": [_product_out(r) for r in rows]}


@router.post("/catalog", response_model=schemas.ScannerProduct, status_code=201)
async def upsert_product(
    payload: schemas.ScannerProductCreate,
    db: Session = Depends(get_db),
):
    """
    Add a product, or update the one already stored under this code.

    The app calls this every time a shopper names an unknown barcode, so the
    second device to meet that item already knows its price.
    """
    code = "".join(c for c in payload.code if c.isdigit())
    if not code:
        raise HTTPException(status_code=422, detail="A numeric code is required")

    row = (
        db.query(models.ScannerProduct)
        .filter(models.ScannerProduct.code == code)
        .first()
    )
    if row is None:
        row = models.ScannerProduct(code=code)
        db.add(row)

    row.name = payload.name.strip()
    row.unit_price = payload.unitPrice
    row.pricing = payload.pricing
    row.unit = payload.unit or ("kg" if payload.pricing == "weight" else "pc")
    row.category = payload.category or "Other"
    row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return _product_out(row)


@router.delete("/catalog/{code}", status_code=204)
async def delete_product(code: str, db: Session = Depends(get_db)):
    """Remove a product from the shared catalog."""
    row = (
        db.query(models.ScannerProduct)
        .filter(models.ScannerProduct.code == code)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(row)
    db.commit()
    return None


@router.get("/lookup/{code}")
async def lookup_code(code: str, db: Session = Depends(get_db)):
    """
    Resolve a scanned code to a product, and decode a scale label's weight.

    - **code**: the raw barcode, an embedded item code, or a PLU
    """
    digits = "".join(c for c in code if c.isdigit())
    if not digits:
        raise HTTPException(status_code=422, detail="A numeric code is required")

    label = decode_scale_label(digits)
    candidates = [digits]
    if label:
        candidates.append(label["itemCode"])
    if len(digits) == 12:
        candidates.append("0" + digits)

    product = (
        db.query(models.ScannerProduct)
        .filter(models.ScannerProduct.code.in_(candidates))
        .first()
    )

    line_total = None
    if product and label and product.pricing == "weight":
        line_total = round(label["weightKg"] * product.unit_price, 2)
    elif product and product.pricing == "unit":
        line_total = round(product.unit_price, 2)

    return {
        "code": digits,
        "label": label,
        "found": product is not None,
        "product": _product_out(product) if product else None,
        "lineTotal": line_total,
    }


@router.post("/sessions", response_model=schemas.ScanSession, status_code=201)
async def save_session(
    payload: schemas.ScanSessionCreate,
    db: Session = Depends(get_db),
):
    """
    Store a finished shopping trip.

    Line totals and the trip total are recalculated here rather than trusted, so
    a stale or edited client cannot save a basket that does not add up.
    """
    totals = payload.totals or schemas.ScanTotalsIn()

    session = models.ScanSession(
        client_id=payload.id,
        store=payload.store,
        currency=totals.currency or "Rs.",
        started_at=payload.startedAt,
    )

    subtotal = 0.0
    item_count = 0
    for item in payload.items:
        line_total = round(item.lineTotal, 2)
        if not line_total:
            line_total = round(
                item.weightKg * item.unitPrice
                if item.pricing == "weight"
                else item.qty * item.unitPrice,
                2,
            )
        subtotal += line_total
        item_count += 1 if item.pricing == "weight" else item.qty

        session.items.append(
            models.ScanSessionItem(
                code=item.code,
                barcode=item.barcode,
                name=item.name,
                category=item.category,
                pricing=item.pricing,
                quantity=item.qty,
                weight_kg=item.weightKg,
                unit_price=item.unitPrice,
                line_total=line_total,
                source=item.source,
            )
        )

    session.subtotal = round(subtotal, 2)
    session.discount = round(min(totals.discount, session.subtotal), 2)
    session.tax = round(totals.tax, 2)
    session.total = round(session.subtotal - session.discount + session.tax, 2)
    session.item_count = item_count

    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_out(session)


@router.get("/sessions", response_model=List[schemas.ScanSession])
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Recent shopping trips, newest first."""
    rows = (
        db.query(models.ScanSession)
        .order_by(models.ScanSession.id.desc())
        .limit(limit)
        .all()
    )
    return [_session_out(r) for r in rows]


@router.get("/sessions/{session_id}", response_model=schemas.ScanSession)
async def get_session(session_id: int, db: Session = Depends(get_db)):
    """One saved shopping trip with all of its lines."""
    row = (
        db.query(models.ScanSession)
        .filter(models.ScanSession.id == session_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Scan session not found")
    return _session_out(row)
