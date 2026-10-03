# Backup e restore do Postgres

O backup diário usa `deploy/backup/muster-backup.sh`: ele executa `pg_dump -Fc` no Postgres do projeto `muster`, gera o SHA-256 e envia os dois arquivos para um bucket S3 compatível (por exemplo, Cloudflare R2). A AWS CLI roda em uma imagem `amazon/aws-cli` fixada por digest; não é preciso instalá-la no host.

## Configuração

Crie `/opt/muster/.env.backup` com permissão `0600`. Nunca registre ou versione as credenciais.

```dotenv
MUSTER_BACKUP_S3_ENDPOINT=<endpoint-S3-compativel>
MUSTER_BACKUP_S3_BUCKET=<nome-do-bucket>
MUSTER_BACKUP_S3_PREFIX=muster/postgres/
AWS_ACCESS_KEY_ID=<chave-de-acesso>
AWS_SECRET_ACCESS_KEY=<segredo-de-acesso>
AWS_DEFAULT_REGION=auto
MUSTER_BACKUP_RETENTION_DAYS=14
```

Instale o agendamento somente no servidor do Muster:

```bash
sudo install -m 0644 deploy/backup/muster-backup.service /etc/systemd/system/muster-backup.service
sudo install -m 0644 deploy/backup/muster-backup.timer /etc/systemd/system/muster-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now muster-backup.timer
systemctl list-timers muster-backup.timer
```

Para uma primeira execução controlada, rode `sudo systemctl start muster-backup.service` e confira que existe um par `muster-<UTC>.dump` e `muster-<UTC>.dump.sha256` no prefixo. O pré-deploy também executa esse envio depois do dump local quando `MUSTER_BACKUP_S3_BUCKET` estiver configurada; se o envio falhar, o deploy é interrompido antes de trocar a imagem.

## Retenção

O script mantém os três backups mais recentes independentemente da idade e, depois de um upload bem-sucedido, remove pares de dump e checksum com mais de `MUSTER_BACKUP_RETENTION_DAYS` dias. Configure no bucket uma regra de lifecycle como segunda barreira: expirar objetos em `muster/postgres/` após 14 dias. A lifecycle não substitui a retenção do script, porque esta preserva o mínimo de três backups.

## Ensaio de restore

Use o ambiente de backup configurado e uma porta livre de ensaio:

```bash
MUSTER_RESTORE_PORT=5451 deploy/backup/muster-restore-test.sh
```

O script baixa o dump mais recente (ou `MUSTER_RESTORE_S3_KEY=<chave-do-dump>`), verifica o SHA-256, restaura em um container Postgres descartável, valida tabelas, `__drizzle_migrations` e leitura de `organizations`, imprime os tempos e remove o container ao sair. Para um MinIO local acessível pelo Docker, informe um endpoint como `http://host.docker.internal:9311`.

## Restore em produção

Não execute o ensaio contra o banco de produção. Um restore real substitui dados e exige janela de manutenção, confirmação explícita e um backup novo.

1. Confirme explicitamente com a pessoa responsável a chave exata, a janela e que sobrescrever o banco é desejado.
2. Pare os serviços que escrevem no banco e faça um dump adicional antes de qualquer alteração.
3. Baixe o dump e o arquivo `.sha256`; compare o hash antes de continuar.
4. Restaure no banco-alvo com `pg_restore --clean --if-exists`, usando as credenciais e o endpoint aprovados para a janela.
5. Inicie os serviços e valide saúde, migrações e organizações. Registre a chave usada e os tempos, sem credenciais.

O rollback de imagem e a confirmação visual do dump no R2 real devem ser ensaiados no droplet, seguindo a janela operacional aprovada.
