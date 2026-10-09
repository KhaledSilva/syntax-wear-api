# Plano de revisão de segurança, performance e manutenção

Este documento reúne os achados da revisão da API Syntax Wear e propõe uma
sequência de trabalho. É um planejamento: nenhuma correção ou alteração de
código foi realizada como parte desta revisão.

## Prioridades

| Prioridade | Tema | Achado ou objetivo |
| --- | --- | --- |
| P0 — imediato | Credenciais | A seleção do IDE/chat expôs valores de `DATABASE_URL` e `JWT_SECRET`. Os valores não são reproduzidos neste documento. |
| P1 — alta | Controle de acesso | Rotas de escrita de produtos e categorias não aplicam autenticação nem autorização administrativa. |
| P1 — alta | Pedidos e pagamento | O dono de um pedido pode avançar seu status para `CONFIRMED` e `PAID` pela atualização da API, sem confirmação de pagamento. |
| P2 — média | Performance | A listagem de pedidos não pagina os resultados e inclui itens e dados de produto. |
| P2 — média | Performance | A busca textual de produtos usa correspondência parcial em vários campos e pode ficar cara sem estratégia de índice apropriada. |
| P2 — média | Manutenibilidade | A construção dos filtros de produto usa `Record<string, any>`, reduzindo a segurança de tipos. |
| P2 — média | Qualidade | Não foram encontrados testes automatizados da aplicação nem script de testes no `package.json`. |

## Plano passo a passo

### 1. Conter a exposição de credenciais — imediato

1. Rotacionar a senha/credencial usada pela URL de conexão do PostgreSQL/Supabase.
2. Gerar um novo segredo JWT forte e atualizar as variáveis nos ambientes que executam a API.
3. Invalidar tokens assinados com o segredo exposto; considerar que a troca do segredo invalida os tokens atuais.
4. Verificar que `.env` está excluído do controle de versão e que `.env.example` contém somente valores fictícios.
5. Revisar logs e acessos ao banco no período em que as credenciais podem ter estado expostas.
6. Não copiar os valores antigos ou novos para issues, commits, documentação ou mensagens.

**Critérios de conclusão:** credenciais antigas não autenticam; a API e os processos de implantação usam as novas variáveis; nenhum segredo real está versionado ou documentado.

### 2. Proteger escrita do catálogo — alta

1. Identificar as rotas de criação, atualização e desativação de produtos em `src/routes/products.routes.ts`.
2. Aplicar autenticação JWT nessas rotas.
3. Implementar ou reutilizar uma verificação de papel `ADMIN` como autorização adicional; autenticação, sozinha, não deve permitir escrita a usuários comuns.
4. Aplicar o mesmo padrão às rotas de escrita de categorias em `src/routes/categories.routes.ts`.
5. Conferir a documentação OpenAPI para declarar os requisitos de segurança das rotas protegidas.
6. Testar chamadas sem token, com token inválido, como usuário comum e como `ADMIN`.

**Critérios de conclusão:** requisições anônimas e de usuários comuns não alteram catálogo ou categorias; usuários `ADMIN` autorizados mantêm as operações previstas.

### 3. Restringir transições de estado de pedidos — alta

1. Revisar a regra de autorização em `src/services/orders.service.ts`, separando transições permitidas ao comprador das transições operacionais.
2. Impedir que o comprador declare por conta própria que o pedido foi confirmado ou pago.
3. Definir que `PAID` seja atribuído somente por uma integração confiável de pagamento ou por um fluxo administrativo explicitamente autorizado.
4. Definir quais transições de envio e entrega podem ser feitas por `ADMIN` ou por processos confiáveis.
5. Preservar as regras de propriedade do pedido e de cancelamento já existentes, ajustando-as apenas conforme a política aprovada.
6. Cobrir transições autorizadas e negadas em testes de serviço e integração.

**Critérios de conclusão:** o dono do pedido não consegue forçar estados de pagamento ou fulfillment; as transições legítimas e regras de cancelamento continuam funcionando.

### 4. Revisar configuração e respostas de erro — alta

