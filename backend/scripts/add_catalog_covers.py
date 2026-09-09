#!/usr/bin/env python3
"""
Script para adicionar imagens de capa aos catálogos.
"""

import os
import sys
import django
import requests
from io import BytesIO
from django.core.files import File
from django.core.files.temp import NamedTemporaryFile

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import Catalog, Media
from django.contrib.auth import get_user_model

User = get_user_model()

# Imagens de capa para cada catálogo
CATALOG_COVERS = {
    'Catálogo Geral Catana 2025': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200',
    'Linha Food Service Premium': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200',
    'Embalagens para Confeitaria': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200',
    'Soluções para Açougues e Hortifruti': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=1200',
    'Linha Festa - Eventos Especiais': 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200',
}

def download_image(url, catalog_title):
    """Baixa imagem da URL"""
    try:
        print(f"  📥 Baixando capa para: {catalog_title}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return BytesIO(response.content)
    except Exception as e:
        print(f"  ❌ Erro ao baixar imagem: {e}")
        return None

def create_media_from_url(url, name, organization, sede, user):
    """Cria objeto Media a partir de URL"""
    try:
        img_data = download_image(url, name)
        if not img_data:
            return None

        # Criar arquivo temporário
        img_temp = NamedTemporaryFile(delete=True)
        img_temp.write(img_data.getvalue())
        img_temp.flush()

        # Criar Media
        media = Media(
            name=f"Capa - {name}.jpg",
            organization=organization,
            sede=sede,
            uploaded_by=user,
            media_type='image'
        )
        media.file.save(f"catalog_cover_{name.lower().replace(' ', '_')}.jpg", File(img_temp), save=True)

        print(f"  ✅ Capa criada: {media.name}")
        return media

    except Exception as e:
        print(f"  ❌ Erro ao criar mídia: {e}")
        return None

def add_covers_to_catalogs():
    """Adiciona capas aos catálogos"""
    print("\n" + "="*60)
    print("🖼️  ADICIONANDO CAPAS AOS CATÁLOGOS")
    print("="*60)

    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("❌ Erro: Nenhum usuário admin encontrado!")
        return

    catalogs = Catalog.objects.all()

    if not catalogs.exists():
        print("❌ Erro: Nenhum catálogo encontrado!")
        return

    organization = catalogs.first().organization
    sede = catalogs.first().sede

    success_count = 0
    skip_count = 0
    error_count = 0

    for catalog in catalogs:
        print(f"\n📚 Processando: {catalog.title}")

        # Verificar se já tem capa
        if catalog.theme and hasattr(catalog.theme, 'cover_image'):
            # O modelo Catalog não tem cover_image diretamente
            # Vamos usar o campo theme que existe
            pass

        # Buscar URL da imagem
        image_url = CATALOG_COVERS.get(catalog.title)
        if not image_url:
            print(f"  ⚠️  URL de capa não encontrada para: {catalog.title}")
            error_count += 1
            continue

        # Criar mídia
        media = create_media_from_url(
            image_url,
            catalog.title,
            organization,
            sede,
            user
        )

        if media:
            catalog.cover_image = media
            catalog.save()
            success_count += 1
            print(f"  ✅ Capa associada ao catálogo!")
        else:
            error_count += 1

    # Resumo
    print("\n" + "="*60)
    print("📊 RESUMO")
    print("="*60)
    print(f"✅ Capas adicionadas: {success_count}")
    print(f"⏭️  Catálogos pulados: {skip_count}")
    print(f"❌ Erros: {error_count}")
    print(f"📚 Total de catálogos: {catalogs.count()}")
    print("="*60 + "\n")

if __name__ == '__main__':
    add_covers_to_catalogs()
