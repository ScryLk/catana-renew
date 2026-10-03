import copy
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
from django.test import TestCase
from api.ai.commercial_guard import CommercialIntegrityGuard as Guard
from api.ai.design_grammar import validate_runtime_block, BlockType
from api.ai.contracts import CONTRACT
from api.ai.font_registry import ALL_VERIFIED_FONTS, load_font_registry
from api.ai.generation_validator import GenerationValidator
from api.ai.pipeline import EditorialGenerationPipeline as Pipeline
from api.ai.requirement_contract import RequirementContract
from api.ai.repair_engine import RepairEngine
from api.ai.visual_critic import VisualCritic, VisualCriticReport
from api.ai.composition_candidates import CompositionCandidateGenerator as Candidates
from api.ai.composition_mutator import CompositionMutator
from api.ai.visual_dna import VisualDNA
from api.ai.rag_principle_extractor import RAGPrincipleExtractor
from api.ai.determinism import canonical_document


class ProductionGateTests(TestCase):
    def setUp(self):
        self.original = Guard.sanitize_supplied_product({'id':'p1', 'name':'Original', 'sku':None, 'price':None, 'quantity':'5', 'description':'User text'})
        self.block = {'id':'b1','type':'price','productId':'p1','content':None,'x':.1,'y':.1,'width':.2,'height':.1}
        self.page = {'pageNumber':1,'renderMode':'generative','products':[copy.deepcopy(self.original)],'blocks':[]}

    def audit(self, page):
        return Guard.verify_document_commercial_integrity([self.original], [page])

    def test_each_commercial_field_is_immutable_including_null_and_type(self):
        for field in CONTRACT['commercialProtectedFields']:
            with self.subTest(field=field):
                page = copy.deepcopy(self.page)
                page['products'][0][field] = 'changed'
                self.assertFalse(self.audit(page)[0])
        self.assertEqual(Guard.sanitize_supplied_product({'quantity':'5'})['quantity'], '5')
        self.assertIsNone(Guard.sanitize_supplied_product({})['name'])

    def test_id_locates_product_when_name_and_sku_change(self):
        page=copy.deepcopy(self.page)
        page['products'][0].update(name='Altered',sku='Invented')
        passed, errors=self.audit(page)
        self.assertFalse(passed)
        self.assertTrue(any('INTEGRITY_VIOLATION' in e for e in errors))

    def test_null_to_value_in_product_and_block_is_fabrication(self):
        for variant in ['product','block']:
            page=copy.deepcopy(self.page)
            if variant=='product': page['products'][0]['price']='R$ 900'
            else: page['blocks']=[{**self.block,'content':'R$ 900'}]
            self.assertTrue(any('COMMERCIAL_DATA_FABRICATION' in e for e in self.audit(page)[1]))

    def test_unknown_and_missing_products_and_empty_original_set(self):
        page=copy.deepcopy(self.page);page['products'][0]['id']='unknown'
        self.assertIn('COMMERCIAL_UNKNOWN_PRODUCT', self.audit(page)[1][0])
        self.assertFalse(Guard.verify_document_commercial_integrity([], [self.page])[0])
        self.assertFalse(Guard.verify_document_commercial_integrity([self.original], [], [self.original])[0])
        self.assertTrue(Guard.verify_document_commercial_integrity([self.original], [], [])[0])

    def test_all_protected_fields_change_hash(self):
        initial=Guard.compute_commercial_hash(self.original)
        for field in CONTRACT['commercialProtectedFields']:
            self.assertNotEqual(initial,Guard.compute_commercial_hash({**self.original,field:'changed'}))

    def test_runtime_boundary_rejects_nested_security_and_non_finite_values(self):
        for changes in [{'x':float('nan')},{'width':float('inf')},{'height':-1},{'width':5},
                        {'imageUrl':'javascript:alert(1)'},{'imageUrl':'data:image/svg+xml;base64,abc'},
                        {'nested':{'dangerouslySetInnerHTML':{'__html':'script'}}},{'nested':[{'onError':'evil'}]}]:
            block={**self.block, **changes}
            self.assertFalse(validate_runtime_block(block)[0])
            result=GenerationValidator.validate(RequirementContract(),{'pages':[{**self.page,'blocks':[block]}]})
            self.assertFalse(result.passed)
            self.assertTrue(any('INVALID_RUNTIME_BLOCK' in e for e in result.errors))

    def test_bleed_has_finite_limits(self):
        self.assertTrue(validate_runtime_block({**self.block,'bleed':True,'x':-.02,'width':1.04})[0])
        self.assertFalse(validate_runtime_block({**self.block,'bleed':True,'width':5})[0])

    def test_no_diagonals_filter_validator_and_mutator(self):
        contract=RequirementContract();contract.constraints.negative=['NO_DIAGONALS']
        page={**self.page,'blocks':[{**self.block,'type':'text','content':'Editorial','productId':None}], 'negativeConstraints':['NO_DIAGONALS']}
        candidates=Candidates.generate_candidates(page['blocks'],'opening',VisualDNA(),contract,page,42)
        self.assertGreaterEqual(len(candidates),3)
        self.assertGreaterEqual(len({canonical_document(c['blocks']) for c in candidates}),3)
        self.assertTrue(all('diagonal' not in c['axis'] for c in candidates))
        result=GenerationValidator.validate(contract,{'pages':[{**page,'composition':{'axis':'diagonal_dynamic'}}]})
        self.assertTrue(any('FORBIDDEN_COMPOSITION_AXIS' in e for e in result.errors))
        for mutation in CompositionMutator.AVAILABLE_MUTATIONS:
            mutated,_=CompositionMutator.mutate(page,mutation_type=mutation)
            self.assertTrue(all(b.get('rotation',0)==0 for b in mutated['blocks']))
            self.assertEqual(mutated['products'],page['products'])
            self.assertEqual(mutated['blocks'][0]['content'],'Editorial')

    def test_critic_failure_exhaustion_is_not_publishable(self):
        failed=VisualCriticReport(1,1,1,1,1,1,1,1,passed=False)
        with patch.object(VisualCritic,'critique',return_value=failed):
            doc=Pipeline.execute('Catálogo de 1 página',products=[self.original],creative_seed=42)
        self.assertFalse(doc['qualityGate']['publishable'])
        self.assertNotEqual(doc['qualityGate']['status'],'passed')
        self.assertTrue(doc['observability']['fallbackUsed'])
        self.assertEqual(doc['pages'][0]['blocks'],[])
        self.assertIsInstance(doc['pages'][0]['generativeDraft'],dict)

    def test_fallback_shape_idempotency(self):
        page={**self.page,'blocks':[self.block],'composition':{'axis':'left'}}
        RepairEngine.fallback_page_to_legacy(page)
        first=copy.deepcopy(page)
        RepairEngine.fallback_page_to_legacy(page)
        self.assertEqual(first,page)
        self.assertEqual(page['blocks'],[])
        self.assertEqual(page['generativeDraft']['blocks'],[self.block])

    def test_rag_canonical_references_and_font_contract(self):
        self.assertEqual(RAGPrincipleExtractor.extract_principles({'retrieved_templates':[{}, {}, {}]})['references_consulted'],3)
        self.assertEqual(len(ALL_VERIFIED_FONTS),17)
        self.assertEqual(load_font_registry()['version'],CONTRACT['fontRegistryVersion'])
        self.assertEqual({b.value for b in BlockType},set(CONTRACT['blockTypes']))

    def test_wcag_ratios(self):
        self.assertEqual(VisualCritic._calculate_color_contrast('#000000','#FFFFFF'),21)
        self.assertAlmostEqual(VisualCritic._calculate_color_contrast('#777777','#FFFFFF'),4.478,places=3)

    def test_full_document_determinism_and_material_seed_variation(self):
        args={'prompt':'Catálogo técnico B2B, 4 páginas, sem diagonais','products':[self.original]}
        first=Pipeline.execute(**args,creative_seed=42)
        self.assertNotIn('GENERATION_SUBSYSTEM_FAILURE',str(first.get('qualityGate')))
        self.assertEqual(canonical_document(first),canonical_document(Pipeline.execute(**args,creative_seed=42)))
        second=Pipeline.execute(**args,creative_seed=99)
        self.assertNotEqual(first['designSystem']['visualDNA'],second['designSystem']['visualDNA'])
        self.assertNotEqual([p.get('composition') for p in first['pages']], [p.get('composition') for p in second['pages']])

    def test_subsystem_exceptions_fail_closed_and_preserve_products(self):
        for target in ['api.ai.pipeline.VisualCritic.critique','api.ai.pipeline.CompositionPlanner.compose_page',
                       'api.ai.creative_director.RAGPrincipleExtractor.extract_principles','api.ai.creative_director.load_font_registry']:
            with self.subTest(target=target), patch(target,side_effect=RuntimeError('failure')):
                doc=Pipeline.execute('1 página',products=[self.original])
                self.assertFalse(doc['qualityGate']['publishable'])
                self.assertIn('palette', doc)
                self.assertIn('catalogId', doc)
                self.assertEqual(doc['pages'][0]['products'][0],self.original)

    def test_commercial_blocks_protect_name_description_sku_and_quantity(self):
        for role, field in [('product_name','name'), ('product_description','description'), ('sku','sku'), ('quantity','quantity')]:
            page = copy.deepcopy(self.page)
            page['blocks'] = [{**self.block,'type':'text','role':role,'content':'Fabricated'}]
            self.assertFalse(self.audit(page)[0], field)

    def test_mutator_whitelist_rejects_commercial_changes(self):
        page = {**self.page, 'blocks':[{**self.block,'content':None}]}
        def tamper(blocks, scale_factor):
            blocks[0]['content'] = 'R$ 999'
            return 'tampered'
        with patch.object(CompositionMutator,'_mutate_image_scale',side_effect=tamper):
            with self.assertRaisesRegex(ValueError,'MUTATION_COMMERCIAL_FIELD_VIOLATION'):
                CompositionMutator.mutate(page, mutation_type='increase_image_scale')

    def test_feature_flag_false_is_legacy_without_root_blocks(self):
        with patch('api.ai.pipeline.GENERATIVE_COMPOSITION_ENGINE',False):
            document = Pipeline.execute('4 páginas',products=[self.original],creative_seed=42)
        self.assertEqual(document['renderMode'],'legacy')
        self.assertTrue(all(p['renderMode']=='legacy' and p['blocks']==[] for p in document['pages']))

    def test_api_adapter_cannot_promote_model_products_or_normalize_supplied_values(self):
        from api.ai.catalog_builder import generate_catalog_from_gemini
        with patch('api.ai.catalog_builder._run_gemini_or_contingency_synthesis',return_value={'products':[{'price':'R$ 999','sku':'Invented'}]}) as synthesis:
            doc=generate_catalog_from_gemini('1 página',products=[self.original])
        synthesis.assert_not_called()
        product=doc['pages'][0]['products'][0]
        for field in CONTRACT['commercialProtectedFields']:
            self.assertEqual(product[field],self.original[field])
        self.assertFalse(Guard.verify_document_commercial_integrity([],doc['pages'])[0])
        self.assertTrue(Guard.verify_document_commercial_integrity([self.original],doc['pages'])[0])

    def test_independent_hashseed_processes_compare_full_documents(self):
        script=Path(__file__).resolve().parents[2]/'scripts/check_generative_invariants.py'
        results=[]
        for hashseed in ['1','42','999']:
            completed=subprocess.run([sys.executable,str(script),'--emit'],env={**os.environ,'PYTHONHASHSEED':hashseed},
                                     capture_output=True,text=True,check=True,timeout=60)
            results.append(next(line for line in completed.stdout.splitlines() if line.startswith('CANONICAL_DOCUMENTS=')))
        self.assertEqual(results[0],results[1])
        self.assertEqual(results[1],results[2])
