# Comex Control - Skip

Repositório independente para planejar, construir e homologar a versão do **Comex Control** destinada à plataforma [Skip](https://goskip.dev/).

## Separação do projeto principal

- Este repositório não é um fork e não compartilha o histórico Git do `comex-control`.
- O Comex Control atual permanece como sistema de produção e fonte de dados até a homologação da nova versão.
- Nenhuma alteração deste projeto deve ser enviada ao repositório principal automaticamente.
- Credenciais, tokens, planilhas oficiais e dados pessoais não devem ser versionados.

## Objetivo inicial

Construir uma versão compatível com o ecossistema do Skip, preservando:

- gestão multiempresa;
- cadastro e edição de importações;
- status operacionais e canais aduaneiros;
- mapa e rastreamento marítimo;
- histórico e auditoria;
- relatórios;
- permissões;
- integração com n8n e Google Sheets.

## Estado

Starter Vite/React funcional criado e isolado, com shell visual, mapa, regras de domínio, migration Supabase/RLS, Edge Function do webhook n8n e testes. Não há dados oficiais, credenciais nem conexão de produção neste repositório.

```powershell
npm ci
npm run verify
npm run dev
```

Copie `.env.example` para `.env.local` somente quando houver um projeto Supabase de homologação. Nunca exponha `service_role` no frontend.

## Guia de construção

- [Passo a passo operacional com 14 prompts](docs/GUIA_CRIACAO_SKIP.md)
- [Relatório HTML portátil](reports/comex-control-skip-guia-criacao.html)
- [Pacote compacto para anexar ao Skip](skip-package/00_START_HERE.md)
