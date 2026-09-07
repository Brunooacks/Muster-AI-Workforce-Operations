# Muster — Estratégia de autonomia e workforce intelligence

## Decisão

O Muster deve evoluir como **control plane do trabalho autônomo**, e não como
mais um construtor de agentes. Seu objeto de gestão é a capacidade de uma força
de trabalho humana, digital ou física cumprir uma missão com autoridade,
contexto, evidência e responsabilidade explícitos.

As ideias de assistentes, agentes, multiagentes, automação e autonomia não
formam uma única escada. Elas descrevem dimensões independentes. Um sistema
multiagente pode operar com autonomia quase zero; um agente único pode ter
autoridade operacional elevada. Misturar esses conceitos impede comparação e
cria permissões perigosas.

## Tese de produto

```text
capacidade sem autoridade = potencial não utilizado
autoridade sem evidência = risco não governado
evidência sem propósito = observabilidade sem gestão
propósito + autoridade + contexto + evidência = trabalho governado
```

O diferencial do Muster deve ser responder continuamente:

1. o que este profissional ou time foi contratado para entregar;
2. quais capacidades possui e quais ferramentas pode usar;
3. quais decisões pode tomar sem intervenção;
4. qual contexto recebeu e se esse contexto era confiável;
5. qual resultado produziu e quem responde por ele;
6. se está apto a receber mais autonomia, mentoria, suspensão ou aposentadoria.

## Taxonomia operacional obrigatória

Cada profissional digital recebe um perfil em seis eixos. Nenhum eixo substitui
outro e todos são versionados no contrato.

### 1. Natureza da inteligência

| Tipo | Função predominante | Evidência mínima |
|---|---|---|
| Preditiva | Estima estado, risco ou probabilidade | qualidade do modelo, calibração e drift |
| Generativa | Produz conteúdo, hipótese, código ou plano | qualidade, groundedness, revisão e uso do resultado |
| Agêntica | Planeja, usa ferramentas e altera o estado de sistemas | decisão, tool call, efeito, rollback e outcome |

Um agente pode combinar os três tipos. A interface deve mostrar qual deles foi
usado em cada execução, sem chamar geração de conteúdo de autonomia operacional.

### 2. Topologia de trabalho

| Topologia | Definição | Unidade principal de avaliação |
|---|---|---|
| Assistente | Apoia uma pessoa; a responsabilidade final permanece humana | recomendação aceita, tempo poupado e qualidade |
| Agente | Executa um contrato delimitado e responde por outcomes observáveis | função, run, decisão, efeito e KPI |
| Multiagente | Vários agentes coordenam etapas, papéis ou verificações | jornada, handoff, contexto e resultado E2E |
| Equipe mista | Pessoas e agentes compartilham backlog, decisões e entrega | capacidade, responsabilidade, intervenção e outcome coletivo |

### 3. Especialização

- **Vertical:** domina função, domínio, regras, ferramentas e métricas específicas.
- **Horizontal:** coordena contexto, prioridades, handoffs, políticas ou múltiplos domínios.

Um supervisor horizontal com especialistas verticais é uma topologia forte,
mas não universalmente superior. Ele também cria gargalo, concentração de
privilégio, distorção de contexto, erro correlacionado e ponto único de falha.

O padrão recomendado é:

```text
missão e política
  → supervisor horizontal com autoridade limitada
      ├── especialista vertical de pesquisa
      ├── especialista vertical de execução
      ├── verificador independente
      └── relator/auditor
  → decisão humana quando risco ou irreversibilidade exigirem
```

O verificador não deve depender exclusivamente do mesmo contexto, modelo e
critério do executor. Segregação real reduz a falsa sensação de cross-check.

### 4. Nível de autonomia

| Nível | Nome operacional | Direito de decisão |
|---|---|---|
| L0 | Observar | coleta, classifica e prevê; não recomenda nem executa |
| L1 | Assistir | cria rascunho ou análise para decisão humana |
| L2 | Recomendar | propõe ação, impacto, risco e rollback; aguarda decisão |
| L3 | Executar reversível | age dentro de playbook, limite e rollback comprovado |
| L4 | Coordenar delimitado | delega a especialistas e ajusta plano dentro de orçamento e política |
| L5 | Operar missão contínua | adapta execução dentro de um envelope aprovado e interrompe ao perder confiança |

