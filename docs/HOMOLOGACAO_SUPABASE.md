# Homologação Supabase — Comex Control Skip

## Ambiente ativo

- Projeto: `Comex Control HML`
- Project ref: `kvytdszaxjmiexrxaqzt`
- API URL: `https://kvytdszaxjmiexrxaqzt.supabase.co`
- Plano: Free (`nano`)
- Região escolhida automaticamente pela conta Free: `us-east-2` (Ohio)
- Data API: ativa
- Exposição automática de tabelas: desativada
- Row Level Security: ativo em todas as tabelas operacionais

## Recursos instalados

- Esquema consolidado em `supabase/migrations/202608310001_core.sql`
- Quatro empresas iniciais e dois proprietários pré-vinculados no ambiente HML
- Google OAuth externo em modo de teste
- `webhook-ingest`: ingestão assinada por HMAC para atualizações automáticas do n8n
- `tracking-refresh`: relay autenticado para a busca manual iniciada no aplicativo
- Privilégios explícitos para `authenticated`; papel `anon` sem acesso às tabelas

## URLs das Edge Functions

- `https://kvytdszaxjmiexrxaqzt.supabase.co/functions/v1/webhook-ingest`
- `https://kvytdszaxjmiexrxaqzt.supabase.co/functions/v1/tracking-refresh`

## Segredos

Os valores são mantidos somente nos cofres dos provedores e não pertencem ao Git.

- Já configurado no Supabase: `N8N_WEBHOOK_SECRET`
- Pendente até existir uma instância n8n ativa:
  - `N8N_MANUAL_WEBHOOK_URL`
  - `N8N_MANUAL_WEBHOOK_TOKEN`

## Estado do n8n

A URL histórica `gmbarros.app.n8n.cloud` respondeu **No workspace here** em 1º de setembro de 2026. Nenhum plano pago foi ativado. Para concluir a automação:

1. Restaurar essa instância ou criar uma instância gratuita/autohospedada com URL pública HTTPS.
2. Importar os fluxos híbrido, busca manual e sincronização com Google Sheets.
3. Definir no webhook manual a autenticação pelo cabeçalho `x-comex-manual-token`.
4. Configurar o n8n para assinar o corpo bruto enviado a `webhook-ingest` com HMAC-SHA256 no cabeçalho `x-comex-signature`.
5. Gravar a URL de produção do webhook manual e o token correspondente nos segredos da Edge Function.
6. Executar os testes de atualização manual, idempotência e isolamento de empresa.

## Validações concluídas

- Login Google realizado com sucesso após rotação da chave OAuth.
- Um usuário proprietário foi vinculado automaticamente pelo gatilho de `auth.users`.
- O RLS devolveu somente as quatro empresas autorizadas ao proprietário.
- A troca de empresa ativa foi validada no frontend sem permitir códigos livres.
- Build e 16 testes automatizados concluídos sem falhas.

