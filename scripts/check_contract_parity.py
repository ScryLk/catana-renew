#!/usr/bin/env python3
"""Check executable contracts and their deterministic generated frontend representation."""
import json
from pathlib import Path
import subprocess
import sys
root = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'backend'))
from api.ai.contracts import CONTRACT, IMMUTABLE_COMMERCIAL_FIELDS, RENDER_MODES
from api.ai.design_grammar import BlockType
from api.ai.font_registry import load_font_registry
assert set(CONTRACT['blockTypes']) == {b.value for b in BlockType}
assert tuple(CONTRACT['commercialProtectedFields']) == IMMUTABLE_COMMERCIAL_FIELDS
assert tuple(CONTRACT['renderModes']) == RENDER_MODES
assert set(CONTRACT['nullableProductFields']) >= set(IMMUTABLE_COMMERCIAL_FIELDS)-{'id'}
assert CONTRACT['fontRegistryVersion'] == load_font_registry()['version']
source=(root/'frontend/src/data/editorialCatalog.mock.ts').read_text()
for contract in ['blockTypes','renderModes','nullableProductFields']:
    assert 'GENERATIVE_CONTRACT.'+contract in source
for field in CONTRACT['nullableProductFields']:
    assert field+':' in source or field+'?:' in source
subprocess.run(['node',str(root/'scripts/generate_font_registry.mjs'),'--check'],check=True)
print('Contract parity: passed')
