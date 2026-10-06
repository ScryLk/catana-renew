"""Run periodically: expire private previews without deleting confirmed history."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from api.models import DocumentImport


class Command(BaseCommand):
    help = 'Remove expired, unconfirmed document previews and their private files.'

    def handle(self, *args, **options):
        deleted = 0
        identifiers = DocumentImport.objects.filter(expires_at__lte=timezone.now()).exclude(
            status='confirmed').values_list('pk', flat=True)
        for identifier in list(identifiers):
            with transaction.atomic():
                job = DocumentImport.objects.select_for_update().filter(pk=identifier).first()
                if job is None or job.status == 'confirmed' or job.expires_at > timezone.now():
                    continue
                files = [(asset.file.storage, asset.file.name) for asset in job.assets.all()]
                job.delete()
                transaction.on_commit(lambda files=files: [storage.delete(name) for storage, name in files])
                deleted += 1
        self.stdout.write(f'Removed {deleted} expired document import previews.')
