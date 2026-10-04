# Planejamento: CRUD de categorias e vínculo com produtos

Este documento descreve o planejamento para implementar o CRUD de categorias e relacioná-las aos produtos existentes. A implementação deve seguir o padrão adotado no CRUD de produtos e considerar os requisitos de [PRD-backend.md](./PRD-backend.md).

> Este arquivo registra somente o planejamento. Nenhuma alteração de schema, migration ou código faz parte desta etapa.

## Etapa 1 — Schema Prisma, migration e banco

- Criar o modelo `Category`, seguindo o PRD, com os campos `id`, `name`, `slug` único e `description` opcional.
- Relacionar `Category` e `Product` como um-para-muitos: uma categoria pode ter vários produtos.
- Adicionar o vínculo inverso no modelo `Product`, incluindo `categoryId`.
- Gerar uma migration com nome descritivo e aplicá-la ao banco de desenvolvimento.
- Definir como relacionar os produtos existentes antes de tornar `categoryId` obrigatório. A migration deve contemplar os registros já existentes.

**Resultado esperado:** schema Prisma atualizado e relação consistente entre categorias e produtos no banco.

## Etapa 2 — Services e regras de negócio

- Criar um service de categorias com operações para listar, buscar por ID, criar, atualizar e excluir.
- Aplicar regras de negócio, incluindo unicidade do slug e verificação de existência da categoria.
- Atualizar o service de produtos para receber, filtrar e persistir `categoryId`.
- Definir o comportamento ao excluir uma categoria que ainda tenha produtos vinculados. Uma possibilidade é impedir a exclusão enquanto houver vínculos, mas essa regra precisa ser confirmada.

**Resultado esperado:** operações de persistência e regras de negócio centralizadas nos services, seguindo o padrão existente para produtos.

## Etapa 3 — Controller, tipos e validação

- Criar o controller de categorias para validar requisições, chamar os services e montar respostas HTTP.
- Definir tipos compartilhados para criação, atualização e filtros de categoria.
- Criar schemas Zod para dados de categoria e parâmetros de rota.
- Atualizar tipos, schemas e controller de produtos para aceitar e validar o vínculo com categoria.
- Gerar o slug a partir do nome, seguindo o padrão usado no CRUD de produtos.

**Resultado esperado:** dados validados em runtime, com controllers separados das regras de persistência.

## Etapa 4 — Rotas, documentação e verificação

- Registrar as rotas de categorias conforme o PRD: consulta pública de categorias e operações administrativas em `/admin/categories`.
- Atualizar as rotas de produtos para aceitar e documentar `categoryId`, além de oferecer filtro por categoria na listagem.
- Documentar endpoints, parâmetros e respostas para OpenAPI/Scalar.
- Verificar autenticação e autorização das rotas administrativas. Atualmente o projeto verifica JWT nas rotas de produtos, mas não possui verificação de papel `ADMIN`; essa autorização precisa ser considerada para atender às rotas administrativas previstas no PRD.
- Validar a implementação com build e testes disponíveis no projeto.

**Resultado esperado:** CRUD disponível pelas rotas previstas, produtos vinculados a categorias e documentação alinhada ao comportamento implementado.

## Decisões pendentes

1. **Produtos existentes:** como atribuir categoria aos registros atuais antes de tornar `categoryId` obrigatório? Uma possibilidade é criar uma categoria inicial na migration e associar os produtos existentes a ela.
2. **Exclusão de categoria:** impedir a exclusão enquanto houver produtos vinculados ou adotar outra regra de relacionamento?
3. **Rotas públicas e administrativas:** confirmar quais operações de categoria serão públicas e quais exigirão JWT e papel `ADMIN`, conforme o PRD.
