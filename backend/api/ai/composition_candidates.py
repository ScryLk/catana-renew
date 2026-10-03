"""Constraint-filtered candidate solver with orthogonal spatial decisions."""
import copy
import random
from .design_grammar import validate_runtime_block
from .generation_validator import GenerationValidator
from .composition_mutator import fit_block_to_safe_area, DEFAULT_SAFE_AREA
from .seed_utils import derive_mutation_seed
from .visual_critic import VisualCritic
from .novelty_engine import NoveltyEngine


class CompositionCandidateGenerator:
    @classmethod
    def generate_candidates(cls, blocks, role, visual_dna, contract, page, creative_seed=42, previous_pages=None):
        """Vary polarity, mass, negative space and field orientation before scoring."""
        candidates = []
        strategies = ['edge_aligned', 'asymmetrical_editorial', 'negative_space', 'split_field', 'typography_led']
        negatives = set(contract.constraints.negative)
        for index, strategy in enumerate(strategies):
            seed = derive_mutation_seed(creative_seed, page.get('pageNumber', 1), index, strategy)
            rng = random.Random(seed)
            variant = copy.deepcopy(blocks)
            axis = 'asymmetric_right' if index % 2 else 'asymmetric_left'
            for block in variant:
                if block.get('role') == 'folio':
                    continue
                x, y, w, h = (float(block[k]) for k in ['x', 'y', 'width', 'height'])
                if strategy == 'asymmetrical_editorial':
                    block['x'] = round(1 - x - w, 3)
                    block['alignment'] = 'right'
                elif strategy == 'negative_space':
                    scale = 0.74 + rng.random() * 0.05
                    block.update(x=round(0.04 + (x - 0.04) * scale, 3),
                                 y=round(0.04 + (y - 0.04) * scale, 3),
                                 width=round(w * scale, 3), height=round(h * scale, 3))
                    if block.get('fontSize'):
                        block['fontSize'] = round(block['fontSize'] * scale, 1)
                elif strategy == 'split_field':
                    block.update(x=round(y, 3), y=round(x, 3), width=round(h, 3), height=round(w, 3))
                    axis = 'orthogonal_split'
                elif strategy == 'typography_led':
                    block['x'] = round(0.10 + (x - 0.04) * 0.85, 3)
                    block['width'] = round(w * 0.85, 3)
                    if block.get('role') in ['headline', 'product_name'] and block.get('fontSize'):
                        block['fontSize'] = round(block['fontSize'] * 1.15, 1)
                if 'NO_DIAGONALS' in negatives:
                    block['rotation'] = 0
                if block.get('content') is not None and block['type'] not in ['image','product_image','line','shape','color_field']:
                    token = block.get('colorToken','primary')
                    color = token if token.startswith('#') else {'muted':'#71717A', 'accent':page.get('accentColor','#141416'), 'background':page.get('backgroundColor','#FFFFFF')}.get(token,page.get('textColor','#141416'))
                    if VisualCritic._calculate_color_contrast(page.get('backgroundColor','#FFFFFF'), color) < 4.5:
                        block['colorToken'] = 'primary'
                fit_block_to_safe_area(block)
            candidate_page = {**page, 'blocks': variant, 'composition': {'axis': axis}, 'safeArea': DEFAULT_SAFE_AREA}
            # Filter hard constraints, runtime, safe area and collisions BEFORE fitness.
            candidate_contract = copy.deepcopy(contract)
            candidate_contract.output.page_count = None
            candidate_contract.content.required_hard = []
            candidate_contract.content.preserve_verbatim = []
            if not all(validate_runtime_block(b)[0] for b in variant):
                continue
            if not GenerationValidator.validate(candidate_contract, {'pages': [candidate_page]}).passed:
                continue
            breakdown = cls.score_breakdown(variant, role, visual_dna)
            if previous_pages:
                current_fp = NoveltyEngine.compute_fingerprint(candidate_page)
                similarities = [NoveltyEngine.calculate_similarity(current_fp, NoveltyEngine.compute_fingerprint(previous)) for previous in previous_pages[-2:]]
                breakdown['novelty'] = 1 - max(similarities)
            score = cls.weighted_score(breakdown)
            candidates.append({'candidateId': f'p{page.get("pageNumber", 1)}-c{index + 1}',
                               'seed': seed, 'axis': axis, 'strategy': strategy, 'blocks': variant,
                               'score': score, 'scoreBreakdown': breakdown})
        return candidates

    @staticmethod
    def score_breakdown(blocks, role, dna):
        if not blocks:
            return {k: 0.0 for k in ['safeArea', 'collisions', 'dnaFit', 'hierarchy', 'balance', 'clicheRisk', 'novelty', 'constraintCompliance']}
        area = sum(b['width'] * b['height'] for b in blocks)
        center = sum(b.get('alignment') == 'center' for b in blocks) / len(blocks)
        fonts = [b['fontSize'] for b in blocks if b.get('fontSize')]
        hierarchy = min(1, ((max(fonts) / min(fonts)) - 1) / 3) if fonts else 0.5
        mass = sum(b['width'] * b['height'] * (2 if 'image' in b['type'] else 1) for b in blocks)
        cx = sum((b['x'] + b['width']/2) * b['width'] * b['height'] * (2 if 'image' in b['type'] else 1) for b in blocks) / (mass or 1)
        cy = sum((b['y'] + b['height']/2) * b['width'] * b['height'] * (2 if 'image' in b['type'] else 1) for b in blocks) / (mass or 1)
        collisions = 0
        for i, a in enumerate(blocks):
            for b in blocks[i+1:]:
                if not (a.get('allowOverlap') or b.get('allowOverlap')) and min(a['x']+a['width'], b['x']+b['width']) > max(a['x'],b['x']) and min(a['y']+a['height'],b['y']+b['height']) > max(a['y'],b['y']):
                    collisions += 1
        return {'safeArea': 1.0, 'collisions': max(0, 1-collisions/len(blocks)),
                'dnaFit': max(0, 1-(abs(center-dna.symmetry)+abs(max(0,1-area)-dna.whitespace))/2),
                'hierarchy': hierarchy, 'balance': max(0, 1-((cx-.5)**2+(cy-.5)**2)**.5),
                'clicheRisk': center if role in ['opening','cover'] else center * .5,
                'novelty': min(1, len({(b['x'],b['width']) for b in blocks})/len(blocks)),
                'constraintCompliance': 1.0}

    @staticmethod
    def weighted_score(b):
        return round(max(0, .2*b['hierarchy']+.15*b['balance']+.2*b['dnaFit']+
                         .15*b['novelty']+.15*b['safeArea']+.15*b['constraintCompliance']-
                         .15*b['clicheRisk']-.2*(1-b['collisions'])), 6)

    @classmethod
    def evaluate_candidate_fitness(cls, blocks, role, visual_dna, safe_area=None):
        return cls.weighted_score(cls.score_breakdown(blocks, role, visual_dna))
