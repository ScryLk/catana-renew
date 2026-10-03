"""Immutable commercial boundary. Diagnostics deliberately omit field values."""
import copy
import hashlib
import json
from .contracts import IMMUTABLE_COMMERCIAL_FIELDS


class CommercialIntegrityGuard:
    @classmethod
    def sanitize_supplied_product(cls, raw_prod, default_index=1):
        product = copy.deepcopy(raw_prod)
        for field in (*IMMUTABLE_COMMERCIAL_FIELDS, 'image'):
            if field not in product or (isinstance(product[field], str) and not product[field].strip()):
                product[field] = None
        return product

    @classmethod
    def identity(cls, product):
        if product.get('id') is not None:
            return ('id', str(product['id']))
        if product.get('sku') is not None:
            return ('sku', str(product['sku']))
        # Unidentified legacy products can only match an exact protected snapshot, never a name.
        return ('snapshot', cls.compute_commercial_hash(product))

    @classmethod
    def compute_commercial_hash(cls, product):
        payload = {field: product.get(field) for field in IMMUTABLE_COMMERCIAL_FIELDS}
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'),
                                        ensure_ascii=False).encode()).hexdigest()

    @classmethod
    def create_snapshot(cls, products):
        return {str(cls.identity(p) or ('position', i)): cls.compute_commercial_hash(p)
                for i, p in enumerate(products)}

    @classmethod
    def verify_document_commercial_integrity(cls, original_products, document_pages,
                                             allocated_products=None):
        originals = {cls.identity(p): p for p in original_products if cls.identity(p) is not None}
        violations, seen = [], set()
        block_fields = {'price': 'price', 'sku': 'sku', 'product_name': 'name',
                        'product_description': 'description', 'description': 'description', 'quantity': 'quantity',
                        'availability': 'availability', 'inventory': 'inventory',
                        'discount': 'discount', 'technical_specs': 'technical_specs'}
        for page in document_pages:
            number = page.get('pageNumber', 0)
            for product in page.get('products', []):
                key = cls.identity(product)
                original = originals.get(key)
                if original is None:
                    violations.append(f'COMMERCIAL_UNKNOWN_PRODUCT: pageNumber={number}')
                    continue
                seen.add(key)
                for field in IMMUTABLE_COMMERCIAL_FIELDS:
                    expected, actual = original.get(field), product.get(field)
                    if type(expected) is not type(actual) or expected != actual:
                        code = 'COMMERCIAL_DATA_FABRICATION' if expected is None and actual is not None else 'COMMERCIAL_INTEGRITY_VIOLATION'
                        violations.append(f'{code}: pageNumber={number} field={field}')
            for block in page.get('blocks', []):
                field = block_fields.get(block.get('role')) or block_fields.get(block.get('type'))
                if block.get('productId') is not None and not field and block.get('type') in ['text','headline','title']:
                    field = 'description' if block.get('role') == 'body' else 'name'
                is_image = block.get('type') == 'product_image'
                if not field and not is_image:
                    continue
                pid = block.get('productId')
                original = originals.get(('id', str(pid))) if pid is not None else None
                if original is None:
                    violations.append(f'COMMERCIAL_UNKNOWN_PRODUCT: pageNumber={number} blockId={block.get("id")}')
                    continue
                expected = original.get('image' if is_image else field)
                key = 'imageUrl' if is_image else 'content'
                # Omitted content is a reference resolved by the renderer; explicit null is protected.
                if key in block and (type(expected) is not type(block[key]) or expected != block[key]):
                    code = 'COMMERCIAL_DATA_FABRICATION' if expected is None and block[key] is not None else 'COMMERCIAL_BLOCK_VIOLATION'
                    violations.append(f'{code}: pageNumber={number} blockId={block.get("id")} field={field or "image"}')
        if allocated_products is not None:
            required = {cls.identity(p) for p in allocated_products if cls.identity(p) is not None}
            for _ in sorted(required - seen):
                violations.append('COMMERCIAL_PRODUCT_MISSING: allocated product absent')
        return not violations, violations
