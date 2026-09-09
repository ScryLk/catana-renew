
import os
import django
import sys
import mimetypes

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "catana_back.settings")
django.setup()

from api.models import Media

def fix_media_types():
    updated_count = 0
    for m in Media.objects.all():
        if not m.media_type and m.file:
            try:
                mime_type, _ = mimetypes.guess_type(m.file.name)
                if mime_type:
                    if mime_type.startswith('image/'):
                        m.media_type = 'image'
                    elif mime_type.startswith('video/'):
                        m.media_type = 'video'
                    elif mime_type.startswith('application/pdf') or mime_type.startswith('text/'):
                        m.media_type = 'document'
                    else:
                        m.media_type = 'other'
                else:
                    m.media_type = 'other'
                
                m.save()
                print(f"Updated Media ID {m.id}: Type set to '{m.media_type}' (Mime: {mime_type})")
                updated_count += 1
            except Exception as e:
                print(f"Error updating Media ID {m.id}: {e}")
    
    print(f"Finished. Updated {updated_count} media items.")

if __name__ == "__main__":
    fix_media_types()
