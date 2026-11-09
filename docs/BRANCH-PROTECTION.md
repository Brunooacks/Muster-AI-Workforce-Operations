# Proteção da branch `main`

Este procedimento prepara a proteção de `main`, mas a aplicação no GitHub é responsabilidade do Bruno. Faça a aplicação apenas depois que todos os jobs obrigatórios existirem em `main` e tiverem passado em PRs recentes.

## Checks obrigatórios

O CI saiu do GitHub Actions (E0). O padrão do script exige um único status:

- `ci/woodpecker` (pipeline `.woodpecker/ci.yml`, que roda o equivalente a `make ci`; veja `docs/CI.md`)

Os checks antigos do Actions (`typecheck · test · build`, `actionlint`) não existem mais. Integração com PostgreSQL, release smoke e E2E entram como steps do Woodpecker e continuam reportados sob `ci/woodpecker`, sem novos contextos.

## Aplicação manual

Primeiro, revise o payload e o comando sem alterar o GitHub:

```bash
scripts/branch-protection.sh --print
```

Depois da revisão, o Bruno deve rodar exatamente o comando abaixo, digitar `APLICAR` e confirmar o retorno do `gh`:

```bash
scripts/branch-protection.sh --apply
```

Aplique somente depois que `ci/woodpecker` tiver aparecido verde em um PR recente; caso contrário, nenhum PR consegue ser mesclado. O modo `--apply` recusa execução sem terminal interativo e não chama o GitHub se a confirmação não for exatamente `APLICAR`.

O padrão é `REQUIRED_APPROVALS=0`: o PR continua obrigatório, mas não exige uma aprovação. Esse é o ajuste necessário enquanto o repositório pertence à conta `Brunooacks`, possui um único colaborador e os PRs são abertos pela própria conta do Bruno — o autor não pode aprovar o próprio PR. O trade-off é que a proteção bloqueia push direto e exige CI verde, mas não cria revisão por pares. Quando houver um colaborador que possa revisar, eleve o requisito, por exemplo:

```bash
REQUIRED_APPROVALS=1 scripts/branch-protection.sh --print
```

Por padrão, administradores também seguem essas regras; altere somente com decisão explícita usando `ENFORCE_ADMINS=false` ou `--enforce-admins false`.

Alternativamente, para inspecionar a chamada HTTP sem executar o modo interativo:

```bash
gh api --method PUT "repos/Brunooacks/Muster-AI-Workforce-Operations/branches/main/protection" --input <(scripts/branch-protection.sh --payload)
```

O payload exige checks estritos (branch atualizada), PR obrigatório, resolução de conversas, sem push direto, force push ou deleção. `dismissal_restrictions` e `bypass_pull_request_allowances` não são enviados, pois a API do GitHub os aceita somente em repositórios de organização e devolve 422 para este repositório de usuário. O `--check` continua tolerante ao campo de bypass caso uma resposta da API o inclua.

## Validação após aplicar

1. Abra um PR de teste que deixe propositalmente um dos checks obrigatórios vermelho.
2. Confirme na interface do GitHub que o merge está bloqueado pelo check vermelho e que o botão de push direto para `main` não é aceito.
3. Corrija ou feche esse PR de teste sem fazer merge.
4. Confira a configuração somente por leitura:

   ```bash
   scripts/branch-protection.sh --check
   ```

5. Exporte a configuração para anexar na MUS-157:

   ```bash
   gh api "repos/Brunooacks/Muster-AI-Workforce-Operations/branches/main/protection" > /tmp/mus-157-branch-protection.json
   ```

Anexe o arquivo exportado e uma captura do PR bloqueado à MUS-157. A aplicação e essa evidência no GitHub continuam sendo etapas manuais do Bruno.
