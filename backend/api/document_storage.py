"""Import-only private retention boundary outside the public nginx media alias."""
import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateDocumentStorage(FileSystemStorage):
    @property
    def base_location(self):
        return getattr(settings, 'DOCUMENT_IMPORT_PRIVATE_ROOT', os.path.join(settings.BASE_DIR, 'private_document_imports'))

    @property
    def location(self):
        location = os.path.realpath(self.base_location)
        media_root = os.path.realpath(settings.MEDIA_ROOT)
        if os.path.commonpath([location, media_root]) == media_root:
            raise ValueError('Document import storage must be outside the public MEDIA_ROOT.')
        return location

    def url(self, name):
        raise ValueError('Private source assets are accessed through the authorized import endpoint.')


private_document_storage = PrivateDocumentStorage()
