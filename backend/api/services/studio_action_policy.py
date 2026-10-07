"""Deterministic capability routing; model and browser data never grant authority."""

import copy
import json
import logging
import math
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from django.core import signing
from api.ai.commercial_guard import CommercialIntegrityGuard
from api.services.catalog_page_origin import catalog_pages, origin, source_number
from api.services.imported_text_resolver import (
    catalog_index,
    validate_patch,
    protected_text,
)
def _resolve_shared_actions_path() -> Path:
    parents = Path(__file__).resolve().parents
    candidates = [p / "shared/studio-actions.json" for p in parents]
    candidates.extend([Path("/shared/studio-actions.json"), Path("/app/shared/studio-actions.json")])
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return Path("/shared/studio-actions.json")


REGISTRY = json.loads(_resolve_shared_actions_path().read_text())
ALIASES = {
    "create_page": "add_page",
    "insert_page": "add_page",
    "reorder_page": "move_page",
    "delete_page": "remove_page",
}
ROLES = {
    "closing",
    "backcover",
    "contact",
    "manifesto",
    "divider",
    "product_system",
    "hero",
    "duo",
    "grid",
}
LAYOUTS = {
    "cover",
    "backcover",
    "single",
    "hero",
    "manifesto",
    "divider",
    "duo",
    "grid_4",
}
MESSAGES = {
    "invalid_action": "A proposta contém parâmetros inválidos.",
    "invalid_target": "O destino solicitado não existe neste catálogo.",
    "unsupported_action": "Essa operação ainda não é suportada neste tipo de página.",
    "source_target_not_editable": "Esse elemento da página original ainda não possui uma camada editável.",
    "commercial_integrity_blocked": "Essa alteração foi bloqueada para preservar dados comerciais vinculados.",
    "source_integrity_violation": "O documento original e sua origem devem permanecer preservados.",
    "confirmation_required": "Confirme a remoção da sequência atual. O documento original continuará preservado.",
    "mode_not_editable": "Use reconstrução ou redesign para modificar a composição desta página original.",
    "invalid_structure": "Não foi possível aplicar a alteração estrutural solicitada.",
    "stale_target": "O catálogo mudou; revise a proposta novamente.",
    "cross_tenant_target": "O catálogo não está disponível para edição.",
}
logger = logging.getLogger(__name__)


@dataclass
class ActionPolicyDecision:
    allowed: bool
    actionCategory: str
    reasonCode: str
    requiresConfirmation: bool = False
    sanitizedAction: dict | None = None


def revision(catalog):
    from api.services.document_reconstructor import DocumentReconstructorService

    return DocumentReconstructorService.reconstruction_revision(catalog)


def confirmation_token(catalog, user, patch):
    return signing.dumps(
        {
            "catalog": catalog.pk,
            "user": user.pk,
            "revision": revision(catalog),
            "patch": patch,
        },
        salt="studio-action-confirm",
    )


def confirmed_patch(token, catalog, user):
    try:
        payload = signing.loads(token, salt="studio-action-confirm", max_age=600)
    except signing.BadSignature:
        return None
    if (
        payload.get("catalog") != catalog.pk
        or payload.get("user") != user.pk
        or payload.get("revision") != revision(catalog)
    ):
        return None
    return payload["patch"]


def integer(value, minimum, maximum):
    return type(value) is int and minimum <= value <= maximum


def safe_text(value, limit=2000):
    if isinstance(value, str) and (
        re.search(r"[0-9]%|\bOFF\b|\bdesconto\b", value, re.I)
        or any(
            re.fullmatch(r"[A-Za-z]{1,20}-[0-9]{1,20}", word) for word in value.split()
        )
    ):
        return False
    return (
        isinstance(value, str)
        and len(value) <= limit
        and not any(
            x in value.casefold()
            for x in (
                "javascript:",
                "data:",
                "<script",
                "http://",
                "https://",
                "www.",
                "@",
            )
        )
        and not protected_text(value)
    )


def color(value):
    return (
        isinstance(value, str) and re.fullmatch(r"#[a-fA-F0-9]{6}", value) is not None
    )


