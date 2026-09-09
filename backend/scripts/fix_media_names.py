
import os
import django
import sys

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "catana_back.settings")
django.setup()

from api.models import Media

def fix_media_names():
    updated_count = 0
    for m in Media.objects.all():
        if not m.name and m.file:
            try:
                # Use os.path.basename to get just the filename
                filename = os.path.basename(m.file.name)
                m.name = filename
                m.save()
                print(f"Updated Media ID {m.id}: Name set to '{m.name}'")
                updated_count += 1
            except Exception as e:
                print(f"Error updating Media ID {m.id}: {e}")
    
    print(f"Finished. Updated {updated_count} media items.")

if __name__ == "__main__":
    fix_media_names()
