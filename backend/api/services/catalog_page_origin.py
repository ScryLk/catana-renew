"""Current sequence is mutable. Retained import evidence is not."""

import copy
import json
import hashlib
from rest_framework.exceptions import ValidationError

ORIGINS = {"imported_source", "catana_authored", "derived_from_import"}


def catalog_pages(catalog):
    return [
        copy.deepcopy(p)
        for s in catalog.spreads.order_by("spread_index")
        for side in (s.left_page_elements, s.right_page_elements)
        for p in (side if isinstance(side, list) else [])
        if isinstance(p, dict)
    ]


def origin(page, catalog=None):
    value = page.get("pageOrigin")
    if isinstance(value, str) and value in ORIGINS:
        return value
    if value is not None:
        raise ValidationError({"code": "invalid_structure"})
    return (
        "imported_source"
        if catalog and catalog.import_metadata and page.get("documentPage")
        else "catana_authored"
    )


def source_number(page):
    doc = page.get("documentPage") or {}
    if not isinstance(doc, dict):
        raise ValidationError({"code": "invalid_structure"})
    return page.get("sourcePageNumber", page.get("sourcePage", doc.get("pageNumber")))


def source_previews(catalog):
    job = catalog.source_import
    if job.previews:
        return job.previews
    from api.services.document_reconstructor import DocumentReconstructorService

    return (
        DocumentReconstructorService._document_pages(job.document_ir, job.mode)
        if isinstance(job.document_ir.get("pages"), list)
        else []
    )


def normalize_page(page, catalog):
    page = copy.deepcopy(page)
    kind = origin(page, catalog)
    page["pageOrigin"] = kind
    if kind != "catana_authored":
        job = catalog.source_import
        number = source_number(page)
        if type(number) is not int or not 1 <= number <= len(source_previews(catalog)):
            raise ValidationError({"code": "source_integrity_violation"})
        expected = {
            "sourceImportId": str(job.pk),
            "sourcePageNumber": number,
            "sourceFingerprint": job.source_fingerprint,
            "sourcePageFingerprint": hashlib.sha256(
                json.dumps(
                    job.document_ir["pages"][number - 1],
                    sort_keys=True,
                    ensure_ascii=False,
                ).encode()
            ).hexdigest(),
        }
        for key, value in expected.items():
            if key in page and page[key] != value:
                raise ValidationError({"code": "source_integrity_violation"})
        page.update(expected)
    else:
        if any(
            page.get(k) is not None
            for k in (
                "sourceImportId",
                "sourcePageNumber",
                "sourceFingerprint",
                "sourcePageFingerprint",
                "derivedFromPageId",
            )
        ) or page.get("documentPage"):
            raise ValidationError({"code": "source_integrity_violation"})
    return page


def validate_sequence(catalog, pages):
    if (
        any(not isinstance(p, dict) for p in pages)
        or not 1 <= len(pages) <= 100
        or [p.get("pageNumber") for p in pages] != list(range(1, len(pages) + 1))
    ):
        raise ValidationError({"code": "invalid_structure"})
    ids = [p.get("id") for p in pages]
    if any(not isinstance(i, str) or not i or len(i) > 200 for i in ids) or len(
        set(ids)
    ) != len(ids):
        raise ValidationError({"code": "invalid_structure"})
    if not catalog.import_metadata:
        return
    existing = {p.get("id"): p for p in catalog_pages(catalog)}
    seen = set()
    for page in pages:
        kind = origin(page, catalog)
        prior = existing.get(page["id"])
        reserved = {p.get("id") for p in source_previews(catalog)}
        if (
            prior
            and origin(prior, catalog) != kind
            or kind != "imported_source"
            and page["id"] in reserved
        ):
            raise ValidationError({"code": "source_integrity_violation"})
        if (
            prior
            and kind == "derived_from_import"
            and (
                source_number(prior) != source_number(page)
                or prior.get("derivedFromPageId") != page.get("derivedFromPageId")
            )
        ):
            raise ValidationError({"code": "source_integrity_violation"})
        if kind == "imported_source":
            old = existing.get(page["id"])
            original = (
                source_previews(catalog)[source_number(page) - 1]
                if type(source_number(page)) is int
                and 1 <= source_number(page) <= len(source_previews(catalog))
                else {}
            )
            if (
                page["id"] != original.get("id")
                or old
                and (
                    origin(old, catalog) != kind
                    or source_number(old) != source_number(page)
                )
            ):
                raise ValidationError({"code": "source_integrity_violation"})
            if source_number(page) in seen:
                raise ValidationError({"code": "source_integrity_violation"})
            seen.add(source_number(page))
        elif kind == "derived_from_import":
            parent = existing.get(page.get("derivedFromPageId"))
            old = existing.get(page["id"])
            if not (
                old
                and origin(old, catalog) == kind
                or parent
                and source_number(parent) == source_number(page)
            ):
                raise ValidationError({"code": "source_integrity_violation"})
        elif any(
            page.get(k) is not None
            for k in (
                "sourceImportId",
                "sourcePageNumber",
                "sourceFingerprint",
                "sourcePageFingerprint",
            )
        ) or page.get("documentPage"):
            raise ValidationError({"code": "source_integrity_violation"})


def validate_commercial_revision(catalog, pages, unassigned=None):
    """Presentation editing cannot rewrite facts of an existing catalog product."""
    from api.ai.commercial_guard import CommercialIntegrityGuard
    from api.ai.contracts import IMMUTABLE_COMMERCIAL_FIELDS

    if unassigned is not None and not isinstance(unassigned, list):
        raise ValidationError({"code": "invalid_structure"})
    if any(not isinstance(page.get("products", []), list) for page in pages):
        raise ValidationError({"code": "invalid_structure"})
    known = [p for page in catalog_pages(catalog) for p in page.get("products", [])] + (
        catalog.unassigned_products or []
    )
    originals = {CommercialIntegrityGuard.identity(p): p for p in known}
    requested = [p for page in pages for p in page.get("products", [])] + (
        unassigned or []
    )
    for product in requested:
        if not isinstance(product, dict):
            raise ValidationError({"code": "invalid_structure"})
        original = originals.get(CommercialIntegrityGuard.identity(product))
        if original is not None and any(
            type(original.get(k)) is not type(product.get(k))
            or original.get(k) != product.get(k)
            for k in IMMUTABLE_COMMERCIAL_FIELDS
        ):
            raise ValidationError({"code": "commercial_integrity_blocked"})
        if product.get("source") in {"imported_source", "source_document"}:
            raise ValidationError({"code": "commercial_integrity_blocked"})
    # New explicitly authored rows are permitted, but bound blocks must match their exact fields.
    if not CommercialIntegrityGuard.verify_document_commercial_integrity(
        [*known, *requested], pages
    )[0]:
        raise ValidationError({"code": "commercial_integrity_blocked"})
