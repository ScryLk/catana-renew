#!/usr/bin/env python
"""
Script para criar preferências de usuário e atividades de exemplo
"""

import os
import sys
import django
from datetime import timedelta
from django.utils import timezone

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import User, UserPreferences, Activity, Catalog

def create_user_preferences():
    """Criar preferências para todos os usuários que não possuem"""
    users = User.objects.all()
    created_count = 0

    for user in users:
        preferences, created = UserPreferences.objects.get_or_create(
            user=user,
            defaults={
                'language': 'pt-BR',
                'theme': 'dark',
                'notify_on_publish': True,
                'notify_on_updates': True,
            }
        )
        if created:
            created_count += 1
            print(f"✓ Preferências criadas para {user.username}")
        else:
            print(f"- Preferências já existem para {user.username}")

    print(f"\n{created_count} preferências criadas!")
    return created_count

def create_sample_activities():
    """Criar atividades de exemplo para usuários"""
    users = User.objects.all()
    catalogs = list(Catalog.objects.all()[:5])

    if not catalogs:
        print("Nenhum catálogo encontrado. Pulando criação de atividades.")
        return 0

    activities_data = [
        {
            'action': 'Catálogo editado',
            'description': 'Editou o catálogo',
            'hours_ago': 2
        },
        {
            'action': 'Catálogo publicado',
            'description': 'Publicou um novo catálogo',
            'hours_ago': 24
        },
        {
            'action': 'Produto adicionado',
            'description': 'Adicionou novos produtos ao catálogo',
            'hours_ago': 48
        },
        {
            'action': 'Login realizado',
            'description': 'Acessou o sistema',
            'hours_ago': 1
        },
    ]

    created_count = 0

    for user in users[:3]:  # Criar atividades para os primeiros 3 usuários
        print(f"\nCriando atividades para {user.username}...")

        for idx, activity_info in enumerate(activities_data):
            catalog = catalogs[idx % len(catalogs)] if 'Catálogo' in activity_info['action'] else None

            activity, created = Activity.objects.get_or_create(
                user=user,
                action=activity_info['action'],
                catalog=catalog,
                defaults={
                    'description': activity_info['description'],
                    'timestamp': timezone.now() - timedelta(hours=activity_info['hours_ago']),
                    'organization': user.organizations.first() if user.organizations.exists() else None,
                }
            )

            if created:
                created_count += 1
                print(f"  ✓ {activity_info['action']}")

    print(f"\n{created_count} atividades criadas!")
    return created_count

if __name__ == '__main__':
    print("=" * 60)
    print("CRIANDO PREFERÊNCIAS DE USUÁRIO E ATIVIDADES")
    print("=" * 60)
    print()

    # Criar preferências
    prefs_count = create_user_preferences()

    print("\n" + "=" * 60)

    # Criar atividades de exemplo
    activities_count = create_sample_activities()

    print("\n" + "=" * 60)
    print("CONCLUÍDO!")
    print(f"- {prefs_count} preferências criadas")
    print(f"- {activities_count} atividades criadas")
    print("=" * 60)
