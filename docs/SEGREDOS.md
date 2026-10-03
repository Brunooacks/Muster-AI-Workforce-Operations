# Segredos e variáveis sensíveis

Este inventário não contém valores. O arquivo `.env.production` fica somente no
droplet, com permissão do usuário de deploy; variáveis usadas no build da SPA
precisam estar disponíveis antes de `docker compose build`.

## 1. Inventário

### 1.1 Variáveis e responsáveis

| Variável                                               | Onde vive                                                                       | Quem rotaciona                                    | Impacto da perda ou exposição                                                                      | Rotação                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` / a senha em `DATABASE_URL`        | `.env` do droplet; cópia de recuperação no cofre da operação                    | responsável de infraestrutura                     | Exposição permite acesso ao banco; perda bloqueia API e recuperação                                | Gerar senha nova, alterar o papel no Postgres, atualizar `DATABASE_URL`/compose, reiniciar e validar health check.                                                                            |
| `CLERK_SECRET_KEY`                                     | GitHub Secret no pipeline, `.env` do droplet                                    | administrador do Clerk                            | Exposição dá controle administrativo da identidade                                                 | Revogar a chave no Clerk, emitir outra, atualizar os dois locais e reiniciar a API.                                                                                                           |
| `CLERK_PUBLISHABLE_KEY` e `VITE_CLERK_PUBLISHABLE_KEY` | Clerk; GitHub Variable ou `.env` do droplet para o build                        | administrador do Clerk                            | Não é segredo, mas uma chave incorreta interrompe autenticação no navegador                        | Atualizar a configuração do Clerk, a variável de build e reconstruir a imagem.                                                                                                                |
| `AI_INTEGRATIONS_OPENAI_API_KEY` e `OPENAI_API_KEY`    | GitHub Secret quando usado por CI; `.env` do droplet                            | dono da integração de IA                          | Exposição permite consumo/custo e acesso indevido ao provedor                                      | Revogar no provedor, gerar chave nova, atualizar o local consumidor e validar uma chamada controlada.                                                                                         |
| `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_ACCESS_TOKEN`    | GitHub Secret ou `.env` do droplet, somente se importação privada estiver ativa | administrador do repositório                      | Exposição permite leitura dos repositórios autorizados                                             | Revogar o token, criar PAT de escopo mínimo `contents:read`, atualizar o consumidor e testar uma importação autorizada.                                                                       |
| `MUSTER_CREDENTIAL_ENCRYPTION_KEY`                     | GitHub Secret e `.env` do droplet; **cópia offline obrigatória no cofre**       | responsável de infraestrutura, com dupla custódia | Perda torna irrecuperáveis as credenciais de conectores já cifradas; exposição permite decifrá-las | Planejar janela: manter a chave antiga para decifrar, recriptografar todos os conectores com a nova chave, validar leitura e só então revogar a antiga. Nunca rotacionar sem a cópia offline. |
| `MUSTER_AUTH_TOKEN` e `MUSTER_EXECUTION_TOKEN`         | GitHub Secret ou `.env` do droplet quando os runners são habilitados            | dono dos runners                                  | Exposição permite acionar o runner/gateway                                                         | Revogar no emissor, trocar no runner e no gateway, reiniciar ambos e validar uma execução de menor privilégio.                                                                                |
| `DOCKER_SOCKET_PATH`                                   | `.env` do droplet apenas para o perfil explícito `agent-docker`                 | responsável de infraestrutura                     | Montar o socket concede controle do Docker host                                                    | Desabilitar o perfil, remover o mount, revisar o host e recriar credenciais dos serviços afetados.                                                                                            |

`VITE_MUSTER_CONTACT_URL`, `MUSTER_INVITE_ONLY` e
`VITE_MUSTER_INVITE_ONLY` não são segredos. O contato é público por design e
as flags controlam comportamento; mantenha-as como GitHub Variables ou no
`.env` do droplet e reconstrua a SPA quando uma variável `VITE_` mudar.

## 2. Rotação e resposta

1. Registre o incidente sem copiar o valor comprometido em tickets, logs ou chat.
2. Revogue a credencial no sistema emissor antes de publicar a substituta.
3. Atualize somente o Secret/Variable do GitHub ou o `.env` do droplet indicado
   acima; nunca versione um valor em Git.
4. Reconstrua/reinicie o serviço aplicável e valide autenticação, health check e
   a integração afetada com uma conta de menor privilégio.
5. Remova a credencial antiga e registre data, dono e evidência de validação no
   runbook privado.

## 3. Limites de borda recomendados (C5)

Esta tarefa não altera nginx nem Compose. Para a próxima mudança de borda,
aplicar `client_max_body_size 1m` ao vhost e `limit_req` por IP nas rotas de
ingestão `POST /api/agents/*/events` e
`POST /api/integrations/agent-events`. Começar com uma zona de 10 requisições
por segundo, burst de 20 e `nodelay`, observando 429 e a latência antes de
ajustar. Exceções por parceiro devem ser documentadas e ter prazo de revisão.
