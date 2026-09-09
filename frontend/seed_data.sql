-- 🌱 Script SQL - Dados Fictícios para Testes
-- Execute este script diretamente no PostgreSQL/MySQL

-- ============================================
-- 1. CRIAR ORGANIZAÇÃO E SEDE
-- ============================================

INSERT INTO organizations (name, description, is_active, created_at, updated_at)
VALUES ('Catana Demo', 'Organização de demonstração', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO sedes (name, organization_id, is_active, created_at, updated_at)
VALUES ('Sede Principal', (SELECT id FROM organizations WHERE name = 'Catana Demo'), true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. CRIAR CATEGORIAS
-- ============================================

INSERT INTO categories (name, description, created_at, updated_at) VALUES
('Moda Feminina', 'Roupas e acessórios femininos', NOW(), NOW()),
('Moda Masculina', 'Roupas e acessórios masculinos', NOW(), NOW()),
('Eletrônicos', 'Produtos eletrônicos e tecnologia', NOW(), NOW()),
('Casa e Decoração', 'Itens para casa e decoração', NOW(), NOW()),
('Alimentos e Bebidas', 'Produtos alimentícios', NOW(), NOW()),
('Esportes', 'Artigos esportivos', NOW(), NOW()),
('Beleza e Cosméticos', 'Produtos de beleza', NOW(), NOW()),
('Livros', 'Livros e publicações', NOW(), NOW()),
('Brinquedos', 'Brinquedos infantis', NOW(), NOW()),
('Automóveis', 'Produtos automotivos', NOW(), NOW()),
('Saúde', 'Produtos de saúde', NOW(), NOW()),
('Pets', 'Produtos para pets', NOW(), NOW()),
('Joias', 'Joias e acessórios', NOW(), NOW()),
('Arte', 'Arte e artesanato', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CRIAR USUÁRIOS
-- ============================================

-- Usuário 1: Empresa
INSERT INTO auth_user (username, email, first_name, last_name, is_active, is_staff, is_superuser, date_joined, password)
VALUES
('loja_moda_sp', 'loja_moda_sp@example.com', 'Loja', 'Moda SP', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('tech_store', 'tech_store@example.com', 'Tech', 'Store', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('casa_bella', 'casa_bella@example.com', 'Casa', 'Bella', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('alimentos_br', 'alimentos_br@example.com', 'Alimentos', 'BR', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('sports_pro', 'sports_pro@example.com', 'Sports', 'Pro', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),

-- Usuário 2: Criadores
('joao_designer', 'joao@example.com', 'João', 'Silva', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('maria_artista', 'maria@example.com', 'Maria', 'Santos', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('pedro_foto', 'pedro@example.com', 'Pedro', 'Oliveira', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('ana_criativa', 'ana@example.com', 'Ana', 'Costa', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('lucas_dev', 'lucas@example.com', 'Lucas', 'Ferreira', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),

-- Usuário 3: Revendedores
('revenda_electronics', 'revenda_elec@example.com', 'Revenda', 'Electronics', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('distribuidora_sul', 'dist_sul@example.com', 'Distribuidora', 'Sul', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('comercio_norte', 'com_norte@example.com', 'Comércio', 'Norte', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('atacado_central', 'atacado@example.com', 'Atacado', 'Central', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123'),
('varejo_express', 'varejo@example.com', 'Varejo', 'Express', true, false, false, NOW(), 'pbkdf2_sha256$260000$demo123')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. CRIAR PERFIS PÚBLICOS
-- ============================================

INSERT INTO public_profiles (
    user_id, username, display_name, bio, description, profile_type,
    segments, city, state, country, visibility, show_in_search,
    allow_messages, allow_follows, created_at, updated_at
) VALUES
-- Empresas
(
    (SELECT id FROM auth_user WHERE username = 'loja_moda_sp'),
    'loja_moda_sp',
    'Loja Moda SP',
    'Especialista em moda feminina há mais de 10 anos',
    'Somos uma loja especializada em moda feminina com as últimas tendências do mercado. Trabalhamos com marcas nacionais e importadas de alta qualidade.',
    'empresa',
    '["Moda", "Acessórios"]',
    'São Paulo',
    'SP',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'tech_store'),
    'tech_store',
    'Tech Store',
    'Oferecemos o melhor em eletrônicos com qualidade garantida',
    'Loja especializada em produtos eletrônicos e tecnologia de ponta. Atendemos todo o Brasil com as melhores marcas do mercado.',
    'empresa',
    '["Eletrônicos", "Tecnologia"]',
    'Rio de Janeiro',
    'RJ',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'casa_bella'),
    'casa_bella',
    'Casa Bella Decorações',
    'Criando ambientes únicos em decoração',
    'Especialistas em decoração e design de interiores. Produtos exclusivos para transformar sua casa.',
    'empresa',
    '["Casa", "Decoração"]',
    'Belo Horizonte',
    'MG',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'alimentos_br'),
    'alimentos_br',
    'Alimentos Brasil',
    'Sua melhor escolha em alimentos naturais',
    'Fornecemos alimentos selecionados e naturais com origem certificada. Qualidade do campo à sua mesa.',
    'empresa',
    '["Alimentos", "Bebidas"]',
    'Curitiba',
    'PR',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'sports_pro'),
    'sports_pro',
    'Sports Pro',
    'Inovação e qualidade em artigos esportivos',
    'Equipamentos e roupas esportivas das melhores marcas. Tudo para você alcançar seus objetivos.',
    'empresa',
    '["Esportes", "Fitness"]',
    'Porto Alegre',
    'RS',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),

-- Criadores
(
    (SELECT id FROM auth_user WHERE username = 'joao_designer'),
    'joao_designer',
    'João Silva',
    'Designer gráfico criando catálogos únicos',
    'Sou designer gráfico especializado em criação de catálogos digitais para e-commerce. Mais de 500 projetos entregues.',
    'criador',
    '["Design", "Marketing"]',
    'São Paulo',
    'SP',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'maria_artista'),
    'maria_artista',
    'Maria Santos',
    'Artista visual e criadora de conteúdo',
    'Criação de catálogos artísticos e visuais para marcas de moda e lifestyle. Foco em storytelling visual.',
    'criador',
    '["Arte", "Design"]',
    'Rio de Janeiro',
    'RJ',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'pedro_foto'),
    'pedro_foto',
    'Pedro Oliveira',
    'Fotógrafo profissional de produtos',
    'Especializado em fotografia de produtos para e-commerce. Seus produtos com o melhor acabamento visual.',
    'criador',
    '["Fotografia", "Design"]',
    'Brasília',
    'DF',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'ana_criativa'),
    'ana_criativa',
    'Ana Costa',
    'Especialista em marketing digital e catálogos',
    'Ajudo empresas a criar catálogos que vendem. Consultoria em marketing digital e estratégia de vendas.',
    'criador',
    '["Marketing", "Vendas"]',
    'Fortaleza',
    'CE',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'lucas_dev'),
    'lucas_dev',
    'Lucas Ferreira',
    'Desenvolvedor de soluções para e-commerce',
    'Desenvolvimento de catálogos interativos e soluções tecnológicas para vendas online.',
    'criador',
    '["Tecnologia", "E-commerce"]',
    'Recife',
    'PE',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),

-- Revendedores
(
    (SELECT id FROM auth_user WHERE username = 'revenda_electronics'),
    'revenda_electronics',
    'Revenda Electronics',
    'Revenda autorizada de eletrônicos',
    'Revenda oficial das principais marcas de eletrônicos. Preços competitivos e garantia total.',
    'revendedor',
    '["Eletrônicos"]',
    'Campinas',
    'SP',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'distribuidora_sul'),
    'distribuidora_sul',
    'Distribuidora Sul',
    'Distribuição para todo o Sul do Brasil',
    'Distribuidora especializada atendendo Santa Catarina, Paraná e Rio Grande do Sul.',
    'revendedor',
    '["Diversos"]',
    'Florianópolis',
    'SC',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'comercio_norte'),
    'comercio_norte',
    'Comércio Norte',
    'Revenda de produtos diversos',
    'Comércio atacadista e varejista com ampla variedade de produtos.',
    'revendedor',
    '["Diversos"]',
    'Manaus',
    'AM',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'atacado_central'),
    'atacado_central',
    'Atacado Central',
    'Atacado com os melhores preços',
    'Preços de atacado para lojistas e revendedores. Compre em quantidade e economize.',
    'revendedor',
    '["Moda", "Casa"]',
    'Goiânia',
    'GO',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
),
(
    (SELECT id FROM auth_user WHERE username = 'varejo_express'),
    'varejo_express',
    'Varejo Express',
    'Varejo rápido e prático',
    'Entrega rápida de produtos diversos. Compre hoje, receba amanhã.',
    'revendedor',
    '["Diversos"]',
    'Salvador',
    'BA',
    'Brasil',
    'publico',
    true,
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. CRIAR CATÁLOGOS DE EXEMPLO
-- ============================================

-- Catálogos para Loja Moda SP
INSERT INTO catalogs (title, description, organization_id, sede_id, created_by_id, is_public, status, created_at, updated_at)
SELECT
    'Coleção Verão 2025',
    'Moda feminina leve e colorida para o verão',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM auth_user WHERE username = 'loja_moda_sp'),
    true,
    'published',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM catalogs WHERE title = 'Coleção Verão 2025');

INSERT INTO catalogs (title, description, organization_id, sede_id, created_by_id, is_public, status, created_at, updated_at)
SELECT
    'Black Friday Moda',
    'Ofertas imperdíveis em moda feminina',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM auth_user WHERE username = 'loja_moda_sp'),
    true,
    'published',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM catalogs WHERE title = 'Black Friday Moda');

-- Catálogos para Tech Store
INSERT INTO catalogs (title, description, organization_id, sede_id, created_by_id, is_public, status, created_at, updated_at)
SELECT
    'Lançamentos Tecnologia 2025',
    'Os melhores lançamentos em eletrônicos',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM auth_user WHERE username = 'tech_store'),
    true,
    'published',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM catalogs WHERE title = 'Lançamentos Tecnologia 2025');