class ActionPolicyRouter:
    def __init__(self, catalog, user, context=None, confirmed=False):
        self.catalog, self.user, self.context, self.confirmed = (
            catalog,
            user,
            context or {},
            confirmed,
        )
        self.pages = catalog_pages(catalog) if catalog else []
        self.entries = None

    def decision(self, name, code="allowed", action=None, category=None):
        category = category or REGISTRY.get(name, {}).get("category", "unknown")
        from django.core.cache import cache

        metric = (
            "studio_action_confirmation_required"
            if code == "confirmation_required"
            else (
                "studio_action_allowed"
                if code == "allowed"
                else "studio_action_blocked"
            )
        )
        key = f"{metric}:{category}"
        cache.add(key, 0, 86400)
        try:
            cache.incr(key)
        except ValueError:
            pass
        logger.info(
            "studio_action_policy catalog=%s category=%s action=%s result=%s",
            getattr(self.catalog, "pk", None),
            category,
            name,
            code,
        )
        return ActionPolicyDecision(
            code == "allowed",
            category,
            code,
            code == "confirmation_required",
            action if code == "allowed" else None,
        )

    def validate(self, raw):
        if not isinstance(raw, dict):
            return self.decision("", "invalid_action")
        name = raw.get("action", raw.get("type"))
        if not isinstance(name, str):
            return self.decision("", "invalid_action")
        name = ALIASES.get(name, name)
        if not isinstance(name, str) or name not in REGISTRY:
            return self.decision("", "unsupported_action")
        if not self.catalog or self.catalog.status != "active":
            return self.decision(name, "invalid_target")
        # Independently enforce authorization even when called outside the chat view.
        from api.views_studio import _studio_catalogs_for, _assert_brand_catalog_write

        if not _studio_catalogs_for(self.user).filter(pk=self.catalog.pk).exists():
            return self.decision(name, "cross_tenant_target")
        from rest_framework.exceptions import PermissionDenied

        try:
            _assert_brand_catalog_write(self.user, self.catalog)
        except PermissionDenied:
            return self.decision(name, "cross_tenant_target")
        params, target = raw.get("params", {}), raw.get("target")
        if (
            not isinstance(params, dict)
            or not isinstance(target, str)
            or len(target) > 250
            or len(json.dumps(params)) > 16000
        ):
            return self.decision(name, "invalid_action")
        forbidden = {
            "sourceSnapshot",
            "sourcePageNumber",
            "sourceFingerprint",
            "sourcePageFingerprint",
            "sourceImportId",
            "documentPage",
            "provenance",
            "pageOrigin",
            "sourcePage",
            "sourceDocument",
        }
        if forbidden.intersection(params):
            return self.decision(name, "source_integrity_violation")
        action = {"action": name, "target": target, "params": copy.deepcopy(params)}
        category = REGISTRY[name]["category"]
        if category == "source_destructive":
            return self.decision(name, "source_integrity_violation")
        page = self.page(target)
        if (
            category == "source_element_edit"
            and page
            and origin(page, self.catalog) == "catana_authored"
        ):
            code = self.validate_editorial_text(action)
            decision = self.decision(
                name, code, action, category="catana_editorial_content"
            )
            return decision
        handler = getattr(self, "validate_" + category)
        code = handler(action)
        return self.decision(name, code, action)

    def page(self, target):
        match = re.fullmatch(r"page:([0-9]{1,3})(?:/.*)?", target)
        return (
            next((p for p in self.pages if p.get("pageNumber") == int(match[1])), None)
            if match
            else None
        )

    def validate_non_mutating(self, a):
        if a["action"] == "export_pdf":
            return (
                "allowed"
                if not a["params"] and a["target"] in ("global", "catalog:pages")
                else "invalid_action"
            )
        p = self.page(a["target"])
        if not p or set(a["params"]) - {"page"}:
            return "invalid_target"
        a["params"] = {"page": p["pageNumber"]}
        return "allowed"

    def validate_editorial_text(self, a):
        page = self.page(a["target"])
        m = re.fullmatch(
            r"page:([0-9]{1,3})/field:(title|quote|content|subtitle|label)", a["target"]
        )
        p = a["params"]
        if (
            not page
            or not m
            or set(p) - {"text", "find", "replacement", "expectedText"}
        ):
            return "invalid_target"
        old = page.get(m[2], "")
        if p.get("expectedText") != old:
            return "stale_target"
        if not safe_text(p.get("replacement", p.get("text"))):
            return "commercial_integrity_blocked"
        if "find" in p:
            from api.ai.text_commands import normalize

            if (
                not isinstance(p["find"], str)
                or not normalize(p["find"])
                or normalize(old).count(normalize(p["find"])) != 1
            ):
                return "invalid_target"
        return "allowed"

    def validate_source_element_edit(self, a):
        if self.entries is None:
            self.entries, _ = catalog_index(
                self.catalog, self.context.get("spread_index", 0)
            )
        entry = next((e for e in self.entries if e["target"] == a["target"]), None)
        if not entry:
            return "source_target_not_editable"
        if (
            entry.get("commercial")
            or isinstance(a["params"].get("replacement", a["params"].get("text")), str)
            and protected_text(
                a["params"].get("replacement", a["params"].get("text", ""))
            )
        ):
            return "commercial_integrity_blocked"
        patch = validate_patch({"actions": [a]}, self.entries)
        if not patch:
            return (
                "stale_target"
                if a["params"].get("expectedText") != entry["text"]
                else "invalid_action"
            )
        a.update(patch["actions"][0])
        return "allowed"

    def validate_catalog_structure(self, a):
        p, name = a["params"], a["action"]
        if name == "add_page":
            if a["target"] != "catalog:pages" or set(p) - {
                "afterPage",
                "contentRole",
                "type",
                "layout",
                "title",
                "subtitle",
                "content",
                "quote",
                "label",
            }:
                return "invalid_structure"
            after = p.get("afterPage", len(self.pages))
            role = p.get("contentRole", "hero")
            if not isinstance(role, str):
                return "invalid_structure"
            layout = p.get(
                "type",
                p.get(
                    "layout",
                    (
                        "backcover"
                        if role in {"closing", "backcover", "contact"}
                        else "hero"
                    ),
                ),
            )
            if (
                len(self.pages) >= 100
                or not integer(after, 0, len(self.pages))
                or not isinstance(role, str)
                or role not in ROLES
                or not isinstance(layout, str)
                or layout not in LAYOUTS
            ):
                return "invalid_structure"
            if any(
                not safe_text(v)
                for k, v in p.items()
                if k in {"title", "subtitle", "content", "quote", "label"}
            ):
                return "invalid_action"
            a["params"] = {k: v for k, v in p.items() if k not in {"layout"}}
            a["params"].update(
                afterPage=after,
                contentRole=role,
                type=layout,
                pageOrigin="catana_authored",
                pageId=str(uuid.uuid4()),
            )
            if role in {"closing", "backcover", "contact"}:
                # No generated factual claims or contacts: only neutral editorial copy.
                identity = (self.catalog.brand_snapshot or {}).get("identity", {})
                website = identity.get("website")
                from urllib.parse import urlsplit

                confirmed_website = (
                    website
                    if isinstance(website, str)
                    and len(website) <= 500
                    and urlsplit(website).scheme in {"http", "https"}
                    and urlsplit(website).hostname
                    else ""
                )
                a["params"].update(
                    title="Obrigado por conhecer nossas soluções.",
                    content="Obrigado por conhecer nossas soluções."
                    + ("\n" + confirmed_website if confirmed_website else ""),
                    quote="",
                    subtitle="",
                )
            palette = (self.catalog.brand_snapshot or {}).get("palette", [])
            captured = {
                c.get("role"): c.get("hex")
                for c in palette
                if isinstance(c, dict)
                and c.get("status") in {"confirmed", "user_supplied"}
                and color(c.get("hex"))
            }
            a["params"]["pageColors"] = {
                "backgroundColor": captured.get("primary", self.catalog.primary_color),
                "textColor": captured.get("background", self.catalog.secondary_color),
                "accentColor": captured.get("accent", self.catalog.accent_color),
            }
            return "allowed"
        if name == "reconfigure_catalog":
            if set(p) - {"totalPages"} or not integer(
                p.get("totalPages"), 1, len(self.pages)
            ):
                return "invalid_structure"
            if (
                any(
                    origin(page, self.catalog) != "catana_authored"
                    for page in self.pages[p["totalPages"] :]
                )
                and not self.confirmed
            ):
                return "confirmation_required"
            return "allowed"
        page = self.page(a["target"])
        if not page:
            return "invalid_target"
        if name == "remove_page":
            if p or len(self.pages) <= 1:
                return "invalid_structure"
            return (
                "confirmation_required"
                if origin(page, self.catalog) != "catana_authored"
                and not self.confirmed
                else "allowed"
            )
        if name == "move_page":
            return (
                "allowed"
                if set(p) == {"afterPage"}
                and integer(p["afterPage"], 0, len(self.pages))
                else "invalid_structure"
            )
        if name == "duplicate_page":
            if (
                set(p) - {"afterPage"}
                or len(self.pages) >= 100
                or not integer(
                    p.get("afterPage", page["pageNumber"]), 0, len(self.pages)
                )
            ):
                return "invalid_structure"
            p.update(
                afterPage=p.get("afterPage", page["pageNumber"]),
                pageId=str(uuid.uuid4()),
                pageOrigin=(
                    "derived_from_import"
                    if origin(page, self.catalog) != "catana_authored"
                    else "catana_authored"
                ),
                derivedFromPageId=page["id"],
            )
            return "allowed"
        return "unsupported_action"

    def validate_catana_visual_layer(self, a):
        p, name = a["params"], a["action"]
        if name in {"set_palette", "brand_lock"}:
            return (
                "unsupported_action"  # Historical identity uses its dedicated workflow.
            )
        page = self.page(a["target"])
        if not page:
            return "invalid_target"
        if name == "set_page_color":
            if origin(page, self.catalog) != "catana_authored":
                return "mode_not_editable"
            return (
                "allowed"
                if set(p) <= {"backgroundColor", "textColor", "accentColor"}
                and p
                and all(color(v) for v in p.values())
                else "invalid_action"
            )
        if name in {"remove_overlay", "update_overlay"} and p.get("id") not in {
            o.get("id") for o in page.get("overlays", [])
        }:
            return "invalid_target"
        if name == "clear_overlays":
            return "allowed" if not p else "invalid_action"
        if name == "remove_overlay":
            return "allowed" if set(p) == {"id"} else "invalid_action"
        keys = {
            "type",
            "subType",
            "x",
            "y",
            "width",
            "height",
            "rotation",
            "scale",
            "color",
            "strokeColor",
            "fillColor",
            "strokeWidth",
            "opacity",
            "text",
            "subText",
            "density",
            "arrowDirection",
            "id",
        }
        if set(p) - keys:
            return "invalid_action"
        if name == "highlight_product":
            return "unsupported_action"
        if (name == "add_overlay" or "type" in p) and (
            not isinstance(p.get("type"), str)
            or p.get("type")
            not in {
                "badge",
                "stars",
                "confetti",
                "arrow",
                "shape",
                "stamp",
                "focus_ring",
                "particles",
            }
        ):
            return "invalid_action"
        for k, v in p.items():
            if k in {"color", "strokeColor", "fillColor"} and not color(v):
                return "invalid_action"
            if k in {"text", "subText"} and not safe_text(v, 200):
                return "commercial_integrity_blocked"
            if k in {
                "x",
                "y",
                "width",
                "height",
                "rotation",
                "scale",
                "strokeWidth",
                "opacity",
            } and (
                type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 100
            ):
                return "invalid_action"
            if k in {"subType", "density", "arrowDirection", "id"} and (
                not isinstance(v, str) or len(v) > 100
            ):
                return "invalid_action"
        return "allowed"

    def validate_catana_editorial_content(self, a):
        return "unsupported_action"  # Use explicit editorial field edits, never an implicit rewrite.

    def validate_commercial(self, a):
        from api.ai.text_commands import normalize

        products = [p for page in self.pages for p in page.get("products", [])] + (
            self.catalog.unassigned_products or []
        )
        CommercialIntegrityGuard.create_snapshot(products)
        name, p = a["action"], a["params"]
        if name == "create_product":
            # New user-authored records require literal supplied facts, never PDF candidate promotion.
            literal = normalize(self.context.get("user_message", ""))
            if not literal or not any(
                w in literal.split()
                for w in {"crie", "adicione", "cadastre", "create", "add"}
            ):
                return "commercial_integrity_blocked"
            if (
                a["target"] != "catalog:products"
                or set(p) - {"name", "title", "description", "sku", "price", "category"}
                or not p.get("name", p.get("title"))
            ):
                return "invalid_action"
            for key, value in p.items():
                if value is not None and (
                    not isinstance(value, str)
                    or not 0 < len(value) <= 1000
                    or normalize(value) not in literal
                ):
                    return "commercial_integrity_blocked"
            return "allowed"
        if name in {"assign_product", "remove_product"}:
            page = self.page(a["target"])
            if not page:
                return "invalid_target"
            if origin(page, self.catalog) != "catana_authored":
                return "mode_not_editable"
            if (
                set(p) - {"productId", "slotIndex"}
                or not isinstance(p.get("productId"), str)
                or not integer(p.get("slotIndex", 0), 0, 3)
            ):
                return "invalid_action"
            candidates = (
                products if name == "assign_product" else page.get("products", [])
            )
            if not any(
                str(product.get("id")) == p["productId"] for product in candidates
            ):
                return "invalid_target"
            return "allowed"
        # Price/SKU rewriting needs the authoritative Product API, never browser-only math.
        return "commercial_integrity_blocked"

    def validate_generative(self, a):
        page = self.page(a["target"])
        if not page:
            return "invalid_target"
        if origin(page, self.catalog) != "catana_authored":
            return "mode_not_editable"
        if (
            a["action"] == "change_layout"
            and set(a["params"]) == {"type"}
            and isinstance(a["params"]["type"], str)
            and a["params"]["type"] in LAYOUTS
        ):
            return "allowed"
        return "unsupported_action"

    def validate_patch(self, patch):
        if (
            not isinstance(patch, dict)
            or patch.get("updates")
            or not isinstance(patch.get("actions"), list)
            or not 1 <= len(patch["actions"]) <= 100
        ):
            return None, [self.decision("", "invalid_action")]
        initial_ids = [p["id"] for p in self.pages]
        decisions = []
        for raw in patch["actions"]:
            d = self.validate(raw)
            decisions.append(d)
            if d.allowed and d.sanitizedAction["action"] == "add_page":
                p = d.sanitizedAction["params"]
                self.pages.insert(
                    p["afterPage"],
                    {
                        "id": p["pageId"],
                        "pageOrigin": "catana_authored",
                        "products": [],
                    },
                )
                self.pages = [
                    {**page, "pageNumber": i + 1} for i, page in enumerate(self.pages)
                ]
        touched = set()
        has_structure = any(d.actionCategory == "catalog_structure" for d in decisions)
        for d in decisions:
            if not d.allowed or d.sanitizedAction["action"] not in {
                "update_text",
                "update_text_group",
            }:
                continue
            action = d.sanitizedAction
            targets = {
                action["target"],
                *(m["target"] for m in action["params"].get("members", [])),
            }
            if touched & targets or has_structure:
                d.allowed = False
                d.reasonCode = "invalid_structure" if has_structure else "stale_target"
                d.sanitizedAction = None
            touched.update(targets)
        if not all(d.allowed for d in decisions):
            return None, decisions
        return {
            "actions": [d.sanitizedAction for d in decisions],
            "planner_status": "proposed",
            "policy_version": 1,
            "expectedPageIds": initial_ids,
        }, decisions


def editorial_index(catalog, spread_index=0, page_number=None):
    entries = []
    for page in catalog_pages(catalog):
        if (
            origin(page, catalog) != "catana_authored"
            or page_number is not None
            and page["pageNumber"] != page_number
        ):
            continue
        for field in ("title", "quote", "content", "subtitle", "label"):
            text = page.get(field)
            if isinstance(text, str) and text and len(text) <= 2000:
                target = f"page:{page['pageNumber']}/field:{field}"
                entries.append(
                    {
                        "id": target,
                        "target": target,
                        "page": page["pageNumber"],
                        "text": text,
                        "editable": True,
                        "commercial": protected_text(text),
                        "visible": page["pageNumber"]
                        in {spread_index * 2 + 1, spread_index * 2 + 2},
                    }
                )
    return entries[:500]
