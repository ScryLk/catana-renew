
import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import Organization, Sede, User, Catalog, SedeSharing
from django.test import RequestFactory
from api.views import CatalogViewSet
from rest_framework.request import Request
from api.serializers import CatalogSerializer

def verify_filtering():
    print("--- Verifying Catalog Filtering ---")
    
    # 1. Setup Data
    # Create User
    user, _ = User.objects.get_or_create(username='debug_user', email='debug@example.com', role='admin')
    
    # Create Organization
    org, _ = Organization.objects.get_or_create(name='Debug Org', owner=user)
    
    # Create Sedes
    sede_a, _ = Sede.objects.get_or_create(name='Sede A', organization=org)
    sede_b, _ = Sede.objects.get_or_create(name='Sede B', organization=org)
    
    # Clear existing data for clean state
    Catalog.objects.filter(title__startswith='Debug Catalog').delete()
    SedeSharing.objects.filter(source_sede__in=[sede_a, sede_b], target_sede__in=[sede_a, sede_b]).delete()
    
    # Create Catalogs
    cat_a = Catalog.objects.create(title='Debug Catalog A', description='Owned by A', sede=sede_a, organization=org, created_by=user)
    cat_b = Catalog.objects.create(title='Debug Catalog B', description='Owned by B', sede=sede_b, organization=org, created_by=user)
    
    print(f"Created Data:\n  Org: {org.id}\n  Sede A: {sede_a.id}\n  Sede B: {sede_b.id}\n  Cat A: {cat_a.id} (Sede {cat_a.sede_id})\n  Cat B: {cat_b.id} (Sede {cat_b.sede_id})")

    # 2. Test Filtering WITHOUT Sharing
    print("\n[Test 1] Filtering by Sede (No Sharing)")
    
    factory = RequestFactory()
    view = CatalogViewSet.as_view({'get': 'list'})
    
    # Request for Sede A
    request_a = factory.get(f'/api/catalogs/?sede={sede_a.id}')
    # Must manually wrap in DRF Request to process query params correctly if calling view directly? 
    # Actually, ViewSet.as_view handles it if passed via URL or we can mock query_params.
    # Let's instantiate ViewSet directly to test get_queryset logic easily.
    
    view_instance = CatalogViewSet()
    view_instance.request = Request(request_a)
    view_instance.format_kwarg = None
    
    queryset_a = view_instance.get_queryset()
    ids_a = list(queryset_a.values_list('id', flat=True))
    print(f"  Request Sede A -> IDs: {ids_a}")
    
    if cat_a.id in ids_a and cat_b.id not in ids_a:
        print("  PASS: Sede A sees only Cat A")
    else:
        print(f"  FAIL: Sede A saw {ids_a}")

    # Request for Sede B
    request_b = factory.get(f'/api/catalogs/?sede={sede_b.id}')
    view_instance.request = Request(request_b)
    queryset_b = view_instance.get_queryset()
    ids_b = list(queryset_b.values_list('id', flat=True))
    print(f"  Request Sede B -> IDs: {ids_b}")
    
    if cat_b.id in ids_b and cat_a.id not in ids_b:
        print("  PASS: Sede B sees only Cat B")
    else:
        print(f"  FAIL: Sede B saw {ids_b}")
        
    # 3. Test Filtering WITH Sharing (A shares to B)
    print("\n[Test 2] Filtering with Sharing (A -> B)")
    # A shares 'catalog' to B. So B should see A's catalogs.
    SedeSharing.objects.create(source_sede=sede_a, target_sede=sede_b, resource_type='catalog', permission_level='read')
    print("  Created Sharing: A -> B (catalog)")
    
    # Request for Sede B (Target)
    view_instance.request = Request(request_b) # Reuse request for Sede B
    queryset_b_shared = view_instance.get_queryset()
    ids_b_shared = list(queryset_b_shared.values_list('id', flat=True))
    print(f"  Request Sede B -> IDs: {ids_b_shared}")
    
    if cat_b.id in ids_b_shared and cat_a.id in ids_b_shared:
         print("  PASS: Sede B sees A and B")
    else:
         print(f"  FAIL: Sede B saw {ids_b_shared} (Expected [A, B])")
         
    # Request for Sede A (Source) - Should NOT change (A sees A, not B)
    view_instance.request = Request(request_a)
    queryset_a_shared = view_instance.get_queryset()
    ids_a_shared = list(queryset_a_shared.values_list('id', flat=True))
    print(f"  Request Sede A -> IDs: {ids_a_shared}")
    
    if cat_a.id in ids_a_shared and cat_b.id not in ids_a_shared:
        print("  PASS: Sede A sees only A (Sharing is one-way)")
    else:
        print(f"  FAIL: Sede A saw {ids_a_shared}")
    
    # Cleanup
    print("\nCleaning up...")
    Catalog.objects.filter(title__startswith='Debug Catalog').delete()
    SedeSharing.objects.filter(source_sede__in=[sede_a, sede_b], target_sede__in=[sede_a, sede_b]).delete()

if __name__ == "__main__":
    verify_filtering()