INSERT INTO catalogs (title, description, organization_id, sede_id, created_by_id, is_public, status, created_at, updated_at)
SELECT
    'Promoção Games',
    'Jogos e consoles com desconto',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM auth_user WHERE username = 'tech_store'),
    true,
    'published',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM catalogs WHERE title = 'Promoção Games');

-- Catálogos para Casa Bella
INSERT INTO catalogs (title, description, organization_id, sede_id, created_by_id, is_public, status, created_at, updated_at)
SELECT
    'Decoração Moderna',
    'Peças modernas para sua casa',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM auth_user WHERE username = 'casa_bella'),
    true,
    'published',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM catalogs WHERE title = 'Decoração Moderna');

-- ============================================
-- 6. CRIAR PRODUTOS DE EXEMPLO
-- ============================================

-- Produtos para Coleção Verão 2025
INSERT INTO products (name, sku, price, description, category_id, stock, currency, image_main, organization_id, sede_id, catalog_id, created_by_id, created_at, updated_at)
SELECT
    'Vestido Floral Primavera',
    'SKU-VEST-001',
    189.90,
    'Lindo vestido floral perfeito para o verão',
    (SELECT id FROM categories WHERE name = 'Moda Feminina'),
    50,
    'BRL',
    'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM catalogs WHERE title = 'Coleção Verão 2025'),
    (SELECT id FROM auth_user WHERE username = 'loja_moda_sp'),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-VEST-001');

