
import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import Organization, Sede, Catalog, SedeSharing

def inspect_data():
    print("--- Inspecting Data ---")
    
    # List Stats
    print(f"Total Catalogs: {Catalog.objects.count()}")
    print(f"Total Sharings: {SedeSharing.objects.count()}")
    
    # List Catalogs
    print("\nCatalogs:")
    for c in Catalog.objects.all():
        print(f"- [{c.id}] {c.title} (Sede: {c.sede_id}, Org: {c.organization_id})")

    # List Sharings
    print("\nSharings:")
    for s in SedeSharing.objects.all():
        print(f"- [{s.id}] Source: {s.source_sede.name} ({s.source_sede_id}) -> Target: {s.target_sede.name} ({s.target_sede_id}) [{s.resource_type}]")

if __name__ == "__main__":
    inspect_data()
