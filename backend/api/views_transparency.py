import json
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from api.models import (
    StudioCatalog,
    Organization,
    BillingInvoice,
)
from api.guards.quota_guard import get_user_quota


class StudioDataExportView(APIView):
    """
    Exporta todos os dados cadastrais, catalogos, sedes e faturas da conta
    em formato estruturado JSON, em conformidade com o Art. 18 (V) da LGPD.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        quota, active_plan = get_user_quota(user)

        # 1. Dados do Titular
        user_info = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.get_full_name() or user.username,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }

        # 2. Organizacoes e Sedes
        orgs_data = []
        user_orgs = user.organizations.all()
        for org in user_orgs:
            sedes_data = []
            for s in org.sedes.all():
                sedes_data.append({
                    "id": s.id,
                    "name": s.name,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                })
            orgs_data.append({
                "id": org.id,
                "name": org.name,
                "description": org.description,
                "sedes": sedes_data,
            })

        # 3. Catalogos do Studio
        from django.db.models import Q
        from .services.brand_intelligence import visible_organizations
        catalogs = StudioCatalog.objects.filter(
            Q(created_by=user, brand__isnull=True) | Q(created_by=user, brand__isnull=False, organization__in=visible_organizations(user))
        ).order_by('-updated_at')
        catalogs_data = []
        for cat in catalogs:
            catalogs_data.append({
                "id": cat.id,
                "title": cat.title,
                "category": cat.style_preset,
                "brand": str(cat.brand_id) if cat.brand_id else None,
                "brand_version": cat.brand_version,
                "brand_snapshot": cat.brand_snapshot,
                "brand_snapshot_hash": cat.brand_snapshot_hash,
                "total_spreads": cat.spreads.count(),
                "created_at": cat.created_at.isoformat() if cat.created_at else None,
                "updated_at": cat.updated_at.isoformat() if cat.updated_at else None,
            })

        # 4. Cotas e Plano
        quota_data = {
            "tier": active_plan.tier if active_plan else "free",
            "plan_name": active_plan.name if active_plan else "Plano Gratuito",
            "monthly_token_quota": active_plan.monthly_token_quota if active_plan else 100000,
            "tokens_used_this_month": quota.tokens_used_this_month if quota else 0,
        }

        # 5. Historico de Faturas
        org = user.organizations.first() or user.owned_organizations.first()
        invoices_data = []
        if org:
            invoices = BillingInvoice.objects.filter(organization=org).order_by("-created_at")
            for inv in invoices:
                invoices_data.append({
                    "receipt_code": inv.receipt_code,
                    "plan_name": inv.plan.name if inv.plan else "Assinatura",
                    "amount_brl": float(inv.amount_brl),
                    "billing_interval": inv.billing_interval,
                    "status": inv.status,
                    "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                })

        from .models import Brand
        from .serializers_brand import BrandSerializer
        from .services.brand_intelligence import visible_organizations
        brands = Brand.objects.filter(organization__in=visible_organizations(user))

        export_payload = {
            "export_metadata": {
                "system": "Catana Studio 2.0",
                "export_date": timezone.now().isoformat(),
                "legal_basis": "LGPD (Lei Geral de Protecao de Dados - Artigo 18, V)",
                "data_subject": user.email,
            },
            "user_profile": user_info,
            "organizations": orgs_data,
            "catalogs": catalogs_data,
            "brands": BrandSerializer(brands, many=True, context={"request": request}).data,
            "ai_quota": quota_data,
            "billing_invoices": invoices_data,
        }

        response = HttpResponse(
            json.dumps(export_payload, indent=2, ensure_ascii=False),
            content_type="application/json; charset=utf-8"
        )
        response["Content-Disposition"] = f'attachment; filename="catana_export_{user.username}_{timezone.now().strftime("%Y%m%d")}.json"'
        return response
