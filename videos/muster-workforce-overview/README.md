# Demos do Muster com HyperFrames

Gauntlet visual de 87,5 segundos baseado no layout claro atual do Muster e no
framework open source [HyperFrames](https://github.com/heygen-com/hyperframes).
O corte percorre treze fluxos operacionais e usa dezessete estados capturados
diretamente dos componentes vigentes.

## Comandos

```bash
pnpm run demo:muster:check
pnpm run demo:muster:preview
pnpm run demo:muster:render
```

O MP4 final é gerado em
`videos/muster-workforce-overview/renders/muster-workforce-overview.mp4`.

## Atualizando telas

As telas vigentes ficam em `assets/ui-light/`. Para recapturar os componentes
sem criar rota pública nem contornar a autenticação, inicie o harness isolado:

```bash
pnpm --dir artifacts/cohort exec vite --config vite.video-capture.config.ts
```

O harness existe somente para produção visual e reutiliza os componentes reais
do frontend no modo de produção, com identidade Clerk local e respostas de API
isoladas para Conectores e Relatórios. Nenhuma rota ou bypass é adicionado ao app.

Com o harness ativo, recapture todas as jornadas em 1280×720:

```bash
node scripts/capture-ui.mjs
```

O script também registra os estados interativos de ativação do conector, ações
de alertas e decisão do plano profissional.

## Áudio

A primeira edição é silenciosa e orientada por captions. Para voz e música,
execute `npx hyperframes auth login` ou instale os engines locais indicados por
`npx hyperframes auth status`.