INSERT INTO products (name, sku, price, description, category_id, stock, currency, image_main, organization_id, sede_id, catalog_id, created_by_id, created_at, updated_at)
SELECT
    'Sandália Verão Colors',
    'SKU-SAND-001',
    129.90,
    'Sandália colorida e confortável',
    (SELECT id FROM categories WHERE name = 'Moda Feminina'),
    100,
    'BRL',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM catalogs WHERE title = 'Coleção Verão 2025'),
    (SELECT id FROM auth_user WHERE username = 'loja_moda_sp'),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-SAND-001');

-- Produtos para Tech Store
INSERT INTO products (name, sku, price, description, category_id, stock, currency, image_main, organization_id, sede_id, catalog_id, created_by_id, created_at, updated_at)
SELECT
    'Smartphone Pro Max',
    'SKU-PHONE-001',
    3499.90,
    'Smartphone top de linha com câmera profissional',
    (SELECT id FROM categories WHERE name = 'Eletrônicos'),
    30,
    'BRL',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM catalogs WHERE title = 'Lançamentos Tecnologia 2025'),
    (SELECT id FROM auth_user WHERE username = 'tech_store'),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-PHONE-001');

INSERT INTO products (name, sku, price, description, category_id, stock, currency, image_main, organization_id, sede_id, catalog_id, created_by_id, created_at, updated_at)
SELECT
    'Notebook Gaming Ultra',
    'SKU-NOTE-001',
    4999.90,
    'Notebook gamer com placa de vídeo dedicada',
    (SELECT id FROM categories WHERE name = 'Eletrônicos'),
    15,
    'BRL',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400',
    (SELECT id FROM organizations WHERE name = 'Catana Demo'),
    (SELECT id FROM sedes WHERE name = 'Sede Principal'),
    (SELECT id FROM catalogs WHERE title = 'Lançamentos Tecnologia 2025'),
    (SELECT id FROM auth_user WHERE username = 'tech_store'),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SKU-NOTE-001');

