# Scripts utilitários (catana-back)

Scripts ad-hoc de seed/diagnóstico que tocam o banco diretamente. NÃO são
testes automatizados (a suíte real está em `api/tests/`).

Rode sempre a partir da raiz `catana-back/` com o ambiente configurado:

```bash
cd catana-back
python scripts/seed_database.py
```

- `seed_database.py`, `insert_fake_products.py`, `add_product_images.py`,
  `add_catalog_covers.py`, `create_user_preferences.py` — populam dados.
- `fix_media_names.py`, `fix_media_types.py` — correções pontuais de mídia.
- `inspect_sharing.py`, `verify_catalog_filtering.py`, `verify_unauth_creation.py` — diagnóstico.
- `test_*.py` / `test_*.sh` — chamadas manuais à API (curl/requests), não automatizadas.

Leia cada script antes de executar: vários escrevem/alteram registros.
