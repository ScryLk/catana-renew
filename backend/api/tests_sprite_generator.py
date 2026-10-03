import os
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from PIL import Image

from api.services.sprite_generator import SpriteGeneratorService
from api.models import User


class SpriteGeneratorTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('studio_sprite_generate')

    def test_01_service_generates_valid_transparent_sprite(self):
        """
        Valida se o SpriteGeneratorService gera um arquivo PNG com canal alfa transparente.
        """
        res = SpriteGeneratorService.generate_sprite(
            prompt="Chuva de meteoros com rastros de luz diagonal",
            palette=["#B08D57", "#1E293B"]
        )

        self.assertIn("sprite_url", res)
        self.assertTrue(res["has_transparency"])
        self.assertGreater(res["width"], 0)
        self.assertGreater(res["height"], 0)
        self.assertIn("Chuva de meteoros", res["prompt_used"])

    def test_02_endpoint_generates_sprite_successfully(self):
        """
        Valida chamada via API REST POST /api/v2/studio/sprites/generate/.
        """
        payload = {
            "prompt": "Selo de cera bordô vintage com brasao",
            "palette": ["#800020", "#D4AF37"],
            "style": "editorial_sticker"
        }
        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("sprite_url", data)
        self.assertTrue(data.get("has_transparency", False))

    def test_03_endpoint_rejects_empty_prompt(self):
        """
        Valida que o endpoint rejeita requisicoes sem prompt.
        """
        response = self.client.post(self.url, {"prompt": "   "}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.json())

    def test_04_procedural_keywords_handling(self):
        """
        Valida se o gerador suporta diferentes palavras-chave (folhas, estrelas, selos, meteoros).
        """
        keywords = [
            "ramo de oliveira com folhas douradas",
            "estrela de 4 pontas luminescente",
            "brasao geometrico minimalista"
        ]
        for kw in keywords:
            res = SpriteGeneratorService.generate_sprite(prompt=kw)
            self.assertIn("sprite_url", res)
            self.assertTrue(res["sprite_url"].endswith(".png"))