1. Restringir a configuração de CORS em `src/app.ts` às origens efetivamente utilizadas pelos clientes, especialmente por estar habilitado o envio de credenciais.
2. Validar variáveis obrigatórias como `JWT_SECRET` e `DATABASE_URL` durante a inicialização, sem valores padrão inseguros.
3. Revisar se documentação interativa da API deve permanecer pública em cada ambiente.
4. Remover detalhes internos de respostas públicas de erro em `src/middlewares/error.middleware.ts`; registrar diagnósticos nos logs do servidor sem incluir segredos ou dados pessoais.
5. Testar origens CORS permitidas e negadas, configuração ausente e respostas para erros inesperados.

**Critérios de conclusão:** configuração inválida interrompe a inicialização com diagnóstico operacional; erros não revelam mensagens internas; CORS não aceita origens não aprovadas com credenciais.

### 5. Adicionar testes e proteções contra regressões — alta

1. Definir uma infraestrutura de testes compatível com Fastify, Prisma e o banco de teste disponível.
2. Adicionar testes de autorização para rotas de produtos, categorias e pedidos.
3. Cobrir validação de entrada, isolamento de pedidos por usuário e permissões de `ADMIN`.
4. Testar transições de status, especialmente tentativas de marcar pedidos como pagos sem confirmação confiável.
5. Adicionar execução de testes e verificação TypeScript ao processo de CI.

**Critérios de conclusão:** os casos de segurança acima são reproduzíveis em testes automatizados e a CI falha quando uma regressão é introduzida.

### 6. Melhorar performance das listagens

1. Adicionar paginação à listagem de pedidos em `src/services/orders.service.ts`, com limites máximos documentados.
2. Decidir se a API precisa retornar todos os detalhes dos itens em cada listagem ou se deve disponibilizar detalhes sob demanda.
3. Medir consultas representativas de produtos em PostgreSQL/Supabase com volume próximo ao esperado.
4. Avaliar índices e estratégia de busca para os filtros usados em `src/services/products.service.ts`; busca parcial (`contains`) pode não aproveitar índices B-tree convencionais.
5. Avaliar paginação por cursor para grandes volumes, mantendo paginação por deslocamento se o volume e os requisitos atuais forem pequenos.
6. Medir antes e depois com planos de consulta e latência, evitando adicionar índices sem justificar custo de escrita e armazenamento.

**Critérios de conclusão:** listagens têm limites previsíveis, consultas críticas foram medidas e as mudanças de índices ou paginação demonstram melhoria sem alterar os resultados funcionais esperados.

### 7. Melhorar tipagem e consistência

1. Substituir `Record<string, any>` na construção de filtros de produtos pelo tipo Prisma apropriado ou por uma composição tipada equivalente.
2. Revisar conversões de tipos feitas após validação Zod para evitar casts desnecessários.
3. Padronizar schemas, respostas de erro e tratamento de exceções entre controllers e services.
4. Usar tipos de entrada e saída explícitos nos pontos de fronteira entre rotas, controllers e services.
5. Rodar build TypeScript e testes após cada alteração relacionada.

**Critérios de conclusão:** compilação estrita passa sem novos erros e os filtros continuam limitados pelos schemas de entrada.

## Ordem sugerida de execução

1. Rotacionar e invalidar credenciais expostas.
2. Proteger mutações de produtos e categorias com autenticação e papel `ADMIN`.
3. Restringir transições de pedido ligadas a pagamento e fulfillment.
4. Ajustar CORS, validação de configuração e exposição de erros.
5. Criar testes automatizados para os controles e regras acima.
6. Medir e implementar paginação/otimização das consultas.
7. Refatorar tipos e consistência do código, validando com build e testes.

## Escopo e observações

- A revisão disponível cobre a API deste repositório; o código do frontend React não foi localizado nesta aplicação e não está incluído no plano.
- Itens comuns a APIs REST — como validação, limitação de requisições, controle de acesso, gestão de segredos, logs e consultas — devem ser verificados durante a execução das etapas; este documento registra prioritariamente os achados observados no código revisado.
- Não há aprovação implícita para implementar as etapas: este arquivo descreve o trabalho proposto para uma execução posterior.
