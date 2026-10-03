"""
Seed Utils - Derivação Criptográfica e Determinística de Sementes Criativas.
Garante que 'mesmo prompt + mesmos produtos + mesmo seed' sempre produza resultados
estritamente idênticos entre diferentes workers, processos e reinicializações de servidor.
"""
import hashlib
import json
from typing import Dict, Any, List, Optional


def derive_creative_seed(
    prompt: str = "",
    products: Optional[List[Dict[str, Any]]] = None,
    seed_input: Optional[int] = None,
) -> int:
    """
    Deriva um creative_seed estável e determinístico a partir do prompt e produtos.
    Se seed_input for fornecido, combina-o criptograficamente no payload.
    Substitui o hash() nativo do Python que sofre de hash randomization entre processos.
    """
    if seed_input is not None and not prompt and not products:
        return int(seed_input)
    normalized_prompt = " ".join(prompt.strip().lower().split()) if prompt else ""
    prod_sig_parts = []
    if products:
        for p in products:
            p_name = str(p.get("name", "")).strip().lower()
            p_sku = str(p.get("sku", "")).strip().lower()
            p_price = str(p.get("price", "")).strip().lower()
            prod_sig_parts.append(f"{p_name}|{p_sku}|{p_price}")
    
    prod_sig = ";".join(sorted(prod_sig_parts))
    payload = f"seed:{seed_input}:{normalized_prompt}:{prod_sig}"
    
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    # Mapeia os primeiros 16 caracteres hexadecimais para um inteiro no intervalo [100000, 999999]
    raw_val = int(digest[:16], 16)
    seed = (raw_val % 900000) + 100000
    return seed


def derive_mutation_seed(
    creative_seed: int,
    page_number: int,
    attempt: int = 1,
    mutation_type: str = "default",
) -> int:
    """
    Deriva uma semente de mutação estável e reproduzível a partir do seed criativo do catálogo.
    """
    payload = f"mutation:{creative_seed}:{page_number}:{attempt}:{mutation_type}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return int(digest[:16], 16) % 1000000


def compute_generation_fingerprint(
    prompt: str,
    seed: int = 42,
    products: Optional[List[Dict[str, Any]]] = None,
    constraints: Optional[Dict[str, Any]] = None,
    engine_version: str = "2.0.0-generative",
) -> str:
    """
    Calcula a impressão digital criptográfica imutável da geração (generationFingerprint).
    Identifica de forma única e determinística os parâmetros constitutivos do catálogo.
    """
    normalized_prompt = " ".join(prompt.strip().lower().split())
    serialized_prods = json.dumps(products or [], sort_keys=True, default=str)
    serialized_constraints = json.dumps(constraints or {}, sort_keys=True, default=str)
    
    payload = (
        f"v={engine_version}\n"
        f"prompt={normalized_prompt}\n"
        f"seed={seed}\n"
        f"prods={serialized_prods}\n"
        f"constraints={serialized_constraints}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
