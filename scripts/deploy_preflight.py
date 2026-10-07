"""Production backend configuration validation. Never emits setting values."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from api.auth_config import validate_backend_config

if __name__ == '__main__':
    import os, sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
    import django
    django.setup()
    from django.conf import settings
    errors = validate_backend_config(settings)
    for error in errors:
        print('BACKEND AUTH CONFIG: FAIL - ' + error)
    if not errors:
        print('BACKEND AUTH CONFIG: PASS')
    sys.exit(bool(errors))