L5 não significa autonomia irrestrita. A irreversibilidade, a criticidade, a
incerteza e o limite de exposição continuam determinando aprovação humana.

### 5. Modo de execução

- **Trilho:** fluxo determinístico, regra conhecida, desvio mínimo e estados previstos.
- **Trânsito:** objetivo conhecido, ambiente variável e decisão adaptativa dentro de limites.

O modo trilho representa automação. O modo trânsito representa autonomia
delimitada. A promoção de um modo para o outro exige baseline, simulação,
shadow, canary, observabilidade, fallback e owner explícito.

### 6. Forma de atuação

- **Digital:** age em informação, software e serviços.
- **Ciberfísica:** observa ou controla sistemas físicos por software, IoT ou máquinas.
- **Física incorporada:** percebe e age diretamente no mundo por robôs e atuadores.

Este eixo prepara portabilidade futura sem transformar robótica em requisito do
MVP atual.

## Contrato de decisão

Autonomia deve ser calculada por ação, e não atribuída genericamente ao agente.
Cada classe de ação declara:

- criticidade, reversibilidade e impacto máximo;
- ferramentas, dados e ambientes permitidos;
- orçamento de dinheiro, tokens, tempo e tentativas;
- condições de autoexecução, aprovação, escalação e bloqueio;
- rollback, timeout, kill switch e owner humano;
- evidência mínima antes e depois do efeito.

```text
permitida + reversível + confiança suficiente → executar e auditar
permitida + reversível + confiança insuficiente → recomendar ou escalar
irreversível ou acima da alçada → aprovação obrigatória
fora da política → bloquear, registrar e alertar
```

## Direction, Protection e Proof

Governança, segurança e compliance devem ser domínios distintos que compartilham
uma mesma trilha de evidência.

| Pilar | Pergunta | Capacidades do Muster |
|---|---|---|
| Direction | O agente está fazendo o trabalho certo sob responsabilidade clara? | missão, contrato, autoridade, KPI, lifecycle e performance |
| Protection | O trabalho ocorre sem expor dados, modelos, ferramentas ou infraestrutura? | identidade, acesso, segredo, guardrail, detecção e resposta |
| Proof | É possível demonstrar aderência, decisão e resultado? | política, controle, evidência, auditoria, retenção e relatório |

A interseção forma o **Trust Envelope** da execução. Um KPI positivo não libera
promoção quando proteção ou prova estiverem abaixo do contrato.

## Shared Context Plane

Multiagentes não devem compartilhar um bloco de texto informal como única fonte
de verdade. O contexto compartilhado precisa ser um plano governado com:

- fontes, owner, autoridade e versionamento;
- classificação, autorização, retenção e residência;
- freshness, completude, relevância e conflito;
- regras globais e instruções específicas por função;
- memória de trabalho separada de memória durável;
- contrato de handoff com contexto mínimo e evidência preservada.

O Muster monitora o contexto usado; não precisa possuir todo o conteúdo. Em
cenários regulados, descritores, hashes e agregados permanecem no control plane,
enquanto o conteúdo fica no collector local.

## Workforce Twin antes de Physical AI

World model e digital twin não são sinônimos nem uma relação simples de
substituição. O world model aprende ou representa dinâmicas para prever futuros
plausíveis. O digital twin representa uma entidade ou operação concreta com
estado, parâmetros e sinais observáveis. Um pode enriquecer o outro.

A oportunidade imediata do Muster é um **Workforce Twin operacional**, sem 3D:

- reproduzir jornadas, filas, handoffs, dependências e decisões;
- simular aumento de volume, ausência humana, falha de provider e mudança de modelo;
- estimar capacidade, SLA, custo opcional, risco e intervenção;
- comparar política atual com uma configuração candidata;
- promover mudanças por replay, shadow e canary antes de ampliar autonomia.

Isso aproxima world models e digital twins do problema real do produto: testar
uma organização de trabalho antes de alterar a operação viva.

## Imitation learning governado

O Muster não deve “copiar um funcionário” silenciosamente. Deve governar um
processo de aprendizagem por demonstração:

```text
consentimento e finalidade
→ captura de demonstrações
→ curadoria e proveniência
→ extração de política/playbook
→ avaliação offline
→ shadow sem efeito
→ canary reversível
→ aprovação e promoção
→ monitoramento de drift e regressão
```

