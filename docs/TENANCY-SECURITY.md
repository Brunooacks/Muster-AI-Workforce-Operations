# Tenancy e segurança — gate aplicativo

## Garantias desta rodada

- `metric_evidence` pertence diretamente a uma organização por `org_id NOT NULL`.
- O backfill falha se encontrar referências antigas de organizações diferentes.
- API de evidências sempre filtra por tenant e rejeita `agentId`, `teamId` ou
  `purposeId` de outra organização.
- Chaves de catálogo e slugs de jornadas são únicos dentro da organização, não
  globalmente.
- Ingestão externa usa recibo idempotente por
  `(org_id, platform, event_id)` dentro da mesma transação dos eventos e métricas.
- Leituras de fleet derivadas de agentes usam join ou `IN` limitado aos agentes
  da organização.
- Escritas sensíveis passam por uma política comum de papéis:
  - `owner/admin`: credenciais, conectores, catálogo e estrutura de áreas;
  - `owner/admin/member`: operação de alertas e ações de veredito.

## Verificação

O teste `tenant-security.integration.test.ts` cria duas organizações isoladas e
valida evidências, referências cruzadas, deduplicação, RBAC e entidades filhas
da fleet. Ele exige PostgreSQL migrado e execução explícita:

```bash
RUN_TENANT_DB_TESTS=true pnpm --dir artifacts/api-server exec vitest run \
  src/lib/tenant-security.integration.test.ts
```

## Próximo gate: PostgreSQL RLS

RLS não foi ativado nesta rodada para evitar uma mudança transversal sem um
contexto tenant transacional confiável. O próximo gate deve:

1. Abrir cada unidade de trabalho em transação.
2. Aplicar `set_config('muster.org_id', tenant, true)` após autenticação.
3. Criar políticas `USING` e `WITH CHECK` nas tabelas com `org_id`.
4. Cobrir tabelas filhas por joins seguros ou materializar `org_id` onde o alto
   volume justificar.
5. Usar uma role de aplicação sem `BYPASSRLS` e separar a role de migrations.
6. Reexecutar a matriz de duas organizações tentando SQL direto e operações da
   API antes de promover o gate.

Até esse gate, o isolamento é garantido e testado na camada de aplicação, mas
uma consulta administrativa executada diretamente no banco ainda pode ignorá-lo.
