"""Real API quota/lifecycle tests; no unlimited test-user bypass."""
from django.db import transaction
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient
from api.models import Organization, OrganizationQuota, StudioCatalog, User
from api.guards.quota_guard import catalog_slot_status, check_catalog_creation_guard, get_or_create_default_plan


class CatalogLifecycleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='quota-owner', role='editor')
        self.a = Organization.objects.create(name='Free A', owner=self.user)
        self.b = Organization.objects.create(name='Pro B', owner=self.user)
        self.user.organizations.add(self.a, self.b)
        OrganizationQuota.objects.create(organization=self.a, plan=get_or_create_default_plan('free'))
        OrganizationQuota.objects.create(organization=self.b, plan=get_or_create_default_plan('pro'))
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.list = reverse('studio_catalog_list')

    def create(self, organization, count):
        return [StudioCatalog.objects.create(organization=organization, created_by=self.user, title=f'Catalog {i}') for i in range(count)]

    def test_organization_plan_and_count_do_not_cross_scopes(self):
        self.create(self.a, 2); self.create(self.b, 20)
        for org, count, limit in ((self.a, 2, 5), (self.b, 20, 30)):
            response = self.client.get(reverse('studio_quota_status'), {'organization': org.pk})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['organization'], org.pk)
            self.assertEqual(response.data['active_catalogs'], count)
            self.assertEqual(response.data['max_active_catalogs'], limit)
            self.assertEqual(response.data['remaining_catalog_slots'], limit - count)

    def test_archive_frees_slot_restore_consumes_slot_and_can_fail(self):
        cats = self.create(self.a, 5)
        url = reverse('studio_catalog_detail', kwargs={'pk': cats[0].pk})
        self.assertEqual(self.client.post(self.list, {'organization': self.a.pk, 'title': 'Full'}).status_code, 403)
        self.assertEqual(self.client.put(url, {'status': 'archived'}, format='json').status_code, 200)
        self.assertEqual(catalog_slot_status(self.user, self.a)['active_catalogs'], 4)
        self.assertEqual(len(self.client.get(self.list, {'organization': self.a.pk}).data), 4)
        archived = self.client.get(self.list, {'organization': self.a.pk, 'status': 'archived'}).data
        self.assertEqual([c['id'] for c in archived], [cats[0].pk])
        new = self.client.post(self.list, {'organization': self.a.pk, 'title': 'Replacement'})
        self.assertEqual(new.status_code, 201)
        blocked = self.client.put(url, {'status': 'active'}, format='json')
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.data['code'], 'catalog_limit_exceeded')
        self.assertEqual(blocked.data['active_catalogs'], 5)
        self.assertEqual(blocked.data['remaining'], 0)
        self.client.put(reverse('studio_catalog_detail', kwargs={'pk': new.data['id']}), {'status': 'archived'}, format='json')
        self.assertEqual(self.client.put(url, {'status': 'active'}, format='json').status_code, 200)
        cats[0].refresh_from_db(); self.assertIsNone(cats[0].archived_at)

    def test_foreign_tenant_cannot_archive_restore_or_inspect_quota(self):
        outsider = User.objects.create_user(username='foreign-quota', role='editor')
        org = Organization.objects.create(name='Foreign', owner=outsider)
        cat = StudioCatalog.objects.create(organization=org, created_by=outsider, title='Foreign')
        url = reverse('studio_catalog_detail', kwargs={'pk': cat.pk})
        for value in ('active', 'archived'):
            self.assertEqual(self.client.put(url, {'status': value}, format='json').status_code, 404)
        self.assertEqual(self.client.get(reverse('studio_quota_status'), {'organization': org.pk}).status_code, 404)

    def test_legacy_personal_catalogs_do_not_consume_organization_slots(self):
        self.create(None, 5)
        self.assertEqual(catalog_slot_status(self.user, self.a)['active_catalogs'], 0)
        self.assertEqual(catalog_slot_status(self.user, None)['active_catalogs'], 5)

    def test_demo_clone_enforces_same_limit(self):
        self.create(self.a, 5)
        response = self.client.post('/api/v2/studio/demo/load-template/', {'organization': self.a.pk})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(StudioCatalog.objects.filter(organization=self.a).count(), 5)


from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.test import skipUnlessDBFeature


@skipUnlessDBFeature('has_select_for_update')
class CatalogQuotaConcurrencyTests(TransactionTestCase):
    def test_two_creations_compete_for_exactly_one_slot(self):
        user = User.objects.create_user(username='race-owner', role='editor')
        org = Organization.objects.create(name='Race', owner=user)
        user.organizations.add(org)
        OrganizationQuota.objects.create(organization=org, plan=get_or_create_default_plan('free'))
        StudioCatalog.objects.bulk_create([StudioCatalog(organization=org, created_by=user, title=str(i)) for i in range(4)])
        barrier = Barrier(2)
        def create(index):
            close_old_connections()
            try:
                client = APIClient(); client.force_authenticate(User.objects.get(pk=user.pk))
                barrier.wait(timeout=10)
                response = client.post(reverse('studio_catalog_list'), {'organization': org.pk, 'title': str(index)})
                return response.status_code, response.data
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(create, (1, 2)))
        self.assertEqual(sorted(code for code, _ in results), [201, 403])
        self.assertEqual(next(data for code, data in results if code == 403)['code'], 'catalog_limit_exceeded')
        self.assertEqual(StudioCatalog.objects.filter(organization=org, status='active').count(), 5)
