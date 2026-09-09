import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

def verify_unauth_creation():
    print("Verifying unauthenticated creation...")
    client = APIClient()
    
    # Ensure superuser exists for fallback
    if not User.objects.filter(is_superuser=True).exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'password')

    # Verify Folder Creation (Unauth)
    resp_folder = client.post('/api/media-folders/', {'name': 'Final Unauth Folder'})
    if resp_folder.status_code == 201:
        print("Folder (Unauth): SUCCESS (201 Created)")
        data = resp_folder.json()
        print(f"Created Folder ID: {data['id']}, Created By: {data['created_by']}")
        return data['id']
    else:
        print(f"Folder (Unauth): FAILED ({resp_folder.status_code})")
        print(resp_folder.content)
        return None

if __name__ == '__main__':
    fid = verify_unauth_creation()
    if fid:
        from api.models import MediaFolder
        MediaFolder.objects.filter(id=fid).delete()
        print("Cleanup: Deleted verification folder")
