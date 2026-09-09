from django.contrib import admin
from .models import (
    User, Organization, Sede, Category, Product, Media, MediaFolder,
    Theme, Catalog, Page, Activity, UserPreferences
)

admin.site.register(User)
admin.site.register(Organization)
admin.site.register(Sede)
admin.site.register(Category)
admin.site.register(Product)
admin.site.register(Media)
admin.site.register(MediaFolder)
admin.site.register(Theme)
admin.site.register(Catalog)
admin.site.register(Page)
admin.site.register(Activity)
admin.site.register(UserPreferences)
