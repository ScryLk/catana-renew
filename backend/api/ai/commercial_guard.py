"""
Commercial Integrity Guard & Commercial Field Policy.
Garante inviolabilidade absoluta dos dados comerciais fornecidos pelo usuário
(preço, SKU, estoque, especificações, quantidade, nome).
A IA e os motores de mutação são terminantemente proibidos de alterar ou inventar dados comerciais.
"""
import copy
import hashlib
import json
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

IMMUTABLE_COMMERCIAL_FIELDS = [
    "sku",
    "price",
    "quantity",
    "name",
    "technical_specs",
    "availability",
    "inventory",
    "discount",
]


class CommercialIntegrityGuard:
    """
    Guardião de Integridade Comercial do Catana.
    Verifica e assegura que nenhum motor generativo, mutador ou reparador adultere os dados comerciais.
    """

    @classmethod
    def sanitize_supplied_product(cls, raw_prod: Dict[str, Any], default_index: int = 1) -> Dict[str, Any]:
        """
        Normaliza os dados de um produto fornecido pelo usuário.
        NUNCA inventa preço (R$ 0,00), SKU sintético ou disponibilidade se não fornecidos.
        """
        prod = copy.deepcopy(raw_prod)
        
        # Name: preserva ou define placeholder neutro de identificação visual se totalmente vazio
        name = prod.get("name")
        if not name or str(name).strip() == "":
            name = f"Item {default_index:02d}"
        prod["name"] = str(name).strip()

        # SKU: Se ausente, usa None (NUNCA "SKU-001")
        raw_sku = prod.get("sku")
        if raw_sku is not None and str(raw_sku).strip() != "":
            prod["sku"] = str(raw_sku).strip()
        else:
            prod["sku"] = None

        # Price: Se ausente, usa None (NUNCA "R$ 0,00")
        raw_price = prod.get("price")
        if raw_price is not None and str(raw_price).strip() != "":
            clean_price = str(raw_price).strip()
            # Se vier explicitamente "R$ 0,00" ou "0" sem ser do usuário, normaliza se não for intencional
            prod["price"] = clean_price
        else:
            prod["price"] = None

        # Quantity: se fornecido, preserva int/float
        if "quantity" in prod and prod["quantity"] is not None:
            try:
                prod["quantity"] = int(prod["quantity"])
            except (ValueError, TypeError):
                pass
        else:
            prod["quantity"] = None

        # Description: Se ausente, usa None (NUNCA "Apresentação comercial...")
        raw_desc = prod.get("description")
        prod["description"] = str(raw_desc).strip() if raw_desc else None

        # Tag: Se ausente, usa None (NUNCA "Disponível")
        raw_tag = prod.get("tag")
        prod["tag"] = str(raw_tag).strip() if raw_tag else None

        # Technical specs: preserva dict ou None
        if "technical_specs" not in prod:
            prod["technical_specs"] = None

        return prod

    @classmethod
    def compute_commercial_hash(cls, product: Dict[str, Any]) -> str:
        """Calcula hash SHA256 exclusivo dos campos comerciais protegidos."""
        extracted = {}
        for field in IMMUTABLE_COMMERCIAL_FIELDS:
            extracted[field] = product.get(field)
        
        serialized = json.dumps(extracted, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @classmethod
    def create_snapshot(cls, products: List[Dict[str, Any]]) -> Dict[str, str]:
        """Cria snapshot dos hashes de integridade de todos os produtos."""
        snapshot = {}
        for p in products:
            pid = str(p.get("id") or p.get("sku") or p.get("name"))
            snapshot[pid] = cls.compute_commercial_hash(p)
        return snapshot

    @classmethod
    def verify_document_commercial_integrity(
        cls,
        original_products: List[Dict[str, Any]],
        document_pages: List[Dict[str, Any]],
    ) -> Tuple[bool, List[str]]:
        """
        Audita todas as páginas e blocos generativos para assegurar que
        nenhum dado comercial foi alterado em relação à entrada original.
        """
        violations: List[str] = []
        if not original_products:
            return True, violations

        # Mapeia produtos originais por id e por nome/sku
        orig_map = {}
        for op in original_products:
            key_name = str(op.get("name", "")).strip().lower()
            key_sku = str(op.get("sku", "")).strip().lower() if op.get("sku") else None
            orig_map[key_name] = op
            if key_sku:
                orig_map[key_sku] = op

        for page in document_pages:
            p_num = page.get("pageNumber", 0)
            for dp in page.get("products", []):
                d_name = str(dp.get("name", "")).strip().lower()
                d_sku = str(dp.get("sku", "")).strip().lower() if dp.get("sku") else None
                
                matched = orig_map.get(d_name) or (orig_map.get(d_sku) if d_sku else None)
                if matched:
                    # Verifica campos imutáveis
                    for f in IMMUTABLE_COMMERCIAL_FIELDS:
                        orig_val = matched.get(f)
                        doc_val = dp.get(f)
                        if orig_val != doc_val:
                            violations.append(
                                f"COMMERCIAL_INTEGRITY_VIOLATION (Pág {p_num}): Campo '{f}' do produto '{matched.get('name')}' "
                                f"foi alterado de '{orig_val}' para '{doc_val}'."
                            )

            # Verifica também blocos de preço e SKU na composição generativa
            for b in page.get("blocks", []):
                b_type = b.get("type")
                pid = b.get("productId")
                if pid and b_type in ["price", "sku"]:
                    # Encontra o produto correspondente
                    target_prod = next((p for p in page.get("products", []) if p.get("id") == pid), None)
                    if target_prod:
                        expected_content = target_prod.get("price") if b_type == "price" else target_prod.get("sku")
                        actual_content = b.get("content")
                        if expected_content is not None and actual_content != expected_content:
                            violations.append(
                                f"COMMERCIAL_BLOCK_VIOLATION (Pág {p_num}): Bloco '{b.get('id')}' ({b_type}) divergiu "
                                f"do dado real: '{actual_content}' != '{expected_content}'."
                            )

        passed = len(violations) == 0
        return passed, violations
