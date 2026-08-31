# Comex Control - Skip — guia de criação equivalente

Este guia descreve como reconstruir no [Skip](https://goskip.dev/) uma versão funcionalmente equivalente ao Comex Control atual, sem alterar o sistema que já está em produção.

## O que “idêntico” significa

A versão Skip deve preservar:

- aparência, navegação, responsividade e temas;
- empresas, usuários, papéis e isolamento;
- cadastro e edição de importações;
- quatro etapas operacionais e canais aduaneiros;
- mapa, posições comprovadas, rota, ETA e pesquisa;
- auditoria e relatórios;
- Google Sheets, n8n e rastreamento híbrido;
- 74 processos oficiais e 83 linhas-fonte auditáveis.

A implementação técnica será diferente:

| Sistema atual | Versão Skip |
|---|---|
| React 19 + vinext | Vite + React + React Router |
| Cloudflare D1 | Supabase PostgreSQL |
| Route handlers na borda | Supabase Edge Functions |
| Sessão privada Sites | Supabase Auth |
| Hospedagem Sites | Skip Cloud |
| MapLibre + OpenFreeMap | MapLibre + OpenFreeMap, após teste de pacote |

> Não tente gerar tudo em um único prompt. A documentação do Skip recomenda construir incrementalmente. Cada etapa abaixo deve ser aceita antes da próxima.

## 0. Pré-requisitos e regras de segurança

Prepare:

1. conta no Skip;
2. acesso ao GitHub `henrryquegabriel-boop/comex-control-skip`;
3. projeto Supabase exclusivo de homologação;
4. acesso ao n8n, mas sem ativar workflows durante a construção;
5. cópia controlada da planilha oficial;
6. logo e capturas de tela do Comex Control;
7. lista de usuários autorizados.

Nunca envie ao chat do Skip:

- service role do Supabase;
- tokens do n8n ou da hospedagem;
- Consumer Key/Secret de armadores;
- planilha oficial completa sem revisar dados pessoais;
- senha, client secret ou credencial SMTP.

Segredos devem ficar somente no Supabase/Skip Cloud Secrets ou no gerenciador de credenciais do n8n.

## 1. Criar o projeto no Skip

1. Acesse [goskip.dev](https://goskip.dev/).
2. Entre com a conta GitHub autorizada.
3. Crie um projeto em branco.
4. Nomeie-o **Comex Control - Skip**.
5. Não publique ainda.
6. Use o modo Chat/Ask para discutir o plano antes de consumir um build.

### Prompt 1 — contrato geral

```text
Crie a fundação de uma aplicação web chamada Comex Control.

Stack obrigatória: Vite, React, TypeScript, React Router, Tailwind CSS e componentes acessíveis compatíveis com shadcn/ui. Não use Next.js, dados fictícios apresentados como reais ou segredos no frontend.

Objetivo: gestão multiempresa de importações marítimas. A experiência visual deve lembrar um centro de controle logístico: mapa global dominante, barra lateral recolhível, painel lateral de detalhes, modo escuro como padrão, modo claro opcional e layout responsivo.

Nesta primeira etapa crie somente:
- rotas protegidas placeholder para /dashboard, /importacoes, /relatorios e /configuracoes;
- shell da aplicação com cabeçalho, empresa ativa, conta do usuário e navegação;
- design tokens para tema escuro/claro;
- estados de loading, vazio, erro e sem permissão;
- arquitetura de componentes e serviços, sem dados de demonstração permanentes.

Não implemente banco, autenticação, mapa nem APIs ainda. Ao terminar, apresente os arquivos criados e uma lista objetiva dos critérios atendidos.
```

### Aceite

- A aplicação abre sem erro.
- Rotas funcionam pelo React Router.
- O modo escuro é o padrão.
- Não há credenciais nem embarques inventados.
- Mobile e desktop não apresentam rolagem horizontal indevida.

## 2. Conectar o GitHub dedicado

Segundo a FAQ consultada em 31/08/2026, exportação/conexão GitHub integra o plano Premium. O plano gratuito anuncia 15 créditos mensais e cada ação de build consome um crédito; este roteiro contém 14 builds planejados, mas correções e refinamentos provavelmente exigirão margem adicional. Use Chat/Ask para planejar antes de cada build e confirme preço e condições no painel antes de contratar.

1. Abra **Código/GitHub** no Skip.
2. Autorize somente o acesso necessário.
3. Selecione `henrryquegabriel-boop/comex-control-skip`.
4. Confirme que o Skip não selecionou `comex-control`.
5. Crie um checkpoint antes da primeira sincronização.
6. Verifique no GitHub quais arquivos o Skip pretende gravar.

Se o Skip não aceitar um repositório já inicializado, exporte o código para download e faça a integração manual depois. Não apague o README de separação do projeto.

## 3. Criar e conectar o Supabase de homologação

Crie um projeto separado, sugerido como `comex-control-skip-hml`. Não conecte inicialmente ao banco de produção.

1. No Skip, clique no ícone do Supabase.
2. Autorize a organização correta.
3. Selecione o projeto de homologação.
4. Confirme que URL e chave publicável foram configuradas pela integração.
5. Garanta que a service role não aparece em arquivos do frontend.

### Prompt 2 — modelo de dados

```text
Conecte a aplicação ao Supabase já selecionado e gere migrations versionadas para um modelo multiempresa.

Crie as tabelas:
companies, company_memberships, user_profiles, imports, import_details, containers, import_containers, container_positions, container_status_history, import_customs_channel_history, carrier_registry, carrier_aliases, tracking_receipts, tracking_dispatches, integration_errors, access_audit_logs, identity_verifications, import_source_rows, import_reference_options, official_data_batches e sheet_sync_outbox.

Regras obrigatórias:
- UUID como chave primária;
- company_id obrigatório em toda entidade operacional ou de auditoria;
- timestamps UTC;
- versionamento otimista em imports e containers;
- chaves únicas compostas pela empresa;
- import_containers muitos-para-muitos;
- payload bruto em jsonb apenas no backend;
- tracking_receipts e outbox idempotentes;
- audit logs append-only;
- índices para company_id, container_number, internal_reference, status, ETA e datas.

Não carregue dados oficiais ainda. Entregue migration, tipos TypeScript e um diagrama textual das relações. Não desabilite RLS.
```

### Aceite

- Todas as tabelas existem por migration.
- Não há tabela operacional sem `company_id`.
- O mesmo contêiner pode existir em empresas diferentes, mas não se duplica dentro da mesma empresa.
- Migrations podem ser reaplicadas em banco vazio.

## 4. Implantar papéis e RLS

Papéis obrigatórios:

| Papel | Consultar | Cadastrar/editar | Relatórios | Auditoria | Usuários |
|---|---:|---:|---:|---:|---:|
| OWNER | Sim | Sim | Sim | Sim | Sim |
| ADMIN | Sim | Sim | Sim | Sim | Sim, exceto OWNER |
| AUDITOR | Sim | Não | Sim | Sim | Não |
| OPERATOR | Sim | Sim | Não | Não | Não |
| VIEWER | Sim | Não | Não | Não | Não |

### Prompt 3 — autorização

```text
Implemente Row Level Security completa no Supabase para os papéis OWNER, ADMIN, AUDITOR, OPERATOR e VIEWER.

Requisitos:
- o usuário só enxerga empresas presentes em company_memberships;
- toda consulta e gravação operacional valida company_id;
- VIEWER e AUDITOR não gravam importações;
- AUDITOR pode ler relatórios e auditoria;
- OPERATOR não acessa relatórios nem usuários;
- ADMIN não cria, promove, altera ou remove OWNER;
- o último OWNER ativo de uma empresa não pode ser removido ou rebaixado;
- mudanças de membership geram access_audit_logs;
- service_role é usada somente por Edge Functions e n8n;
- nenhuma decisão de permissão deve depender apenas de botão oculto no frontend.

Crie testes SQL positivos e negativos para cada papel. Não use políticas permissivas do tipo USING (true).
```

### Aceite

Teste pelo menos:

- OWNER da QUALLY consegue editar QUALLY.
- OWNER da QUALLY sem vínculo com SAFRA não lê SAFRA.
- AUDITOR gera relatório, mas recebe bloqueio ao gravar.
- VIEWER recebe bloqueio em chamada direta à API.
- ADMIN não promove outro usuário para OWNER.

## 5. Configurar login Google e código por e-mail

1. No Supabase Auth, configure URL e redirects do preview e da futura produção.
2. Ative Google OAuth.
3. Configure template de OTP com código, não somente link.
4. Use SMTP transacional antes da produção.
5. Mantenha a aplicação fechada a usuários sem membership.

### Prompt 4 — autenticação reforçada

```text
Implemente autenticação em duas confirmações:
1) login Google pelo Supabase Auth;
2) código OTP enviado ao mesmo e-mail.

O painel só pode abrir quando:
- a sessão Google é válida;
- o OTP é válido e não expirou;
- os dois fluxos pertencem ao mesmo user.id e mesmo e-mail normalizado;
- existe company_membership ativa.

Guarde apenas o resultado e a expiração da confirmação em identity_verifications. Nunca grave access tokens no banco ou localStorage; se for necessário conservar temporariamente o token Google durante o OTP, use sessionStorage e remova depois.

Implemente telas de login, envio do código, validação, erro, expiração e acesso negado. Não permita criação automática de membership para qualquer novo usuário.
```

### Aceite

- E-mails diferentes são recusados.
- Código incorreto ou expirado é recusado.
- Usuário sem membership não acessa dados.
- Recarregar a página respeita a validade da confirmação.
- Logout encerra sessão e remove material temporário.

## 6. Reproduzir a interface principal

Anexe ao Skip capturas do Comex Control atual em desktop e mobile, sem expor dados sensíveis.

### Prompt 5 — dashboard e identidade

```text
Reproduza o dashboard Comex Control com fidelidade visual às imagens anexadas.

Estrutura:
- mapa global ocupando a área principal;
- barra lateral esquerda recolhível;
- topo com logo, nome Comex Control, empresa ativa, pesquisa e conta;
- lista de importações e watchlist na lateral;
- painel de detalhes à direita ao selecionar um contêiner;
- legenda de status no canto inferior esquerdo;
- legenda dos canais aduaneiros no canto inferior direito;
- modo escuro padrão, modo claro e quatro padrões de cores;
- controles com contraste AA, foco visível e navegação por teclado.

Status operacionais:
IMPORT_STARTED azul #38BDF8;
IN_TRANSIT violeta #8B5CF6;
PENDING rosa #EC4899;
COMPLETED teal #14B8A6.

Canais aduaneiros, dimensão independente:
NOT_ASSIGNED #64748B;
GREEN #008000;
YELLOW #FFFF00;
RED #FF0000;
GRAY #808080.

Use componentes reais conectáveis a dados; não fixe valores do exemplo no JSX.
```

## 7. Implementar CRUD completo de importações

### Prompt 6 — cadastro e edição

```text
Implemente listagem, cadastro, visualização e edição de importações usando Supabase e RLS.

O cadastro mínimo exige company_id e ao menos uma referência entre pedido, proforma, DI/DUIMP, B/L, booking ou contêiner. O formulário completo deve organizar os campos oficiais em grupos comercial, logístico, fiscal, financeiro e ALHO.

Requisitos:
- validar contêiner por ISO 6346;
- validade matemática não confirma existência no armador;
- salvar importação mesmo sem contêiner;
- criar vínculo import_containers somente para equipamento válido;
- impedir troca da empresa após criação;
- usar versionamento otimista;
- registrar ator e alterações;
- criar item na sheet_sync_outbox para alterações originadas no app;
- confirmar antes de descartar edição;
- retornar mensagens em português.
```

### Aceite

- Cadastro mínimo funciona.
- Edição atualiza banco e outbox.
- Concorrência retorna conflito, não sobrescreve silenciosamente.
- Um erro de validação não apaga o formulário.
- Perfil sem escrita recebe bloqueio no backend.

## 8. Implementar status e canais

### Prompt 7 — regras de negócio

```text
Implemente status operacional e canal aduaneiro como dimensões independentes.

Fluxo sequencial:
1 IMPORT_STARTED;
2 IN_TRANSIT;
3 PENDING;
4 COMPLETED.

Registre todas as transições em container_status_history. Eventos antigos podem entrar no histórico, mas não podem substituir snapshot novo. Regressão deve ser recusada ou registrada como ignorada com justificativa.

Canais:
NOT_ASSIGNED, GREEN, YELLOW, RED e GRAY.
Toda revelação ou alteração entra em import_customs_channel_history com ator, origem e data.

Uma importação com vários contêineres só fica COMPLETED quando todos estiverem entregues. Canal vermelho/cinza não muda automaticamente o status, mas torna o rastreamento crítico.
```

## 9. Implementar mapa e rastreamento visual

### Prompt 8 — mapa operacional

```text
Instale MapLibre GL JS e use um estilo OpenFreeMap compatível. Se o pacote não compilar no ambiente Skip, pare e apresente o erro; não substitua por mapa estático.

Implemente:
- pontos por contêiner com evento geográfico válido;
- ícone de navio quando houver vínculo confirmado;
- rota tracejada somente com duas ou mais posições históricas reportadas;
- movimento visual do navio para a última posição, sem inventar progresso;
- clustering para volume;
- pesquisa por contêiner, B/L e booking;
- fit bounds da rota;
- painel com rota, última posição, fonte, status traduzido, última checagem e ETA;
- aviso de que AIS representa o navio, não GPS do contêiner.

Não mostre no mapa posições UNKNOWN, ESTIMATED ou coordenadas inválidas. Um cadastro sem posição continua visível nas listas, mas não recebe ponto fictício.
```

## 10. Implementar relatórios e auditoria

### Prompt 9 — central de relatórios

```text
Crie a Central de Relatórios protegida por REPORTS_GENERATE.

Abas:
- resumo gerencial;
- importações;
- contêineres;
- canais aduaneiros;
- auditoria;
- qualidade e integrações.

Inclua filtros por empresa, período, status, canal, transportadora e ETA. Permita impressão e CSV.

No CSV:
- use UTF-8;
- nomes com prefixo comex-control;
- neutralize células iniciadas por =, +, - ou @;
- não exporte payload bruto, token ou segredo.

AUDITOR pode gerar e exportar. OPERATOR e VIEWER não podem acessar nem pela URL direta.
```

## 11. Criar Edge Functions para n8n

### Prompt 10 — contrato privado

```text
Crie Supabase Edge Functions privadas para:
- POST tracking-queue;
- POST container-upsert;
- POST integration-errors;
- GET/POST sheets-outbox;
- POST sheets-import-upsert;
- POST manual-refresh.

Autenticação:
- usuário Supabase para ações do site;
- Bearer N8N_INGEST_TOKEN armazenado em secret para n8n;
- company code obrigatório;
- idempotency key obrigatória em ingestões;
- CORS restrito às origens autorizadas;
- rate limit de 60 segundos no refresh manual.

container-upsert deve validar identidade do contêiner, timestamps, latitude/longitude completas, origem da posição, ordem dos eventos e idempotência. HTTP 200 sem persistência não é sucesso.

Produza OpenAPI/contrato de payload e testes automatizados. Não exponha service role ou token n8n no navegador.
```

## 12. Configurar Google Sheets bidirecional

Na planilha de homologação:

1. mantenha os 51 campos;
2. nomeie `TIPO DIFERENÇA CAMBIAL`;
3. renomeie o segundo canal numérico para `CANAL_CODIGO`;
4. acrescente `_SYNC_ID` e `_VERSAO`.

### Prompt 11 — outbox e conflitos

```text
Implemente no backend Supabase o contrato de sincronização bidirecional com Google Sheets via n8n.

Sheets para banco:
- receber linha completa;
- normalizar datas Excel, números brasileiros, status, canal e contêiner;
- usar _SYNC_ID imutável;
- não criar item de retorno imediato na outbox;
- rejeitar versão antiga quando houver alteração mais nova no app.

Banco para Sheets:
- toda criação/edição do app cria sheet_sync_outbox;
- confirmar por id do item e versão;
- falha permanece reprocessável;
- confirmação antiga não pode marcar alteração nova como sincronizada.

Não faça merge silencioso de edições simultâneas. Retorne conflito 409 com informações para reconciliação.
```

## 13. Implementar a política híbrida

### Prompt 12 — fila de rastreamento

```text
Implemente a política híbrida em função SQL/Edge Function, usando America/Sao_Paulo.

Padrão:
- cargas normais: 06h e 18h;
- críticas: a cada hora;
- críticas são PENDING, canal RED/GRAY, ETA vencida ou ETA em até 72 horas;
- COMPLETED nunca consulta automaticamente;
- manual com cooldown de 60 segundos;
- falhas aplicam backoff de 1, 2, 4, 8 e 12 horas;
- reserva atômica por empresa, transportadora, tipo e referência;
- concorrência não duplica despacho;
- sucesso zera falhas;
- webhooks válidos atualizam imediatamente.

Retorne somente trabalhos elegíveis. Não chame armadores dentro da função de seleção; o n8n consumirá a fila.
```

### Bancada numérica

Com 100 referências, 20 críticas e 80 normais em um mês de 31 dias:

- horário integral: 74.400 elegibilidades;
- duas vezes ao dia: 6.200;
- híbrido: 19.840;
- redução híbrido versus horário: 73,33%.

## 14. Carregar os dados oficiais

Não copie os dados oficiais manualmente pela interface.

1. Gere um pacote de importação auditável fora do Skip.
2. Confira SHA-256 do arquivo oficial.
3. Importe primeiro em homologação.
4. Valide:
   - 74 processos;
   - 83 linhas-fonte;
   - QUALLY 50;
   - PDA 9;
   - SAFRA 8;
   - GOGA 7;
   - 12 contêineres ISO 6346 válidos;
   - zero coordenadas inventadas.
5. Grave o lote em `official_data_batches`.
6. Compare amostras com a planilha.

### Prompt 13 — importador controlado

```text
Crie uma Edge Function administrativa para importar o pacote oficial normalizado.

Ela deve:
- aceitar somente usuário OWNER autorizado ou service role;
- validar fingerprint, contagens e esquema;
- rodar em transação;
- ser idempotente por fingerprint;
- preservar linha original, normalização, método de vínculo e conflitos;
- produzir relatório de inseridos, atualizados, ignorados e erros;
- nunca inventar posição, ETA, transportadora ou referência ausente.

Não inclua o arquivo oficial no bundle público nem registre dados pessoais em logs.
```

## 15. Integrar e homologar o n8n

Somente depois de o backend Skip estar estável:

1. duplique os workflows v5/v2 em homologação;
2. altere `COMEX_CONTROL_BASE_URL` para as Edge Functions novas;
3. mantenha os workflows desativados;
4. configure credenciais em cofre;
5. teste Sheets;
6. teste busca manual;
7. teste Maersk/CMA com referências reais autorizadas;
8. ative sincronização;
9. ative busca manual;
10. por último, ative o avaliador híbrido;
11. nunca mantenha duas versões equivalentes ativas.

## 16. QA final

### Prompt 14 — rodada de qualidade

```text
Execute uma auditoria completa da aplicação sem alterar regras aprovadas.

Verifique:
- rotas e botões;
- responsividade;
- contraste e teclado;
- loading, vazio, erro, offline e acesso negado;
- isolamento de empresas;
- papéis e chamadas diretas;
- CRUD e concorrência;
- status e canais;
- mapa sem posições fictícias;
- rotas com no mínimo duas posições;
- relatórios e CSV seguro;
- idempotência n8n;
- conflitos de planilha;
- política híbrida e backoff;
- ausência de secrets no bundle;
- erros do console e rede;
- build de produção.

Crie testes automatizados para cada falha encontrada, corrija e execute tudo novamente. Entregue uma matriz com teste, evidência e resultado. Não declare homologada qualquer API externa sem resposta real auditável.
```

### Cenários mínimos obrigatórios

1. OWNER da QUALLY edita QUALLY e não acessa empresa sem vínculo.
2. AUDITOR exporta relatório, mas não altera importação.
3. VIEWER recebe bloqueio no backend.
4. Contêiner válido sem evento não aparece no mapa.
5. Evento repetido não duplica posição.
6. Evento antigo não sobrescreve snapshot recente.
7. Uma posição não cria rota; duas posições criam.
8. Entrega parcial não conclui importação.
9. Conflito Sheets retorna 409.
10. Confirmação antiga da outbox não confirma versão nova.
11. Refresh manual respeita 60 segundos.
12. Carga crítica entra na fila horária; concluída não entra.

## 17. Publicação e transição

1. Publique primeiro em subdomínio Skip de homologação.
2. Mantenha produção atual ativa.
3. Execute homologação com usuários de cada papel.
4. Compare totais, amostras e relatórios entre os dois sistemas.
5. Defina janela de corte.
6. Pause edições por alguns minutos ou use fila de reconciliação.
7. Faça export final do D1/planilha.
8. Importe e confira no Supabase.
9. Aponte n8n e planilha para o novo backend.
10. Monitore erros, outbox e rastreamento.
11. Só depois altere domínio ou comunique a nova URL.
12. Mantenha rollback para o sistema anterior até encerrar a estabilização.

## Critério de conclusão

A versão Skip só é equivalente quando:

- todos os cenários de QA passam;
- dados oficiais e contagens fecham;
- RLS impede vazamento entre empresas;
- n8n e Sheets funcionam nos dois sentidos;
- ao menos um armador devolve evento real homologado;
- nenhuma posição é inventada;
- o repositório GitHub está atualizado;
- existe backup e plano de rollback.

## Fontes

- [Skip — primeiros passos](https://docs.goskip.dev/introduction/getting-started/)
- [Skip — FAQ, stack, GitHub, Supabase e limites](https://docs.goskip.dev/introduction/faq/)
- [Skip — login social](https://docs.goskip.dev/integrations/skip-cloud/oauth/)
- [Skip — publicação](https://docs.goskip.dev/deployment/publishing/)
- [Skip — aulas sobre banco, roles, RLS e Edge Functions](https://docs.goskip.dev/video-lessons/courses/)
- [Supabase — documentação](https://supabase.com/docs)
- [DCSA Track & Trace](https://dcsa.org/standards/track-and-trace/standard-documentation-track-and-trace)
