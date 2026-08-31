# Contrato da integração e critérios de aceite

## Webhook n8n → Supabase Edge Function

Endpoint após deploy:

`POST https://<project-ref>.supabase.co/functions/v1/webhook-ingest`

Headers:

```text
content-type: application/json
x-comex-signature: sha256=<HMAC_SHA256_DO_CORPO_BRUTO>
```

Contrato mínimo:

```json
{
  "eventId": "execucao:container:evento",
  "companyCode": "CODIGO_EMPRESA",
  "source": "MAERSK_OCEAN_IO",
  "observedAt": "2026-08-31T12:00:00.000Z",
  "container": {
    "number": "CONTÊINER_ISO_6346",
    "carrierCode": "MAERSK",
    "provider": "Maersk Ocean Track & Trace",
    "stage": "IN_TRANSIT",
    "statusRaw": "STATUS_ORIGINAL",
    "eta": null,
    "currentLocation": null,
    "vesselName": null,
    "vesselImo": null,
    "vesselMmsi": null,
    "voyageNumber": null
  },
  "position": null
}
```

`position` só pode ser enviado quando a fonte devolver coordenadas comprovadas. O endpoint rejeita número fora de ISO 6346, assinatura inválida, empresa inexistente, etapa inválida e coordenadas fora do globo. `eventId` é a chave de idempotência.

## Google Sheets bidirecional

O site grava primeiro no PostgreSQL. O trigger cria uma linha em `sheet_sync_outbox`. O n8n processa a outbox e atualiza o Google Sheets usando `_SYNC_ID` e `_VERSAO`. Alterações vindas da planilha chamam um endpoint de upsert com a mesma chave e passam por validação de empresa e versão.

O Google Sheets é uma base gerencial sincronizada; PostgreSQL é a fonte transacional do aplicativo. Conflitos não são sobrescritos silenciosamente e devem ser registrados em auditoria.

## Aceite obrigatório antes de publicar

- `npm run verify` termina sem erro;
- as quatro rotas abrem e o refresh direto não retorna 404;
- tema escuro é padrão; tema claro e quatro paletas funcionam;
- a paleta não altera cores de status ou canal;
- seletor de empresa tem contraste legível;
- painel esquerdo oculta e reabre;
- cadastro e edição persistem no banco e geram outbox;
- OWNER, ADMIN, AUDITOR, OPERATOR e VIEWER respeitam a matriz;
- empresa A não lê nem grava empresa B, inclusive por chamada direta;
- AUDITOR gera relatório, mas não edita importação;
- último OWNER não pode ser removido/rebaixado;
- login Google e código usam o mesmo e-mail normalizado;
- mapa não plota contêiner sem posição comprovada;
- nenhum número de contêiner é aceito só pela aparência; check digit ISO é obrigatório;
- webhook duplicado é idempotente;
- logs e erros não expõem tokens, secrets ou payloads pessoais desnecessários;
- reconciliação do lote oficial retorna 74 processos, 83 linhas-fonte e 12 contêineres válidos.

## Resultado esperado do primeiro build no Skip

Importar o starter, corrigir apenas incompatibilidades de execução, validar visualmente e apresentar evidências. Banco, autenticação, dados oficiais e produção entram em builds posteriores e separados.
