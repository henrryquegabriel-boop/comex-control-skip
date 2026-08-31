# Comex Control — pacote de entrada para o Skip

Você não deve gerar um projeto do zero. Use como fonte de verdade o repositório público:

`https://github.com/henrryquegabriel-boop/comex-control-skip`

Branch: `main`.

## O que já está pronto

- starter Vite + React 19 + TypeScript + React Router;
- shell visual de alta fidelidade ao sistema original;
- modo escuro padrão, modo claro e quatro paletas;
- mapa MapLibre/OpenFreeMap sem posições fictícias;
- rotas `/dashboard`, `/importacoes`, `/relatorios` e `/configuracoes`;
- formulário inicial de importação e validação ISO 6346;
- etapas, canais, papéis, transportadoras e política híbrida codificados;
- migration consolidada para Supabase PostgreSQL com RLS multiempresa;
- Edge Function `webhook-ingest` com HMAC, idempotência e validação;
- testes automatizados e comando único `npm run verify`;
- logo em `public/comex-control-logo.png`.

## Sua primeira tarefa

1. Importe ou sincronize o repositório acima sem apagar arquivos existentes.
2. Execute `npm ci` e `npm run verify`.
3. Abra `/dashboard` e confirme que o shell renderiza em desktop e mobile.
4. Não conecte produção, não publique e não compre plano/crédito.
5. Não invente importações, coordenadas, ETAs, armadores ou códigos de contêiner.
6. Se houver incompatibilidade do Skip com alguma dependência, faça a menor adaptação possível e preserve os contratos de `01_DOMAIN_CONTRACT.json`.
7. Ao terminar, informe somente: arquivos alterados, resultado dos testes e eventuais bloqueios externos.

## Sequência posterior

Depois do starter validado, trabalhar em builds pequenos:

1. criar projeto Supabase exclusivo de homologação;
2. aplicar a migration `supabase/migrations/202608310001_core.sql`;
3. configurar Google OAuth e confirmação adicional por código no mesmo e-mail;
4. implementar CRUD real conectado ao Supabase/RLS;
5. importar lote oficial por processo controlado, nunca colando planilha no frontend;
6. conectar n8n à Edge Function com secret HMAC;
7. implantar sincronização bidirecional Google Sheets por outbox;
8. executar QA e só então publicar.

## Segredos

Nunca grave no repositório, prompt, frontend ou anexo:

- senha de usuário;
- `SUPABASE_SERVICE_ROLE_KEY`;
- client secret do Google;
- `N8N_WEBHOOK_SECRET`;
- chaves/segredos de Maersk, CMA CGM ou agregadores;
- tokens do GitHub;
- dados pessoais da planilha oficial.

Segredos pertencem ao cofre do Supabase/Skip ou às credenciais do n8n.

## Dados oficiais conhecidos — somente referência de conferência

- fonte: `FOLLOW-UP  DE IMPORTAÇÃO (1).xlsx`;
- fingerprint SHA-256: `B92C54D52C89E5E31BDA504C8BCF33A399054C0FF4E857902947F35A405795ED`;
- 74 processos canônicos;
- 83 linhas-fonte auditáveis;
- empresas: QUALLY 50, PDA 9, SAFRA 8, GOGA 7;
- 12 contêineres distintos e válidos em ISO 6346;
- nenhuma coordenada deve ser criada sem evidência do rastreamento.

Esses números são critérios de reconciliação, não autorização para fabricar registros.
