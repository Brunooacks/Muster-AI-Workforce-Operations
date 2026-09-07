const requestedTheme = new URLSearchParams(window.location.search).get("theme");
const state = { items: [], report: null, source: "all", minScore: 0, theme: requestedTheme || "all" };
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(
  /[&<>'"]/g,
  (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[match],
);
const safeUrl = (value) => /^https?:\/\//i.test(String(value ?? "")) ? String(value) : "#";
const money = (value, currency) => value == null
  ? "—"
  : new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
const pct = (value) => `${Math.round((value || 0) * 100)}%`;
const displayTitle = (item) => item.title_pt || item.title;
const isLegacyTranslationFallback = (value) => /^Sinal internacional sobre .+tradução detalhada depende do enriquecimento por IA\.?$/i.test(
  String(value || "").trim(),
);

function cleanSourceDescription(value) {
  return String(value || "")
    .replace(/^#\s*\d+\s+/i, "")
    .replace(/\s+\d+\s+(?:minutes?|hours?|days?|weeks?|months?)\s+ago\b[\s\S]*$/i, "")
    .replace(/\s+see details\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryForDisplay(item) {
  const summary = String(item.summary_pt || "").trim();
  if (summary && !isLegacyTranslationFallback(summary)) return summary;
  return cleanSourceDescription(item.description) || "Descrição não detalhada pela fonte monitorada.";
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3200);
}

async function load() {
  const [report, items, runs] = await Promise.all([
    fetch("/api/report").then((response) => response.json()),
    fetch("/api/opportunities?limit=500").then((response) => response.json()),
    fetch("/api/runs?limit=30").then((response) => response.json()),
  ]);
  state.report = report;
  state.items = items;
  normalizeTheme();
  renderReport();
  renderAgents(runs);
  render();
}

function updateThemeUrl(theme, method = "pushState") {
  const url = new URL(window.location.href);
  if (theme === "all") url.searchParams.delete("theme");
  else url.searchParams.set("theme", theme);
  window.history[method]({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function normalizeTheme() {
  if (state.theme === "all" || !state.report) return;
  const availableThemes = (state.report.themes || []).map((theme) => theme.theme);
  const canonicalTheme = availableThemes.find(
    (theme) => theme.localeCompare(state.theme, "pt-BR", { sensitivity: "base" }) === 0,
  );
  if (!canonicalTheme) {
    state.theme = "all";
    updateThemeUrl("all", "replaceState");
    return;
  }
  if (canonicalTheme !== state.theme) {
    state.theme = canonicalTheme;
    updateThemeUrl(canonicalTheme, "replaceState");
  }
}

function selectTheme(theme, { history = true } = {}) {
  state.theme = theme || "all";
  normalizeTheme();
  if (history) updateThemeUrl(state.theme);
  renderReport();
  render();
  document.querySelector(".table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReport() {
  const report = state.report;
  if (!report || report.status === "empty") return;
  $("#summary").textContent = report.executive_summary;
  $("#generated-at").textContent = new Date(report.generated_at).toLocaleString("pt-BR");
  $("#runtime-label").textContent = `${report.opportunity_count} sinais acompanhados`;
  const cards = [
    ["Oportunidades", report.opportunity_count, "portfólio monitorado", "◇"],
    ["Evidências", report.total_links, "links rastreáveis", "⌁"],
    ["Atenção global", money(report.total_paid_value_usd, "USD"), "valor público acumulado", "↗"],
    ["Atenção Brasil", money(report.total_paid_value_brl, "BRL"), "valor público acumulado", "◎"],
  ];
  $("#kpis").innerHTML = cards.map((card, index) => `
    <article class="kpi">
      <div class="kpi-head"><span>${esc(card[0])}</span><i>${esc(card[3])}</i></div>
      <strong>${esc(card[1])}</strong><small>${esc(card[2])}</small><b>0${index + 1}</b>
    </article>
  `).join("");
  $("#themes").innerHTML = (report.themes || []).slice(0, 9).map((theme) => `
    <a class="theme-row${state.theme === theme.theme ? " active" : ""}" href="/?theme=${encodeURIComponent(theme.theme)}" data-theme="${esc(theme.theme)}"${state.theme === theme.theme ? ' aria-current="page"' : ""}>
      <div class="theme-head"><span class="theme-name">${esc(theme.theme)}</span><span class="theme-count">${theme.count}</span></div>
      <div class="theme-bar"><i style="width:${Math.min(100, theme.share * 180)}%"></i></div>
      <div class="theme-action"><span>Ver tudo nesta categoria</span><b aria-hidden="true">↗</b></div>
    </a>
  `).join("");
  document.querySelectorAll(".theme-row[data-theme]").forEach((link) => {
    link.onclick = (event) => {
      event.preventDefault();
      selectTheme(link.dataset.theme);
    };
  });
}

function filtered() {
  return state.items.filter((item) =>
    (state.source === "all" || item.source === state.source)
    && item.opportunity_score >= state.minScore
    && (state.theme === "all" || (item.themes || []).includes(state.theme))
  );
}

function renderClusterContext() {
  const context = $("#cluster-context");
  const isActive = state.theme !== "all";
  context.hidden = !isActive;
  $("#cluster-name").textContent = isActive ? state.theme : "";
}

function render() {
  const items = filtered();
  $("#result-count").textContent = state.theme === "all"
    ? `${items.length} itens`
    : `${items.length} em ${state.theme}`;
  renderClusterContext();
  $("#opportunity-table").innerHTML = items.slice(0, 100).map((item, index) => {
    const originalTitle = item.title_pt && item.title_pt !== item.title
      ? `<small class="original-title">Original: ${esc(item.title)}</small>`
      : "";
    return `
      <tr data-key="${esc(item.external_key)}">
        <td>${index + 1}</td>
        <td class="idea">
          <strong>${esc(displayTitle(item))}</strong>
          <small>${esc(summaryForDisplay(item))}</small>
          ${originalTitle}
        </td>
        <td><span class="source-tag">${esc(item.source)}</span></td>
        <td><span class="score-tag">${item.opportunity_score}</span></td>
        <td>${item.return_score}<div class="meter"><i style="width:${item.return_score}%"></i></div></td>
        <td>${item.complexity_score}<div class="meter"><i style="width:${item.complexity_score}%;background:var(--accent-warning)"></i></div></td>
        <td>${item.paid_value != null ? money(item.paid_value, item.currency) : "—"}${item.rank ? ` · #${item.rank}` : ""}</td>
        <td>›</td>
      </tr>
    `;
  }).join("");
  document.querySelectorAll("tbody tr").forEach((row) => {
    row.onclick = () => openDetail(state.items.find((item) => item.external_key === row.dataset.key));
  });
  renderScatter(items);
}

function renderScatter(items) {
  const svg = $("#scatter");
  const width = 760;
  const height = 360;
  const padding = 42;
  let html = "";
  for (let index = 0; index <= 4; index += 1) {
    const x = padding + (width - padding * 2) * index / 4;
    const y = padding + (height - padding * 2) * index / 4;
    html += `<line class="gridline" x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}"/>`;
    html += `<line class="gridline" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"/>`;
  }
  html += `<line class="axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"/>`;
  html += `<line class="axis" x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"/>`;
  html += `<text class="axis-label" x="${width / 2}" y="${height - 8}">COMPLEXIDADE →</text>`;
  html += `<text class="axis-label" transform="translate(12 ${height / 2}) rotate(-90)">POTENCIAL DE NEGÓCIO →</text>`;
  for (const item of items.slice(0, 120)) {
    const x = padding + (width - padding * 2) * item.complexity_score / 100;
    const y = height - padding - (height - padding * 2) * item.return_score / 100;
    const radius = 5 + Math.min(11, (item.opportunity_score || 0) / 13);
    const color = item.source === "melhorlance" ? "var(--accent-primary)" : item.source === "outbid" ? "var(--accent-secondary)" : "var(--accent-tertiary)";
    html += `<circle class="bubble" data-key="${esc(item.external_key)}" cx="${x}" cy="${y}" r="${radius}" fill="${color}" fill-opacity=".72"><title>${esc(displayTitle(item))} · score ${item.opportunity_score}</title></circle>`;
  }
  svg.innerHTML = html;
  svg.querySelectorAll(".bubble").forEach((bubble) => {
    bubble.onclick = () => openDetail(state.items.find((item) => item.external_key === bubble.dataset.key));
  });
}

function renderAgents(runs) {
  const latest = {};
  for (const run of runs) if (!latest[run.source]) latest[run.source] = run;
  const definitions = {
    melhorlance: ["Radar Melhor Lance", "LangChain", "Ranking brasileiro"],
    outbid: ["Outbid Global Scout", "CrewAI", "Atenção global traduzida"],
    "yc-rfs": ["YC RFS Opportunity Miner", "Agno", "Dores YC traduzidas e pesquisadas"],
  };
  $("#agents").innerHTML = Object.entries(definitions).map(([key, definition]) => {
    const run = latest[key];
    const metrics = run?.metrics || {};
    const warning = metrics.degraded_reason || run?.error;
    return `
      <article class="agent-card">
        <div class="agent-top"><span class="agent-icon">${definition[1].slice(0, 2).toUpperCase()}</span><span class="status">● ${run?.status || "aguardando"}</span></div>
        <h3>${definition[0]}</h3><p>${definition[2]} · ${definition[1]}</p>
        <div class="agent-metrics">
          <div><span>Itens</span><strong>${metrics.records_discovered || 0}</strong></div>
          <div><span>Tradução</span><strong>${pct(metrics.translation_coverage)}</strong></div>
          <div><span>Dossiês</span><strong>${pct(metrics.business_detail_coverage)}</strong></div>
          <div><span>Qualidade</span><strong>${pct(metrics.analysis_quality)}</strong></div>
          <div><span>Duração</span><strong>${metrics.duration_ms ? `${(metrics.duration_ms / 1000).toFixed(1)}s` : "—"}</strong></div>
        </div>
        ${warning ? `<p class="agent-warning">${esc(warning)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderList(items, emptyLabel = "Não identificado nas evidências disponíveis.") {
  if (!items || items.length === 0) return `<p class="empty-detail">${esc(emptyLabel)}</p>`;
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function referenceItems(item) {
  const references = [];
  if (item.url) references.push({ title: "Fonte original", url: item.url, content: "" });
  for (const url of item.links || []) references.push({ title: "Referência da publicação", url, content: "" });
  for (const evidence of item.market_evidence || []) references.push(evidence);
  const unique = new Map();
  for (const reference of references) {
    if (reference.url && !unique.has(reference.url)) unique.set(reference.url, reference);
  }
  return [...unique.values()];
}

function openDetail(item) {
  if (!item) return;
  const potential = item.business_potential || {};
  const references = referenceItems(item);
  const translated = item.translation_status === "translated";
  const translationLabel = item.translation_status === "not_needed"
    ? "Conteúdo original em português"
    : translated
      ? `Traduzido de ${item.source_language || "idioma internacional"}`
      : "Conteúdo original em inglês · tradução pendente";
  const originalTitle = item.title_pt && item.title_pt !== item.title
    ? `<p class="original-detail"><strong>Título original:</strong> ${esc(item.title)}</p>`
    : "";
  const evidenceCards = references.slice(0, 30).map((reference) => `
    <a class="reference-card" href="${esc(safeUrl(reference.url))}" target="_blank" rel="noreferrer">
      <strong>${esc(reference.title || reference.url)}</strong>
      ${reference.content ? `<span>${esc(reference.content)}</span>` : ""}
      <small>${esc(reference.url)}</small>
    </a>
  `).join("");

  $("#detail-content").innerHTML = `
    <p class="eyebrow">${esc(item.source)} · ${item.season ? esc(item.season) : item.rank ? `RANK #${item.rank}` : "SINAL PÚBLICO"}</p>
    <h2 class="detail-title">${esc(displayTitle(item))}</h2>
    ${originalTitle}
    <p class="translation-state">${esc(translationLabel)}</p>
    <p class="detail-summary">${esc(summaryForDisplay(item))}</p>
    <div class="detail-meta">
      ${(item.themes || []).map((theme) => `<span class="source-tag">${esc(theme)}</span>`).join("")}
      <span class="source-tag">Idioma: ${esc(item.source_language || "não identificado")}</span>
      <span class="source-tag">Potencial: ${esc(potential.level || "não avaliado")}</span>
      <span class="source-tag">Análise: ${esc(item.analysis_method === "llm" ? "IA enriquecida" : "skill estruturada")}</span>
    </div>

    <div class="detail-grid detail-grid-five">
      <div><span>Score de oportunidade</span><strong>${item.opportunity_score}</strong></div>
      <div><span>Potencial de negócio</span><strong>${item.return_score}</strong></div>
      <div><span>Complexidade do MVP</span><strong>${item.complexity_score}</strong></div>
      <div><span>Confiança</span><strong>${pct(item.confidence)}</strong></div>
      <div><span>Qualidade da análise</span><strong>${item.analysis_quality_score || 0}</strong><small>Evidência ${esc(item.evidence_strength || "baixa")}</small></div>
    </div>

    <section class="detail-section opportunity-callout">
      <span class="detail-kicker">TESE DA OPORTUNIDADE</span>
      <h3>Problema e solução possível</h3>
      <div class="detail-columns">
        <div><h4>Oportunidade</h4><p>${esc(item.opportunity_statement_pt || "Ainda não detalhada.")}</p></div>
        <div><h4>Conceito de solução</h4><p>${esc(item.solution_concept_pt || "Ainda não detalhado.")}</p></div>
      </div>
    </section>

    <section class="detail-section">
      <span class="detail-kicker">BASE DA DECISÃO</span>
      <h3>O que sabemos, o que inferimos e o que falta provar</h3>
      <div class="analysis-ledger">
        <div class="evidence-card"><h4>Fatos observados</h4>${renderList(potential.evidence)}</div>
        <div class="assumption-card"><h4>Hipóteses e inferências</h4>${renderList(potential.assumptions)}</div>
        <div class="question-card"><h4>Perguntas em aberto</h4>${renderList(potential.open_questions)}</div>
      </div>
    </section>

    <section class="detail-section">
      <span class="detail-kicker">POTENCIAL DE NEGÓCIO</span>
      <h3>Quem compra, por que compraria e como capturar valor</h3>
      <div class="business-grid">
        <div><span>Perfil de cliente</span><strong>${esc(potential.customer_profile || item.target_user)}</strong></div>
        <div><span>Comprador econômico</span><strong>${esc(potential.economic_buyer || "não identificado")}</strong></div>
        <div><span>Escopo do mercado</span><strong>${esc(potential.market_scope || "não dimensionado")}</strong></div>
        <div><span>Frequência do problema</span><strong>${esc(potential.problem_frequency || "não identificada")}</strong></div>
      </div>
      <div class="value-capture"><span>Captura de valor</span><p>${esc(potential.value_capture || "Hipótese ainda não validada.")}</p></div>
      <div class="detail-columns">
        <div><h4>Modelos de receita possíveis</h4>${renderList(potential.revenue_models)}</div>
        <div><h4>Por que agora</h4>${renderList(potential.why_now)}</div>
      </div>
    </section>

    <section class="detail-section">
      <span class="detail-kicker">MERCADO E POSICIONAMENTO</span>
      <div class="detail-columns">
        <div><h3>Sinais observados</h3>${renderList(potential.market_signals)}</div>
        <div><h3>Dores identificadas</h3>${renderList(item.pain_points)}</div>
      </div>
      <div class="detail-columns">
        <div><h4>Cenário competitivo</h4><p>${esc(potential.competitive_landscape || "Não pesquisado.")}</p></div>
        <div><h4>Diferenciação a testar</h4><p>${esc(potential.differentiation || "Não definida.")}</p></div>
      </div>
    </section>

    <section class="detail-section">
      <span class="detail-kicker">DA IDEIA AO EXPERIMENTO</span>
      <div class="metric-contract"><span>KPIs para provar valor</span>${renderList(potential.success_metrics)}</div>
      <div class="detail-columns">
        <div><h3>Escopo recomendado do MVP</h3>${renderList(potential.mvp_scope)}</div>
        <div><h3>Entrada no mercado</h3>${renderList(potential.go_to_market)}</div>
      </div>
      <div class="detail-columns">
        <div><h3>Experimentos de validação</h3>${renderList(potential.validation_experiments)}</div>
        <div><h3>Riscos principais</h3>${renderList(potential.risks)}</div>
      </div>
    </section>

    <section class="detail-section">
      <span class="detail-kicker">LEITURA DO AGENTE</span>
      <h3>Racional da avaliação</h3><p>${esc(item.rationale)}</p>
    </section>

    <section class="detail-section">
      <span class="detail-kicker">EVIDÊNCIAS</span>
      <h3>Referências (${references.length})</h3>
      <div class="detail-links">${evidenceCards || '<p class="empty-detail">Nenhuma referência rastreável.</p>'}</div>
    </section>
  `;
  $("#detail-dialog").showModal();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".filter").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.source = button.dataset.source;
      render();
    };
  });
  $("#score-filter").oninput = (event) => {
    state.minScore = Number(event.target.value);
    $("#score-value").textContent = state.minScore;
    render();
  };
  $("#cluster-clear").onclick = () => selectTheme("all");
  window.onpopstate = () => {
    state.theme = new URLSearchParams(window.location.search).get("theme") || "all";
    normalizeTheme();
    renderReport();
    render();
  };
  $("#detail-dialog .close").onclick = () => $("#detail-dialog").close();
  $("#run-button").onclick = async () => {
    const button = $("#run-button");
    button.disabled = true;
    button.textContent = "Coleta em andamento…";
    const response = await fetch("/api/run", { method: "POST" });
    const data = await response.json();
    toast(data.message || data.detail);
    setTimeout(() => {
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">↻</span> Nova varredura';
      load();
    }, 12000);
  };
  load().catch((error) => toast(`Falha ao carregar: ${error.message}`));
});
