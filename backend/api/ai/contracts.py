"""Canonical, versioned contracts shared with the frontend generator."""
import json
from pathlib import Path

def _resolve_shared_root() -> Path:
    parents = Path(__file__).resolve().parents
    candidates = [p / 'shared' for p in parents]
    candidates.extend([Path('/shared'), Path('/app/shared')])
    for candidate in candidates:
        if (candidate / 'contracts/generative.json').is_file():
            return candidate
    return Path('/shared')


SHARED_ROOT = _resolve_shared_root()
CONTRACT = json.loads((SHARED_ROOT / 'contracts/generative.json').read_text())
IMMUTABLE_COMMERCIAL_FIELDS = tuple(CONTRACT['commercialProtectedFields'])
BLOCK_TYPES = tuple(CONTRACT['blockTypes'])
RENDER_MODES = tuple(CONTRACT['renderModes'])