O registro mínimo inclui expert, escopo, licença/consentimento, contexto,
versão, cobertura dos casos, exceções, qualidade e validade temporal. O produto
governa dataset, evidência e promoção; o treinamento pode permanecer em
plataformas especializadas.

## Oferta para Business Partners

O conceito pode virar uma oferta de serviço e uma persona operacional:
**AI Workforce Business Partner**.

Esse BP não configura prompts. Ele:

1. desenha papéis, capacidade e composição humana-agente;
2. conduz admissão, probation e revisão de contrato;
3. define direitos de decisão, guardrails e accountability;
4. acompanha desempenho, contexto, risco e desenvolvimento;
5. recomenda mentoria, promoção, redistribuição, suspensão ou aposentadoria;
6. apresenta o impacto e a maturidade da workforce para liderança e auditoria.

Isso reforça o posicionamento do Muster como serviço operacional apoiado por
software: o cliente compra capacidade de governar e melhorar o trabalho, não
apenas acesso a telas.

## Physical AI como extensão futura

UBTECH, AGIBOT, Unitree e X-Humanoid mostram a expansão de agentes incorporados,
mas o Muster não deve competir em locomoção, manipulação ou treinamento de
políticas. Sua extensão é governar frotas físicas pelo mesmo contrato profissional.

Campos e métricas adicionais:

- modelo do corpo, firmware, policy e localização;
- missão, área permitida, geofence e janela operacional;
- bateria, temperatura, atuadores, sensores e conectividade;
- colisão, near miss, parada de emergência e exposição humana;
- taxa de conclusão física, intervenção, dano e recuperação;
- cobertura de simulação, diferença sim-to-real e confiança do world model;
- kill switch, estado seguro, manutenção e responsável local.

No primeiro estágio, o Muster observa e governa; não comanda atuadores. Escrita
em sistemas físicos exige safety case, adapter certificado e aprovação separada.

## Implementações incrementais

### P0 — Fortalecer o MVP digital

1. Adicionar os seis eixos ao contrato e à admissão como campos versionados.
2. Implementar matriz de direitos por ação com reversibilidade e aprovação.
3. Exibir supervisor, especialistas, verificador, contexto e handoffs nas jornadas.
4. Medir saúde do contexto e regressão por versão, workload e política.
5. Impedir promoção quando Direction, Protection ou Proof falharem.

### P1 — Workforce intelligence

1. Criar workspace do AI Workforce BP com portfolio, revisões e planos.
2. Introduzir Workforce Twin para replay e simulação de jornadas digitais.
3. Registrar demonstrações, datasets e promoções de imitation learning.
4. Recomendar composição de equipes sem autoaplicar mudanças críticas.
5. Comparar configurações de autonomia por impacto previsto e observado.

### P2 — Physical AI readiness

1. Criar `embodiment profile` e taxonomia de segurança física.
2. Receber telemetria por adapters como ROS 2, MQTT, OPC UA ou OTLP.
3. Correlacionar twin, policy, firmware, ambiente e execução real.
4. Adicionar incidentes físicos, manutenção e evidência de safety case.
5. Validar um piloto físico somente após o control plane digital provar os SLOs.

## O que não deve entrar no MVP de sábado

- treinamento de world models ou políticas robóticas;
- controle de robôs e atuadores;
- engine própria de imitation learning;
- supervisor autônomo com privilégio global;
- autonomia L5 liberada por um score único;
- novo módulo visual desconectado do fluxo atual.

O MVP deve apenas preparar os contratos para essa evolução e provar autonomia
delimitada, contexto, regressão, decisão, ação e evidência em agentes digitais.

## Referências de mercado e tecnologia

- [NVIDIA Cosmos — World Foundation Models para Physical AI](https://www.nvidia.com/en-eu/ai/cosmos/)
- [NVIDIA — trilha de digital twins para Physical AI](https://www.nvidia.com/en-us/learn/learning-path/digital-twins.md/)
- [Unitree G1](https://www.unitree.com/mobile/g1/)
- [UBTECH Walker S](https://www.ubtrobot.com/cn/humanoid/products/walker-s)
- [AGIBOT — portfólio de embodied intelligence](https://www.agibot.com/article/231/detail/30.html)
- [X-Humanoid — Beijing Humanoid Robot Innovation Center](https://www.x-humanoid.com/about.html)
- [OpenAI — one-shot imitation learning em robótica](https://openai.com/index/robots-that-learn/)
