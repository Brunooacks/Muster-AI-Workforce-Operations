import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "/Users/brunooliveira/dev/Muster-AI-Workforce-Operations/output/presentations";
const TMP = "/tmp/muster-presentation";
const W = 1280;
const H = 720;

const C = {
  bg: "#0D1411",
  bg2: "#111B17",
  panel: "#15201C",
  panel2: "#1C2923",
  ink: "#F2F0E8",
  muted: "#A6B0AA",
  dim: "#738079",
  mint: "#9FD5B4",
  mint2: "#5E9A78",
  coral: "#E58A7E",
  amber: "#E8C76D",
  line: "#2A3932",
  white: "#FFFFFF",
};

const FONT = "Arial";

async function readBytes(path) {
  return fs.readFile(path);
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function box(slide, geometry, position, fill = "none", line = { style: "solid", fill: "none", width: 0 }, borderRadius) {
  return slide.shapes.add({ geometry, position, fill, line, ...(borderRadius ? { borderRadius } : {}) });
}

function text(slide, value, position, style = {}, options = {}) {
  const shape = box(slide, "textbox", position, options.fill ?? "none", options.line ?? { style: "solid", fill: "none", width: 0 }, options.borderRadius);
  shape.text = value;
  shape.text.style = {
    fontFamily: FONT,
    color: C.ink,
    fontSize: 18,
    ...(style || {}),
  };
  return shape;
}

function rule(slide, left, top, width, color = C.line, weight = 1) {
  return box(slide, "line", { left, top, width, height: 0 }, "none", { style: "solid", fill: color, width: weight });
}

function dot(slide, left, top, size, fill) {
  return box(slide, "ellipse", { left, top, width: size, height: size }, fill, { style: "solid", fill, width: 0 });
}

function image(slide, bytes, alt, position, options = {}) {
  return slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt,
    fit: options.fit ?? "cover",
    position,
    geometry: options.geometry ?? "roundRect",
    borderRadius: options.borderRadius ?? "rounded-xl",
  });
}

function notes(slide, lines) {
  slide.speakerNotes.textFrame.setText(`${lines.join("\n")}\n\n[Sources]\n- Internal Muster repository and local product UI.\n- Screenshots captured from http://localhost:5173 during MVP validation.`);
  slide.speakerNotes.setVisible(true);
}

function baseSlide(presentation, dark = true) {
  const slide = presentation.slides.add();
  slide.background.fill = dark ? C.bg : C.ink;
  return slide;
}

function header(slide, kicker, title, subtitle) {
  text(slide, kicker.toUpperCase(), { left: 72, top: 42, width: 480, height: 26 }, { fontSize: 14, bold: true, color: C.mint, letterSpacing: 1.5 });
  text(slide, title, { left: 72, top: 76, width: 930, height: 86 }, { fontSize: 38, bold: true, color: C.ink, breakLine: false });
  if (subtitle) text(slide, subtitle, { left: 74, top: 168, width: 940, height: 46 }, { fontSize: 19, color: C.muted });
}

function footer(slide, page, label = "MUSTER · AI WORKFORCE OPERATIONS") {
  rule(slide, 72, 682, 1136, C.line, 1);
  text(slide, label, { left: 72, top: 691, width: 450, height: 18 }, { fontSize: 11, bold: true, color: C.dim, letterSpacing: 1.1 });
  text(slide, String(page).padStart(2, "0"), { left: 1150, top: 688, width: 58, height: 24 }, { fontSize: 14, bold: true, color: C.mint, alignment: "right" });
}

