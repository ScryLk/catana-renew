"""Canonicalize full documents, dropping only measured execution timing."""
import json


def canonical_document(document):
    def scrub(value):
        if isinstance(value, dict):
            return {key: scrub(child) for key, child in value.items()
                    if key not in {'elapsed_ms', 'timings_ms'}}
        if isinstance(value, list):
            return [scrub(child) for child in value]
        return value
    return json.dumps(scrub(document), sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
