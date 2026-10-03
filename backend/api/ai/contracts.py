"""Canonical, versioned contracts shared with the frontend generator."""
import json
from pathlib import Path

SHARED_ROOT = Path(__file__).resolve().parents[3] / 'shared'
CONTRACT = json.loads((SHARED_ROOT / 'contracts/generative.json').read_text())
IMMUTABLE_COMMERCIAL_FIELDS = tuple(CONTRACT['commercialProtectedFields'])
BLOCK_TYPES = tuple(CONTRACT['blockTypes'])
RENDER_MODES = tuple(CONTRACT['renderModes'])