function callout(slide, number, title, body, left, top, width, color = C.mint) {
  text(slide, number, { left, top, width: 42, height: 28 }, { fontSize: 18, bold: true, color });
  text(slide, title, { left: left + 48, top: top - 2, width: width - 48, height: 52 }, { fontSize: 21, bold: true, color: C.ink });
  text(slide, body, { left: left + 48, top: top + 58, width: width - 48, height: 54 }, { fontSize: 16, color: C.muted });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const assets = {
    frota: await readBytes(`${TMP}/frota.png`),
    alertas: await readBytes(`${TMP}/alertas.png`),
    admissao: await readBytes(`${TMP}/admissao.png`),
    conectores: await readBytes(`${TMP}/conectores.png`),
    agente: await readBytes(`${TMP}/agente-julia.png`),
    comando: await readBytes(`${TMP}/comando.png`),
  };

  const p = Presentation.create({ slideSize: { width: W, height: H } });

  // 1. Cover
  {
    const s = baseSlide(p);
    text(s, "MUSTER", { left: 72, top: 54, width: 240, height: 40 }, { fontSize: 20, bold: true, color: C.mint, letterSpacing: 3 });
    text(s, "AI WORKFORCE OPERATIONS", { left: 74, top: 94, width: 310, height: 18 }, { fontSize: 12, bold: true, color: C.dim, letterSpacing: 1.5 });
    dot(s, 1095, 64, 16, C.mint);
    text(s, "a camada operacional\npara equipes híbridas", { left: 72, top: 208, width: 670, height: 160 }, { fontSize: 54, bold: true, color: C.ink, lineSpacingMultiple: 0.92 });
    text(s, "Pessoas. Agentes. Evidência. Decisão.", { left: 76, top: 404, width: 560, height: 34 }, { fontSize: 24, color: C.mint });
    text(s, "Uma narrativa de produto, dores resolvidas e próximos critérios de qualificação.", { left: 76, top: 458, width: 620, height: 30 }, { fontSize: 18, color: C.muted });
    box(s, "rect", { left: 808, top: 150, width: 360, height: 360 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    rule(s, 858, 220, 260, C.mint2, 2);
    rule(s, 858, 300, 260, C.line, 1);
    rule(s, 858, 380, 260, C.line, 1);
    text(s, "OPERAR", { left: 858, top: 178, width: 220, height: 24 }, { fontSize: 14, bold: true, color: C.mint, letterSpacing: 2 });
    text(s, "agentes com identidade\nevidência e ação", { left: 858, top: 245, width: 260, height: 78 }, { fontSize: 28, bold: true, color: C.ink });
    text(s, "não apenas observar logs", { left: 858, top: 340, width: 260, height: 24 }, { fontSize: 18, color: C.muted });
    text(s, "MVP · 2026", { left: 858, top: 447, width: 180, height: 22 }, { fontSize: 14, bold: true, color: C.amber, letterSpacing: 1.5 });
    footer(s, 1);
    notes(s, ["A tese do deck: o problema não é criar mais agentes, é torná-los operáveis.", "A apresentação usa a interface atual como evidência do MVP."]);
  }

  // 2. Pain
  {
    const s = baseSlide(p);
    header(s, "O problema", "A adoção de agentes cresceu mais rápido que a capacidade de governá-los.", "Quatro lacunas aparecem quando o agente deixa a demo e começa a operar.");
    rule(s, 72, 252, 1136, C.line, 1);
    callout(s, "01", "Ninguém sabe o que o agente realmente faz", "O repositório mostra intenção. A operação precisa mostrar comportamento, limites e exceções.", 88, 292, 500, C.coral);
    callout(s, "02", "A métrica isolada cria falsas vitórias", "Mais volume ou ROI aparente pode esconder queda de qualidade, governança ou adoção real.", 680, 292, 500, C.amber);
    callout(s, "03", "A responsabilidade fica difusa", "Sem dono de negócio, dono técnico, limites e caminho de escalonamento, toda falha vira investigação manual.", 88, 448, 500, C.mint);
    callout(s, "04", "O alerta não vira decisão", "Detectar é só o começo: alguém precisa reconhecer, atribuir, resolver e acompanhar prazo.", 680, 448, 500, C.mint);
    footer(s, 2);
    notes(s, ["Enquadre a dor como uma lacuna operacional, não como falta de mais um dashboard.", "A proposta do Muster é fechar o ciclo entre identidade, execução, avaliação e decisão."]);
  }

  // 3. Fragmentation
  {
    const s = baseSlide(p);
    header(s, "O custo da fragmentação", "Código, runtime, métricas e decisão ainda vivem em lugares diferentes.", "A operação perde contexto justamente quando precisa agir.");
    const y = 330;
    const nodes = [
      [80, "ORIGEM", "repo · prompt\nconfiguração"],
      [320, "RUNTIME", "local · Docker\ncloud · on-prem"],
      [560, "TELEMETRIA", "logs · custo\nlatência · resultado"],
      [800, "GOVERNANÇA", "owner · limite\nrisco · prazo"],
      [1040, "DECISÃO", "promover\nmentorar · aposentar"],
    ];
    for (let i = 0; i < nodes.length - 1; i++) {
      rule(s, nodes[i][0] + 150, y + 42, 90, C.mint2, 2);
      text(s, "→", { left: nodes[i][0] + 187, top: y + 22, width: 28, height: 28 }, { fontSize: 24, bold: true, color: C.mint });
    }
    nodes.forEach(([left, kicker, body], index) => {
      box(s, "rect", { left, top: y, width: 150, height: 120 }, index === 4 ? C.panel2 : C.panel, { style: "solid", fill: index === 4 ? C.mint2 : C.line, width: index === 4 ? 2 : 1 });
      text(s, kicker, { left: left + 18, top: y + 18, width: 120, height: 20 }, { fontSize: 12, bold: true, color: index === 4 ? C.mint : C.dim, letterSpacing: 1.1 });
      text(s, body, { left: left + 18, top: y + 49, width: 120, height: 54 }, { fontSize: 17, bold: true, color: C.ink });
    });
    text(s, "Sem uma camada operacional, a pergunta “o que fazemos agora?” começa do zero.", { left: 180, top: 528, width: 920, height: 42 }, { fontSize: 28, bold: true, color: C.ink, alignment: "center" });
    footer(s, 3);
    notes(s, ["Esta é a transição conceitual: de stack técnico disperso para camada operacional.", "Não é necessário substituir o runtime; é necessário acompanhar o agente onde ele roda."]);
  }

  // 4. Solution
  {
    const s = baseSlide(p);
    header(s, "A resposta", "Muster transforma agentes em unidades operáveis.", "A plataforma cria um ciclo contínuo: entender antes, observar durante e agir depois.");
    const steps = [
      [92, "01", "DESCOBRIR", "Encontra agentes\ne entende o que fazem"],
      [355, "02", "ADMITIR", "Registra identidade,\npapel e limites"],
      [618, "03", "EXECUTAR", "Acompanha tarefas\nno local, Docker ou remoto"],
      [881, "04", "DECIDIR", "Cruza 5 camadas\ne aciona o comitê"],
    ];
    steps.forEach(([left, n, title, body], i) => {
      dot(s, left, 310, 38, i === 3 ? C.coral : C.mint);
      text(s, n, { left: left + 9, top: 317, width: 26, height: 20 }, { fontSize: 14, bold: true, color: C.bg, alignment: "center" });
      text(s, title, { left: left - 10, top: 378, width: 170, height: 24 }, { fontSize: 16, bold: true, color: i === 3 ? C.coral : C.mint, letterSpacing: 1.2, alignment: "center" });
      text(s, body, { left: left - 20, top: 415, width: 190, height: 54 }, { fontSize: 18, bold: true, color: C.ink, alignment: "center" });
      if (i < steps.length - 1) rule(s, left + 42, 329, 215, C.mint2, 2);
    });
    text(s, "A unidade de valor não é o agente isolado. É a decisão operacional que ele permite tomar.", { left: 180, top: 560, width: 920, height: 36 }, { fontSize: 24, color: C.muted, alignment: "center" });
    footer(s, 4);
    notes(s, ["Apresente o fluxo como uma operação, não como uma lista de features.", "A descoberta e o pre-assessment reduzem preenchimento manual; a telemetria e os alertas fecham o loop."]);
  }

  // 5. Resolved value
  {
    const s = baseSlide(p);
    header(s, "O valor", "O Muster resolve quatro dores de negócio — não apenas quatro dores técnicas.", "O resultado esperado é menos ambiguidade operacional e decisões mais rápidas, auditáveis e reversíveis.");
    const left = 88;
    const rows = [
      ["RISCO", "Limites, donos e trilha de decisão", "Reduz a zona cinzenta antes de um incidente.", C.coral],
      ["EFICIÊNCIA", "Execução e telemetria no mesmo fluxo", "Troca investigação artesanal por evidência operacional.", C.mint],
      ["GOVERNANÇA", "Avaliação em 5 camadas + alertas antagônicos", "Evita otimizar uma métrica enquanto o resultado real degrada.", C.amber],
      ["VALOR", "Vereditos: promover, mentorar ou aposentar", "Conecta observação a uma decisão de portfólio.", C.mint],
    ];
    rows.forEach(([tag, title, body, color], i) => {
      const top = 270 + i * 88;
      rule(s, left, top + 67, 1100, C.line, 1);
      text(s, tag, { left, top, width: 160, height: 22 }, { fontSize: 13, bold: true, color, letterSpacing: 1.6 });
      text(s, title, { left: 270, top: top - 3, width: 430, height: 30 }, { fontSize: 22, bold: true, color: C.ink });
      text(s, body, { left: 735, top: top, width: 430, height: 44 }, { fontSize: 17, color: C.muted });
    });
    footer(s, 5);
    notes(s, ["Evite prometer ROI futuro; mostre quais mecanismos criam capacidade de gestão.", "A interface já evidencia identidade, avaliação, alertas e decisão."]);
  }

  // 6. Mixed team operating model
  {
    const s = baseSlide(p);
    header(s, "A tese de evolução", "O foco precisa migrar de “monitorar agentes” para “gerir times mistos”.", "Performance é uma propriedade do sistema de trabalho: pessoas, agentes, processos, contexto e decisões.");
    const actors = [
      [88, "PESSOAS", "Definem propósito,\nassumem exceções e\nrespondem pelo resultado.", C.mint],
      [475, "AGENTES", "Executam tarefas\ncom autonomia, custo,\nlimites e evidências.", C.amber],
      [862, "GESTÃO", "Calibra KPIs,\nresolve desvios e\ndecide a evolução.", C.coral],
    ];
    actors.forEach(([left, title, body, color]) => {
      box(s, "rect", { left, top: 286, width: 330, height: 184 }, C.panel, { style: "solid", fill: color, width: 2 });
      text(s, title, { left: left + 24, top: 310, width: 280, height: 22 }, { fontSize: 14, bold: true, color, letterSpacing: 1.5 });
      text(s, body, { left: left + 24, top: 350, width: 280, height: 90 }, { fontSize: 22, bold: true, color: C.ink });
    });
    rule(s, 418, 376, 44, C.mint2, 2);
    rule(s, 805, 376, 44, C.mint2, 2);
    text(s, "O agente não deve ser avaliado isoladamente nem comparado entre domínios sem normalização.", { left: 155, top: 548, width: 970, height: 38 }, { fontSize: 25, bold: true, color: C.ink, alignment: "center" });
    footer(s, 6);
    notes(s, ["Esta é a principal recomendação estratégica: posicionar o Muster como camada de performance para equipes humano-agente.", "O MVP atual é mais agent-centric; a evolução precisa criar entidades, responsabilidades e métricas próprias para o time misto.", "O framework desta lâmina é proposto e ainda não representa uma feature implementada."]);
  }

  // 7. End-to-end measurement
  {
    const s = baseSlide(p);
    header(s, "Modelo operacional", "End-to-end começa pelo propósito, não pelo log.", "Cada avaliação precisa conectar intenção, trabalho executado, resultado observado e uma decisão de gestão.");
    const chain = [
      ["01", "PROPÓSITO", "por que existe"],
      ["02", "TRABALHO", "qual tarefa"],
      ["03", "OUTCOME", "qual resultado"],
      ["04", "EVIDÊNCIA", "o que prova"],
      ["05", "DECISÃO", "o que muda"],
      ["06", "AÇÃO", "quem intervém"],
      ["07", "FEEDBACK", "o que aprende"],
    ];
    chain.forEach(([number, title, body], i) => {
      const left = 76 + i * 162;
      box(s, "rect", { left, top: 312, width: 140, height: 116 }, i === 4 ? C.panel2 : C.panel, { style: "solid", fill: i === 4 ? C.amber : C.line, width: i === 4 ? 2 : 1 });
      text(s, number, { left: left + 16, top: 330, width: 36, height: 20 }, { fontSize: 13, bold: true, color: i === 4 ? C.amber : C.mint });
      text(s, title, { left: left + 16, top: 362, width: 112, height: 22 }, { fontSize: 14, bold: true, color: C.ink, letterSpacing: 0.8 });
      text(s, body, { left: left + 16, top: 397, width: 112, height: 18 }, { fontSize: 14, color: C.muted });
      if (i < chain.length - 1) text(s, "→", { left: left + 143, top: 351, width: 20, height: 24 }, { fontSize: 20, bold: true, color: C.mint2, alignment: "center" });
    });
    box(s, "rect", { left: 184, top: 510, width: 912, height: 82 }, C.panel2, { style: "solid", fill: C.mint2, width: 1 });
    text(s, "A plataforma só qualifica performance quando consegue explicar: qual propósito foi atendido, com qual evidência e qual ação será tomada.", { left: 218, top: 528, width: 844, height: 52 }, { fontSize: 21, bold: true, color: C.ink, alignment: "center" });
    footer(s, 7);
    notes(s, ["Este fluxo é o contrato end-to-end proposto para Discovery, execução, avaliação e gestão.", "A pergunta de produto deixa de ser apenas “o agente respondeu bem?” e passa a ser “o trabalho gerou o resultado esperado com controle e aprendizado?”."]);
  }

  // 8. Scorecard
  {
    const s = baseSlide(p);
    header(s, "Avaliação de desempenho", "Um score único é insuficiente para avaliar agentes.", "O veredito precisa combinar resultado, controle, eficiência, confiança humana e valor — com bloqueios para risco.");
    box(s, "rect", { left: 72, top: 250, width: 690, height: 360 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    text(s, "SCORECARD PROPOSTO", { left: 102, top: 278, width: 330, height: 22 }, { fontSize: 14, bold: true, color: C.mint, letterSpacing: 1.4 });
    const lenses = [
      ["RESULTADO", "qualidade, conclusão, uplift", C.mint],
      ["GUARDRAILS", "política, segurança, factualidade", C.coral],
      ["FLUXO", "latência, custo, produtividade", C.amber],
      ["CONFIANÇA", "adoção, aceitação, override humano", C.mint],
      ["VALOR", "receita, economia, risco evitado", C.mint2],
    ];
    lenses.forEach(([title, body, color], i) => {
      const top = 320 + i * 50;
      dot(s, 104, top + 3, 12, color);
      text(s, title, { left: 132, top: top - 3, width: 160, height: 22 }, { fontSize: 15, bold: true, color });
      text(s, body, { left: 318, top: top - 3, width: 390, height: 22 }, { fontSize: 17, color: C.ink });
    });
    box(s, "rect", { left: 806, top: 250, width: 402, height: 360 }, C.panel2, { style: "solid", fill: C.coral, width: 1 });
    text(s, "REGRAS DE DECISÃO", { left: 838, top: 278, width: 290, height: 22 }, { fontSize: 14, bold: true, color: C.coral, letterSpacing: 1.4 });
    text(s, "Hard stop", { left: 838, top: 325, width: 160, height: 24 }, { fontSize: 20, bold: true, color: C.ink });
    text(s, "Violação crítica de política, vazamento ou factualidade fora do limite bloqueia a promoção.", { left: 838, top: 357, width: 320, height: 55 }, { fontSize: 17, color: C.muted });
    text(s, "Normalização", { left: 838, top: 445, width: 180, height: 24 }, { fontSize: 20, bold: true, color: C.ink });
    text(s, "Compare por propósito, risco e baseline — nunca por ranking bruto entre áreas.", { left: 838, top: 477, width: 320, height: 55 }, { fontSize: 17, color: C.muted });
    footer(s, 8);
    notes(s, ["A avaliação atual do Muster já tem cinco camadas: eficácia, eficiência, adoção, governança e valor.", "A proposta é tornar colaboração humana e regras de bloqueio explícitas, sem apagar as cinco camadas existentes.", "Não foram definidos pesos universais: eles devem variar por propósito, risco e domínio."]);
  }

  // 9. KPI domains
  {
    const s = baseSlide(p);
    header(s, "Matriz de métricas", "As áreas precisam de KPIs diferentes, com um contrato comum.", "O catálogo deve começar por indicadores acionáveis e balancear resultado, guardrail e adoção humana.");
    const domains = [
      [88, 268, "ATENDIMENTO", "Resolução · FCR · CSAT\nRetorno em 72h · escalonamento\nTempo de atendimento · custo/caso", C.mint],
      [666, 268, "VENDAS / CRM", "Speed-to-lead · conversão qualificada\nWin-rate uplift · receita influenciada\nAdoção do rep · aderência a desconto", C.amber],
      [88, 458, "ENGENHARIA / IT", "First-pass success · cobertura de revisão\nDefeitos escapados · MTTR\nTempo de CI · horas de toil evitadas", C.mint2],
      [666, 458, "RISCO / FINANÇAS / RH", "Cobertura de auditoria · exceções\nSLA de aprovação · factualidade\nOverride humano · consistência e justiça", C.coral],
    ];
    domains.forEach(([left, top, title, body, color]) => {
      box(s, "rect", { left, top, width: 526, height: 148 }, C.panel, { style: "solid", fill: color, width: 2 });
      text(s, title, { left: left + 24, top: top + 22, width: 470, height: 22 }, { fontSize: 14, bold: true, color, letterSpacing: 1.3 });
      text(s, body, { left: left + 24, top: top + 57, width: 470, height: 70 }, { fontSize: 18, bold: true, color: C.ink });
    });
    text(s, "Regra de produto: cada KPI precisa apontar para uma decisão — promover, mentorar, corrigir, limitar ou aposentar.", { left: 130, top: 640, width: 1020, height: 28 }, { fontSize: 18, color: C.muted, alignment: "center" });
    footer(s, 9);
    notes(s, ["A lâmina amplia o catálogo atual de Negócios e Tecnologia para quatro famílias de atuação.", "As métricas são propostas de qualificação; o catálogo existente já contém parte delas, mas ainda falta conectá-las a evidência real, baseline e decisão.", "Evitar tratar produtividade humana como proxy direto da qualidade do agente sem contexto e consentimento."]);
  }

  // 10. Discovery 2.0 and metric contract
  {
    const s = baseSlide(p);
    header(s, "Discovery 2.0", "Discovery precisa descobrir o trabalho, não só o agente.", "Além de plataforma e stack, a descoberta deve produzir propósito, evidência, risco, dependências e uma primeira hipótese de KPI.");
    box(s, "rect", { left: 72, top: 250, width: 520, height: 360 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    const stages = ["Censo de fontes e runtimes", "Perfil de tarefa e autonomia", "Propósito e domínio", "Evidências e dependências", "KPI, risco e confiança", "Aprovação e conexão de runtime"];
    stages.forEach((stage, i) => {
      const top = 278 + i * 48;
      text(s, String(i + 1).padStart(2, "0"), { left: 100, top, width: 48, height: 20 }, { fontSize: 14, bold: true, color: i === 4 ? C.amber : C.mint });
      text(s, stage, { left: 164, top: top - 2, width: 380, height: 24 }, { fontSize: 17, color: C.ink });
      if (i < stages.length - 1) rule(s, 116, top + 25, 1, C.line, 22);
    });
    box(s, "rect", { left: 636, top: 250, width: 572, height: 360 }, C.panel2, { style: "solid", fill: C.amber, width: 1 });
    text(s, "CONTRATO DO KPI", { left: 668, top: 278, width: 250, height: 22 }, { fontSize: 14, bold: true, color: C.amber, letterSpacing: 1.4 });
    text(s, "propósito · fórmula · unidade · direção\nfonte · cadência · baseline · alvo\nowner · decisão · risco · confiança", { left: 668, top: 322, width: 490, height: 82 }, { fontSize: 22, bold: true, color: C.ink });
    rule(s, 668, 438, 490, C.line, 1);
    text(s, "EVIDÊNCIA", { left: 668, top: 466, width: 130, height: 20 }, { fontSize: 13, bold: true, color: C.mint, letterSpacing: 1.2 });
    text(s, "observada  ·  inferida  ·  sintética", { left: 818, top: 462, width: 320, height: 24 }, { fontSize: 17, color: C.ink });
    text(s, "Sem proveniência e confiança, o KPI vira uma opinião bem formatada.", { left: 668, top: 530, width: 490, height: 42 }, { fontSize: 19, bold: true, color: C.muted });
    footer(s, 10);
    notes(s, ["O discovery atual já identifica plataformas e propõe métricas; a evolução é enriquecer o objeto descoberto com propósito, risco, evidência e confiança.", "O contrato de KPI é uma proposta de schema de produto, ainda não implementada como entidade completa.", "Distinguir dado observado, inferência do modelo e dado sintético de demonstração é essencial para credibilidade."]);
  }

  // 11. Critical gaps and priorities
  {
    const s = baseSlide(p);
    header(s, "Qualificação do MVP", "O esqueleto está pronto; cinco lacunas impedem a gestão end-to-end.", "A prioridade não é adicionar mais telas. É transformar o que já existe em evidência comparável, atribuível e ligada a resultado.");
    const gaps = [
      ["01", "Time misto", "Criar entidade de equipe, papel humano, supervisor e direitos de decisão."],
      ["02", "Propósito", "Taxonomia que liga agente, tarefa, domínio, risco e outcome esperado."],
      ["03", "KPI por domínio", "Catálogo com fórmula, baseline, alvo, owner e política de normalização."],
      ["04", "Proveniência", "Linha do dado, confiança, auditoria amostral e calibração do avaliador."],
      ["05", "Resultado real", "Controle antes/depois, cohortes, feedback e validação do impacto humano."],
    ];
    gaps.forEach(([number, title, body], i) => {
      const top = 252 + i * 68;
      text(s, number, { left: 88, top, width: 42, height: 24 }, { fontSize: 16, bold: true, color: i < 2 ? C.coral : C.amber });
      text(s, title, { left: 150, top: top - 3, width: 210, height: 28 }, { fontSize: 21, bold: true, color: C.ink });
      text(s, body, { left: 385, top, width: 760, height: 30 }, { fontSize: 17, color: C.muted });
      rule(s, 150, top + 42, 996, C.line, 1);
    });
    box(s, "rect", { left: 160, top: 612, width: 960, height: 42 }, C.panel2, { style: "solid", fill: C.mint2, width: 1 });
    text(s, "Prioridade imediata: KPI contract + Discovery 2.0 + primeiro workload real com baseline.", { left: 188, top: 623, width: 904, height: 20 }, { fontSize: 17, bold: true, color: C.mint, alignment: "center" });
    footer(s, 11);
    notes(s, ["Esta é a leitura crítica do estágio atual: a fundação técnica e operacional é boa, mas a qualificação depende de contexto, evidência e comparação.", "Sequência recomendada: 1) contrato de KPI e propósito; 2) runtime real e feedback; 3) cohortes e benchmarks; 4) recomendações de otimização.", "A prioridade imediata reduz risco de construir dashboards sem capacidade de decisão."]);
  }

  // 12. Screenshot fleet
  {
    const s = baseSlide(p);
    header(s, "Evidência 01", "O painel começa pela pergunta certa: como a frota está se comportando?", "Saúde, valor, alertas e camadas aparecem em uma mesma leitura executiva.");
    box(s, "rect", { left: 72, top: 246, width: 770, height: 390 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    image(s, assets.frota, "Painel da frota do Muster", { left: 84, top: 258, width: 746, height: 366 }, { fit: "cover" });
    callout(s, "A", "Portfólio em uma tela", "6 agentes, 3 plataformas, saúde média, ROI e valor líquido.", 900, 292, 300, C.mint);
    callout(s, "B", "5 camadas, não uma métrica", "Eficácia, eficiência, adoção, governança e valor revelam onde a saúde se rompe.", 900, 414, 300, C.amber);
    callout(s, "C", "Atenção acionável", "Os alertas entram na mesma visão da frota, prontos para investigação.", 900, 536, 300, C.coral);
    footer(s, 12);
    notes(s, ["A tela é uma captura real do MVP em execução local.", "Os números mostrados são dados seed de demonstração, não resultados de clientes."]);
  }

  // 13. Screenshot admission
  {
    const s = baseSlide(p);
    header(s, "Evidência 02", "A operação começa antes do primeiro run: começa com identidade e limites.", "A admissão transforma contexto disperso em uma Carteira de Trabalho revisável.");
    box(s, "rect", { left: 72, top: 246, width: 770, height: 390 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    image(s, assets.admissao, "Fluxo de admissão de uma nova agente", { left: 84, top: 258, width: 746, height: 366 });
    callout(s, "A", "Preenchimento assistido", "O discovery e o pre-assessment ajudam a completar identidade, stack e intenção.", 900, 292, 300, C.mint);
    callout(s, "B", "Responsabilidade explícita", "Papel, fronteiras, autonomia e origem do business case ficam registradas.", 900, 414, 300, C.amber);
    callout(s, "C", "Pronto para operar", "A admissão vira a entrada para avaliação, telemetria e decisão.", 900, 536, 300, C.coral);
    footer(s, 13);
    notes(s, ["Mostre que a qualidade do monitoramento depende da qualidade da admissão.", "A tela evidencia as 7 etapas atuais, incluindo pre-fill com IA como opção."]);
  }

  // 14. Screenshot alerts / agent
  {
    const s = baseSlide(p);
    header(s, "Evidência 03", "Alertas deixam de ser notificações e viram ações operacionais.", "Reconhecer, atribuir, resolver e acompanhar prazo é a diferença entre observabilidade e operação.");
    box(s, "rect", { left: 72, top: 246, width: 650, height: 390 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    image(s, assets.alertas, "Detector de vitória ilusória do Muster", { left: 84, top: 258, width: 626, height: 366 });
    box(s, "rect", { left: 758, top: 246, width: 450, height: 390 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    image(s, assets.agente, "Carteira de Trabalho da agente Júlia", { left: 770, top: 258, width: 426, height: 230 });
    text(s, "O alerta ganha contexto no agente", { left: 786, top: 520, width: 390, height: 28 }, { fontSize: 22, bold: true, color: C.ink });
    text(s, "Hipótese, severidade, dono, limites, telemetria e recomendação para o comitê convivem no mesmo fluxo.", { left: 786, top: 560, width: 390, height: 50 }, { fontSize: 16, color: C.muted });
    footer(s, 14);
    notes(s, ["As duas telas mostram a relação entre detector e Carteira de Trabalho.", "O MVP já possui o workflow operacional de alertas: reconhecer, resolver, atribuir e acompanhar prazo."]);
  }

  // 15. Runtime architecture
  {
    const s = baseSlide(p);
    header(s, "Arquitetura de execução", "Muster acompanha o agente onde ele roda.", "A camada operacional pode começar local, ganhar isolamento em Docker e evoluir para workers cloud ou on-prem.");
    box(s, "rect", { left: 72, top: 260, width: 1136, height: 280 }, C.panel, { style: "solid", fill: C.line, width: 1 });
    const environments = [
      [120, "LOCAL", "rápido para validar\nsem dependência externa", C.mint],
      [380, "DOCKER", "isolamento\nreprodutibilidade", C.mint],
      [640, "CLOUD", "worker remoto\nescala sob demanda", C.amber],
      [900, "ON-PREM", "controle de dados\ne rede privada", C.coral],
    ];
    environments.forEach(([left, title, body, color], i) => {
      box(s, "rect", { left, top: 320, width: 190, height: 112 }, C.bg2, { style: "solid", fill: color, width: 2 });
      text(s, title, { left: left + 18, top: 340, width: 150, height: 22 }, { fontSize: 15, bold: true, color, letterSpacing: 1.3 });
      text(s, body, { left: left + 18, top: 374, width: 150, height: 46 }, { fontSize: 17, bold: true, color: C.ink });
      if (i < environments.length - 1) text(s, "→", { left: left + 207, top: 356, width: 42, height: 30 }, { fontSize: 28, bold: true, color: C.mint, alignment: "center" });
    });
    text(s, "telemetria unificada · task catalog allowlisted · execução auditável", { left: 210, top: 478, width: 860, height: 24 }, { fontSize: 18, bold: true, color: C.muted, alignment: "center" });
    text(s, "Hoje no MVP", { left: 88, top: 592, width: 150, height: 24 }, { fontSize: 16, bold: true, color: C.mint });
    text(s, "backends local, Docker e protocolo remoto; falta provar um agente real em cada ambiente.", { left: 245, top: 592, width: 875, height: 26 }, { fontSize: 18, color: C.ink });
    footer(s, 15);
    notes(s, ["Seja transparente: o contrato de execução e os backends existem no MVP; a validação com workloads reais ainda é o próximo passo.", "A arquitetura preserva flexibilidade: o Muster não precisa ser o runtime do agente para ser sua camada operacional."]);
  }

  // 16. MVP status
  {
    const s = baseSlide(p);
    header(s, "Status do MVP", "O núcleo está validado; agora falta provar valor em runtime real.", "O que já existe é suficiente para uma primeira operação observável, não ainda para escalar indiscriminadamente.");
    const mid = 640;
    text(s, "IMPLEMENTADO E TESTADO", { left: 88, top: 262, width: 420, height: 24 }, { fontSize: 14, bold: true, color: C.mint, letterSpacing: 1.4 });
    const done = ["Fleet dashboard e 5 camadas", "Carteira de Trabalho e admissão", "Discovery / pre-assessment", "Alertas com fluxo operacional", "Runner local, Docker e remoto", "API + Postgres + frontend local"];
    done.forEach((item, i) => {
      dot(s, 92, 310 + i * 43, 12, C.mint);
      text(s, item, { left: 118, top: 303 + i * 43, width: 430, height: 28 }, { fontSize: 18, color: C.ink });
    });
    rule(s, mid, 252, 1, C.line, 240);
    text(s, "PRÓXIMA PROVA", { left: 690, top: 262, width: 400, height: 24 }, { fontSize: 14, bold: true, color: C.amber, letterSpacing: 1.4 });
    const next = ["Escolher um agente real e um task seguro", "Rodar dry-run com evidência de execução", "Comparar métricas antes / depois", "Validar atribuição e SLA de um alerta", "Repetir em Docker ou worker remoto"];
    next.forEach((item, i) => {
      text(s, String(i + 1).padStart(2, "0"), { left: 694, top: 306 + i * 52, width: 48, height: 26 }, { fontSize: 16, bold: true, color: C.amber });
      text(s, item, { left: 760, top: 300 + i * 52, width: 370, height: 34 }, { fontSize: 18, color: C.ink });
    });
    box(s, "rect", { left: 688, top: 574, width: 440, height: 46 }, C.panel2, { style: "solid", fill: C.mint2, width: 1 });
    text(s, "86 testes · typecheck verde · servidor navegável", { left: 706, top: 587, width: 400, height: 22 }, { fontSize: 16, bold: true, color: C.mint, alignment: "center" });
    footer(s, 16);
    notes(s, ["O status reflete a última validação local: 86 testes, typecheck e servidor navegável.", "A principal lacuna não é mais UI; é observar e medir um agente real executando uma tarefa real."]);
  }

  // 17. Close / decision
  {
    const s = baseSlide(p);
    text(s, "A próxima decisão é pequena o bastante para acontecer agora.", { left: 72, top: 86, width: 980, height: 86 }, { fontSize: 42, bold: true, color: C.ink });
    text(s, "Escolher um agente real. Admitir. Executar. Medir. Agir.", { left: 76, top: 208, width: 900, height: 42 }, { fontSize: 25, color: C.mint });
    rule(s, 76, 302, 540, C.mint2, 2);
    const actions = [
      ["01", "Admitir", "dar identidade, dono e limites"],
      ["02", "Executar", "rodar uma tarefa segura em dry-run"],
      ["03", "Decidir", "usar a evidência para promover, mentorar ou corrigir"],
    ];
    actions.forEach(([n, title, body], i) => {
      const top = 360 + i * 82;
      text(s, n, { left: 80, top, width: 42, height: 26 }, { fontSize: 17, bold: true, color: C.amber });
      text(s, title, { left: 142, top: top - 4, width: 210, height: 28 }, { fontSize: 23, bold: true, color: C.ink });
      text(s, body, { left: 380, top: top, width: 540, height: 26 }, { fontSize: 18, color: C.muted });
    });
    box(s, "rect", { left: 980, top: 360, width: 220, height: 170 }, C.panel, { style: "solid", fill: C.mint2, width: 2 });
    text(s, "MUSTER", { left: 1008, top: 397, width: 165, height: 28 }, { fontSize: 20, bold: true, color: C.mint, alignment: "center", letterSpacing: 2 });
    text(s, "operação\nantes da escala", { left: 1010, top: 445, width: 160, height: 58 }, { fontSize: 21, bold: true, color: C.ink, alignment: "center" });
    footer(s, 17, "MUSTER · PRIMEIRA OPERAÇÃO OBSERVÁVEL");
    notes(s, ["Feche com uma ação concreta, não com uma promessa ampla.", "O MVP está pronto para a primeira operação observável; a validação de produto começa com um workload real e seguro."]);
  }

  const previewDir = `${TMP}/rendered`;
  await fs.mkdir(previewDir, { recursive: true });
  for (const [index, slide] of p.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(`${previewDir}/${stem}.png`, await p.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(`${previewDir}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(`${previewDir}/deck-montage.webp`, await p.export({ format: "webp", montage: true, scale: 1 }));
  const finalPath = `${OUT}/muster-apresentacao-alto-nivel.pptx`;
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(finalPath);
  console.log(finalPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
