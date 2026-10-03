"""
URL configuration for catana_back project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection

def health_check(request):
    """
    Health check endpoint for container orchestrators, load balancers, and monitoring.
    Performs database ping without exposing secrets or internal stack traces.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    status_code = 200 if db_status == "connected" else 503
    return JsonResponse(
        {
            "status": "ok" if db_status == "connected" else "degraded",
            "database": db_status,
        },
        status=status_code,
    )

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('api/health/', health_check, name='api_health_check'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
