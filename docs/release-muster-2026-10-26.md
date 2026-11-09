# Release muster-2026-10-26 — manifesto

Branch: release/muster-2026-10-26 · HEAD 1f94513 · gerado 25/10/2026 22:09 BRT
Base: main 38ed109 (sem merge no main)

| PR | Branch | Commit aprovado | Ponta atual no GitHub | Ancestral do release? |
|---|---|---|---|---|
| #66 | feat/home-design-system | 02e5ccc | 02e5ccc (SIM) | SIM |
| #67 | feat/fase1-base | 68d78bc | 68d78bc (SIM) | SIM |
| #67 (tema) | feat/fase1-base | c250131 | 68d78bc (SIM) | SIM |
| #68 | feat/fase2-telas-a | 6820327 | 6820327 (SIM) | SIM |
| #69 | feat/fase2-telas-b | 3567b43 | 3567b43 (SIM) | SIM |
| #70 | feat/login-cadastro | 7685ad4 | 36dd6fb (SIM) | SIM |
| #70 (README) | feat/login-cadastro | 36dd6fb | 36dd6fb (SIM) | SIM |

Commits próprios do release:
- 25bdd8e release: downs 0023..0027 apagam o registro pelo 'when' novo; CSS claro sem bloco órfão
- 0e33717 release: perfil noite da home (#66) escopado e tokens de texto do claro (contraste)
- 367fc90 merge da #66 (conflitos resolvidos; migrações 0022..0026 do #66 renumeradas para 0023..0027 com "when" posterior à 0022_conta_pessoal)

Vem junto com o #66 (empilhados nele, não aprovados separadamente): #64 feat/e1-tenant-projeto-ambiente (25044f6), #65 feat/cunha-mus-173 (1840e7a), feat/e0-ci-woodpecker (23aca5d).


## Atualização 2026-10-25 22:xx BRT — vídeo da home
- Commit c0523a3 (c0523a3d9504d3b282b7e1836fb0d8db712e944d): vídeo do handoff (composição `video/muster-intro`, 53 s) gravado em webm 1,0 MB + mp4 1,3 MB (960x540) + pôster 48 KB, em `artifacts/cohort/public/video/`.
- Trocar o vídeo: substituir os 3 arquivos ou editar `artifacts/cohort/src/config/home-video.ts` (caminhos, duração, capítulos).
- Autoplay mudo, loop, playsinline, carregamento só perto da viewport, pausa fora da tela; prefers-reduced-motion mostra o pôster com botão play.
- Testes: cohort 133/133, scripts 103/103, typecheck ok, build ok.
- Preview: https://release-home.muster-prototipo.pages.dev (sem prod).
- Lado a lado da home: /workspace/muster/release/release-home-lado-a-lado.pdf
- HEAD da release: c0523a3d9504d3b282b7e1836fb0d8db712e944d