-- ============================================
-- 7. CRIAR INTERAÇÕES (FOLLOWS)
-- ============================================

-- João segue várias lojas
INSERT INTO profile_follows (follower_id, followed_profile_id, created_at)
SELECT
    (SELECT id FROM auth_user WHERE username = 'joao_designer'),
    id,
    NOW()
FROM public_profiles
WHERE username IN ('loja_moda_sp', 'tech_store', 'casa_bella')
ON CONFLICT DO NOTHING;

-- Maria segue criadores e lojas
INSERT INTO profile_follows (follower_id, followed_profile_id, created_at)
SELECT
    (SELECT id FROM auth_user WHERE username = 'maria_artista'),
    id,
    NOW()
FROM public_profiles
WHERE username IN ('loja_moda_sp', 'joao_designer', 'pedro_foto')
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. CRIAR LIKES EM CATÁLOGOS
-- ============================================

-- Vários usuários curtindo catálogos
INSERT INTO catalog_likes (user_id, catalog_id, created_at)
SELECT
    (SELECT id FROM auth_user WHERE username = 'joao_designer'),
    id,
    NOW()
FROM catalogs
WHERE title IN ('Coleção Verão 2025', 'Lançamentos Tecnologia 2025')
ON CONFLICT DO NOTHING;

INSERT INTO catalog_likes (user_id, catalog_id, created_at)
SELECT
    (SELECT id FROM auth_user WHERE username = 'maria_artista'),
    id,
    NOW()
FROM catalogs
WHERE title IN ('Coleção Verão 2025', 'Decoração Moderna')
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Contar registros criados
SELECT 'Usuários' as tipo, COUNT(*) as total FROM auth_user WHERE email LIKE '%@example.com'
UNION ALL
SELECT 'Perfis Públicos', COUNT(*) FROM public_profiles
UNION ALL
SELECT 'Catálogos', COUNT(*) FROM catalogs
UNION ALL
SELECT 'Produtos', COUNT(*) FROM products
UNION ALL
SELECT 'Categorias', COUNT(*) FROM categories
UNION ALL
SELECT 'Follows', COUNT(*) FROM profile_follows
UNION ALL
SELECT 'Likes', COUNT(*) FROM catalog_likes;
