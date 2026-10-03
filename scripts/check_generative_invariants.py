#!/usr/bin/env python3
"""Full document smoke/determinism checks. Uses isolated temporary SQLite, no user data."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'backend'))
parser=argparse.ArgumentParser();parser.add_argument('--emit',action='store_true');args=parser.parse_args()
with tempfile.TemporaryDirectory(prefix='catana-gates-') as temporary:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE','catana_back.settings')
    os.environ.setdefault('SECRET_KEY','ci-only-nonproduction-key-for-isolated-test-database')
    os.environ['DATABASE_URL']='sqlite:///'+str(Path(temporary)/'gate.sqlite3')
    os.environ['DEBUG']='True'
    import django
    django.setup()
    from django.core.management import call_command
    call_command('migrate',verbosity=0,interactive=False)
    from api.ai.pipeline import EditorialGenerationPipeline as Pipeline
    from api.ai.determinism import canonical_document
    from api.ai.commercial_guard import CommercialIntegrityGuard
    product={'id':'gate-product','name':'Supplied item','quantity':'5','price':None,'sku':None,'description':None,'image':None}
    results=[]
    for prompt in ['Catálogo de luxo, 4 páginas','Catálogo técnico B2B, 4 páginas','4 páginas, sem imagens','4 páginas, sem diagonais']:
        doc=Pipeline.execute(prompt,products=[product],creative_seed=42)
        assert 'designSystem' in doc, doc.get('qualityGate')
        assert CommercialIntegrityGuard.verify_document_commercial_integrity([product],doc['pages'])[0]
        assert all(p.get('blocks')==[] for p in doc['pages'] if p['renderMode']=='legacy')
        assert doc['qualityGate']['publishable'] == (doc['observability']['validatorPass'] and doc['observability']['criticPass'] and doc['observability']['commercialIntegrityPass'] and doc['observability']['runtimeSecurityPass'])
        assert canonical_document(doc)==canonical_document(Pipeline.execute(prompt,products=[product],creative_seed=42))
        if 'sem diagonais' in prompt:
            for page in doc['pages']:
                assert 'diagonal' not in page.get('composition',{}).get('axis','')
                assert all(b.get('rotation',0)%90==0 for b in page.get('blocks',[]))
        if 'sem imagens' in prompt:
            assert all(b['type'] not in ['image','product_image'] for p in doc['pages'] for b in p.get('blocks',[]))
        changed=Pipeline.execute(prompt,products=[product],creative_seed=999)
        assert doc['designSystem']['visualDNA']!=changed['designSystem']['visualDNA']
        assert [p.get('blocks') for p in doc['pages']]!=[p.get('blocks') for p in changed['pages']]
        results.append(json.loads(canonical_document(doc)))
    serialized=json.dumps(results,sort_keys=True,separators=(',',':'),ensure_ascii=False)
    if args.emit:
        print('CANONICAL_DOCUMENTS='+serialized)
    else:
        payloads=[]
        for hash_seed in ['1','42','999']:
            env={**os.environ,'PYTHONHASHSEED':hash_seed}
            run=subprocess.run([sys.executable,__file__,'--emit'],env=env,capture_output=True,text=True,check=True)
            payloads.append(next(line for line in run.stdout.splitlines() if line.startswith('CANONICAL_DOCUMENTS=')))
        assert payloads[0]==payloads[1]==payloads[2], 'Cross-process canonical document drift'
        print('Generative invariants and PYTHONHASHSEED=1,42,999: passed')
