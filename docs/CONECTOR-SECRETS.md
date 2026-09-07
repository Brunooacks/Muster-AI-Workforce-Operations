# Segredos de conectores

O Muster persiste tokens de conectores em envelopes `mustercred:v1` usando
AES-256-GCM. Cada escrita usa um nonce aleatório de 96 bits, autenticação de
integridade e AAD vinculada ao identificador do conector. O plaintext existe
somente durante o registro e imediatamente antes da chamada do adapter.

Existem dois segredos distintos:

- **credencial do fornecedor**: PAT GitHub ou futuro token de adapter nativo,
  cifrado com `MUSTER_CREDENTIAL_ENCRYPTION_KEY`;
- **chave de ingestão Muster**: `mck_live_...`, emitida para webhook, cloud ou
  runtime próprio; somente o hash SHA-256 é armazenado e a chave não pode ser
  recuperada depois do fechamento do assistente.

## Configuração

Gere uma chave de 32 bytes:

```bash
openssl rand -base64 32
```

Configure o resultado no ambiente da API:

```bash
MUSTER_CREDENTIAL_ENCRYPTION_KEY=<base64-de-32-bytes>
MUSTER_ALLOW_LEGACY_CREDENTIAL_MIGRATION=false
```

Também são aceitos exatamente 64 caracteres hexadecimais. A API recusa a
gravação de um segredo quando a chave está ausente ou malformada. Réplicas que
atendem o mesmo banco devem receber a mesma chave.

## Registros legados

Valores que não começam com `mustercred:v1` são tratados como plaintext legado
e permanecem bloqueados por padrão em todos os ambientes. Para migrar:

1. Faça backup do banco e confirme a chave de criptografia ativa.
2. Defina temporariamente `MUSTER_ALLOW_LEGACY_CREDENTIAL_MIGRATION=true`.
3. Execute **Testar conexão** ou uma descoberta para cada conector legado.
4. Confirme no banco que o campo começa com `mustercred:v1`, sem consultar ou
   exportar seu conteúdo completo.
5. Restaure imediatamente `MUSTER_ALLOW_LEGACY_CREDENTIAL_MIGRATION=false`.

A migração grava o envelope antes de liberar a credencial para o adapter. Se a
atualização não for confirmada, o uso permanece bloqueado.

## Rotação

A versão atual não armazena um identificador de chave separado. Para trocar a
chave mestra, primeiro registre novamente ou migre cada credencial com uma
rotina controlada capaz de ler com a chave anterior e escrever com a nova. Não
substitua a variável diretamente enquanto houver envelopes cifrados pela chave
anterior.

Chaves `mck_live_...` são rotacionadas pela própria tela **Conectores**. A
rotação revoga imediatamente todas as chaves anteriores daquela conexão e
exibe o novo valor uma única vez. Atualize o secret manager do workload antes
do próximo envio.

## Operação segura

- Nunca registre request bodies, headers de autorização ou objetos de
  credencial.
- Aplique `redactConnectorMetadata` em metadata enviada aos logs dos adapters.
- Erro de integridade indica ciphertext adulterado, chave incorreta ou troca
  de registro; bloqueie o conector e rotacione sua credencial.
- Não reutilize a chave em ambientes de desenvolvimento, homologação e
  produção.

## Evolução recomendada

Para escala enterprise, substituir a chave estática por envelope encryption em
AWS KMS, Azure Key Vault, Google Cloud KMS ou Vault, com `keyId`, rotação sem
indisponibilidade, auditoria de decrypt e, quando necessário, chaves dedicadas
por tenant. O formato versionado permite essa evolução sem expor plaintext na
API.
