"""Playwright transport bridge to real Django APIs and isolated private storage.

No test routes ship in the application. Each process owns its temporary DB and
private asset storage. Stdout carries JSON; diagnostics stay on stderr.
"""
import base64
import json
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with tempfile.TemporaryDirectory(prefix='catana-browser-api-') as workspace:
    os.environ.update(DJANGO_SETTINGS_MODULE='catana_back.settings', SECRET_KEY='isolated-browser-test',
        DEBUG='True', DATABASE_URL=f'sqlite:///{workspace}/db.sqlite3')
    import django
    django.setup()
    from django.conf import settings
    settings.DOCUMENT_IMPORT_PRIVATE_ROOT = workspace + '/private'
    settings.MEDIA_ROOT = workspace + '/media'
    settings.ALLOWED_HOSTS = ['testserver', 'localhost']
    from django.core.management import call_command
    call_command('migrate', verbosity=0, stdout=sys.stderr)
    from unittest.mock import patch
    from rest_framework.test import APIClient
    from api.models import User, Organization
    from api.ai.provider import GeminiAIProvider
    from api.services.document_reconstructor import DocumentReconstructorService, public_import_page
    from api.tests_document_adapter import synthetic_pdf
    owner = User.objects.create_user(username='browser-owner', role='editor')
    org = Organization.objects.create(name='Browser private source', owner=owner)
    owner.organizations.add(org)
    local_pdf = os.environ.get('CATANA_TEST_PDF')
    source = Path(local_pdf).read_bytes() if local_pdf else synthetic_pdf([{'size': (595, 842), 'content':
        'BT /F1 35 Tf 50 600 Td (CATALOGO DE) Tj ET BT /F1 36 Tf 50 555 Td (PRODUTOS) Tj ET BT /F1 12 Tf 50 50 Td (SOCIAL FOOTER) Tj ET'} for _ in range(int(sys.argv[1]) if len(sys.argv)>1 else 1)])
    job = DocumentReconstructorService.analyze_file(source, Path(local_pdf).name if local_pdf else 'invented.pdf', owner, org, mode='editable')
    job, _ = DocumentReconstructorService.confirm_import(job, owner, mode='editable')
    client = APIClient()
    client.force_authenticate(owner)
    provider = GeminiAIProvider(api_key='')
    provider.client = None
    from django.urls import reverse
    detail_url = reverse('studio_catalog_detail', kwargs={'pk': job.catalog_id})
    initial = client.get(detail_url).data
    for spread in initial['spreads']:
        for side in ('left', 'right'):
            values = spread[f'{side}_page_elements']
            projected = public_import_page(values[0]) if values else None
            spread[f'{side}_page'] = projected
            spread[f'{side}_page_elements'] = [projected] if projected else []
    cover_texts = {e['text']: e['id'] for e in job.previews[0]['documentPage']['elements'] if e.get('editable')}
    print(json.dumps({'catalog_id': job.catalog_id, 'initial': initial, 'cover_texts': cover_texts}), flush=True)
    with patch('api.ai.agents.base.get_ai_provider', return_value=provider), patch('api.ai.provider.time.sleep'):
        for line in sys.stdin:
            try:
                request = json.loads(line)
                method, path = request['method'].lower(), request['path']
                response = getattr(client, method)(path, request.get('body') or {}, format='json')
                if getattr(response, 'streaming', False):
                    data = b''.join(response.streaming_content)
                    result = {'status': response.status_code, 'content_type': response['Content-Type'], 'base64': base64.b64encode(data).decode()}
                else:
                    result = {'status': response.status_code, 'content_type': response['Content-Type'], 'base64': base64.b64encode(response.content).decode()}
                print(json.dumps(result), flush=True)
            except Exception as error:
                print(json.dumps({'bridge_error': type(error).__name__}), flush=True)
