from __future__ import annotations

from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "guia-validacao-mvp-muster.pdf"

NAVY = colors.HexColor("#10243E")
INK = colors.HexColor("#1B2B40")
MUTED = colors.HexColor("#607089")
TEAL = colors.HexColor("#00A6A6")
PALE_TEAL = colors.HexColor("#E8F7F6")
PALE_BLUE = colors.HexColor("#EEF4FA")
PALE_YELLOW = colors.HexColor("#FFF7DD")
LINE = colors.HexColor("#D9E2EC")
WHITE = colors.white


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=9, leading=12, textColor=TEAL, tracking=1.2, alignment=TA_CENTER,
    spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=28, leading=32, textColor=WHITE, alignment=TA_CENTER, spaceAfter=14,
))
styles.add(ParagraphStyle(
    name="CoverSubtitle", parent=styles["Normal"], fontName="Helvetica",
    fontSize=12, leading=18, textColor=colors.HexColor("#C7D7E8"),
    alignment=TA_CENTER, spaceAfter=24,
))
styles.add(ParagraphStyle(
    name="H1Muster", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=19, leading=23, textColor=NAVY, spaceBefore=8, spaceAfter=9,
))
styles.add(ParagraphStyle(
    name="H2Muster", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=12, leading=15, textColor=TEAL, spaceBefore=9, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BodyMuster", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.4, leading=14, textColor=INK, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="SmallMuster", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8, leading=11, textColor=MUTED, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="BulletMuster", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.2, leading=13, textColor=INK, leftIndent=12, firstLineIndent=-8,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="CodeMuster", parent=styles["Code"], fontName="Courier",
    fontSize=7.5, leading=10, textColor=colors.HexColor("#D8E7F5"),
    leftIndent=0, rightIndent=0,
))
styles.add(ParagraphStyle(
    name="TableHeadMuster", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8, leading=10, textColor=WHITE,
))
styles.add(ParagraphStyle(
    name="TableMuster", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8, leading=11, textColor=INK,
))
styles.add(ParagraphStyle(
    name="CoverCell", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8, leading=10, textColor=colors.HexColor("#DCEAF5"),
))
styles.add(ParagraphStyle(
    name="CalloutMuster", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=9, leading=13, textColor=NAVY, spaceAfter=2,
))


def p(text: str, style: str = "BodyMuster") -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])


def rich(text: str, style: str = "BodyMuster") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"- {escape(text)}", styles["BulletMuster"])


def code(text: str) -> Preformatted:
    return Preformatted(text.strip("\n"), styles["CodeMuster"])


def code_box(text: str) -> Table:
    return Table([[code(text)]], colWidths=[170 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.5, NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))


def callout(title: str, text: str, background=PALE_TEAL) -> Table:
    return Table([[rich(f"<b>{escape(title)}</b><br/>{escape(text)}", "BodyMuster")]],
                 colWidths=[170 * mm], style=TableStyle([
                     ("BACKGROUND", (0, 0), (-1, -1), background),
                     ("BOX", (0, 0), (-1, -1), 0.6, TEAL),
                     ("LEFTPADDING", (0, 0), (-1, -1), 10),
                     ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                     ("TOPPADDING", (0, 0), (-1, -1), 8),
                     ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                 ]))


def section(title: str, subtitle: str | None = None):
    items = [p(title, "H1Muster")]
    if subtitle:
        items.append(p(subtitle, "SmallMuster"))
    return items


def footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 9 * mm, "Muster - Guia de validacao do MVP")
    canvas.drawRightString(width - 20 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def build_story():
    story = []

    cover = Table([
        [Spacer(1, 18 * mm)],
        [p("GUIA OPERACIONAL", "CoverKicker")],
        [p("Validacao do MVP Muster", "CoverTitle")],
        [p("Ambiente local, painel, runner LangChain e telemetria", "CoverSubtitle")],
        [Table([
            [p("Banco", "TableHeadMuster"), p("API", "TableHeadMuster"), p("Painel", "TableHeadMuster"), p("Runner", "TableHeadMuster")],
            [p("Postgres :5433", "CoverCell"), p("Express :8080", "CoverCell"), p("Vite :5173", "CoverCell"), p("local / Docker / remoto", "CoverCell")],
        ], colWidths=[40 * mm] * 4, style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TEAL),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#173455")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#3D6588")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))],
        [Spacer(1, 19 * mm)],
        [p(f"Atualizado em {date.today().strftime('%d/%m/%Y')}", "CoverSubtitle")],
    ], colWidths=[170 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("BOX", (0, 0), (-1, -1), 0, NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(cover)
    story.append(PageBreak())

    story.extend(section("1. Objetivo da validação", "O teste deve confirmar quatro coisas: o ambiente sobe, o painel acessa a API, um agente executa uma tarefa e a telemetria aparece no Muster."))
    story.append(callout("Resultado esperado", "Ao final, o painel deve abrir em http://localhost:5173, o runner deve concluir o dry-run e a página do agente deve mostrar eventos de execução e feedback."))
    story.append(Spacer(1, 5))
    for item in [
        "Banco Postgres iniciado e saudável.",
        "Migrations aplicadas sem erro.",
        "API respondendo na porta 8080.",
        "Painel acessível na porta 5173.",
        "Runner dry-run enviando telemetria.",
        "Runner live usando LangChain e tarefas allowlisted.",
    ]:
        story.append(bullet(item))

    story.extend(section("2. Pré-requisitos", "Instale ou deixe disponíveis antes de começar."))
    for item in [
        "Docker Desktop aberto e autorizado a executar containers.",
        "Node.js 20 ou superior.",
        "pnpm instalado.",
        "Um projeto Clerk de teste com publishable key e secret key.",
        "Uma chave OpenAI ou endpoint OpenAI-compatible somente para o teste live.",
        "Um navegador para acessar o painel.",
    ]:
        story.append(bullet(item))
    story.append(callout("Atenção", "O Postgres do Compose é publicado na porta 5433. A API usa a porta 8080 e o frontend usa a porta 5173.", PALE_YELLOW))

    story.extend(section("3. Subir o banco", "Execute no terminal principal."))
    story.append(code_box("docker compose up -d postgres\ndocker compose ps"))
    story.append(p("Continue somente quando o serviço postgres aparecer como healthy. Se for a primeira execução, o Docker fará o download da imagem."))
    story.append(code_box("export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/muster\npnpm --filter @workspace/db run migrate"))

    story.extend(section("4. Subir a API", "Use um segundo terminal e mantenha-o aberto para acompanhar os logs."))
    story.append(code_box("export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/muster\nexport PORT=8080\nexport NODE_ENV=development\nexport CLERK_SECRET_KEY=sk_test_SUBSTITUA\nexport CLERK_PUBLISHABLE_KEY=pk_test_SUBSTITUA\nexport WEB_APP_URL=http://localhost:5173\npnpm --filter @workspace/api-server run dev"))
    story.append(Spacer(1, 4))
    story.append(code_box("curl http://localhost:8080/api/health"))
    story.append(p("A API deve informar que está saudável. Rotas protegidas retornam 401 até receberem uma sessão Clerk válida."))

    story.extend(section("5. Subir o painel", "Use um terceiro terminal."))
    story.append(code_box("export PORT=5173\nexport API_PROXY_TARGET=http://localhost:8080\nexport VITE_CLERK_PUBLISHABLE_KEY=pk_test_SUBSTITUA\npnpm --filter @workspace/muster run dev"))
    story.append(p("Abra http://localhost:5173 e autentique-se pelo Clerk. A API do painel será encaminhada pelo proxy do Vite para localhost:8080."))

    story.extend(section("6. Testar o runner sem LLM", "Este é o primeiro teste recomendado. Ele valida a integração com o Muster sem consumir créditos de modelo."))
    story.append(code_box("export MUSTER_BASE_URL=http://localhost:8080\nexport MUSTER_AGENT_ID=agent-id\nexport MUSTER_AUTH_TOKEN=agent-api-key\nexport AGENT_MODE=dry-run\npnpm --filter @workspace/agent-runner run start"))
    story.append(p("Saída esperada: Dry-run concluído. O runner resolve um agente admitido, mede a execução e envia eventos execution e feedback para a API."))
    story.append(callout("Se aparecer 'Nenhum agente encontrado'", "Abra a tela de admissão no painel e admita um agente de demonstração. Depois execute o runner novamente.", PALE_YELLOW))

    story.extend(section("7. Conferir a telemetria", "Verifique o resultado pelo painel ou diretamente pela API."))
    story.append(code_box("curl http://localhost:8080/api/agents\n# copie o id de um agente\ncurl http://localhost:8080/api/agents/AGENT_ID/telemetry/7d"))
    story.append(p("No painel, abra o detalhe do agente e procure a seção Telemetria Operacional. O resumo deve mostrar pelo menos uma execução recente."))

    story.extend(section("8. Testar o agente LangChain real", "Este passo requer uma chave de modelo ou gateway compatível."))
    story.append(code_box("export AGENT_MODE=live\nexport OPENAI_API_KEY=sua-chave\nexport MUSTER_AGENT_MODEL=gpt-4o-mini\nexport AGENT_TASK='Execute a tarefa typecheck, informe o resultado e registre a decisão'\npnpm --filter @workspace/agent-runner run start"))
    story.append(p("O agente recebe somente tarefas do catálogo allowlisted: inspect_workspace, run_tests, typecheck e validate_compose. Ele não recebe shell arbitrário."))

    story.append(PageBreak())
    story.extend(section("9. Testar o runner dentro do Docker", "Use o perfil normal para validar o container do agente."))
    story.append(code_box("AGENT_MODE=dry-run docker compose --profile agent run --rm agent-runner"))
    story.append(p("O container alcança a API do host por host.docker.internal:8080. O Postgres precisa estar iniciado e a API precisa continuar rodando."))
    story.append(callout("Backend Docker controlado", "O perfil agent-docker monta o socket do Docker e possui acesso elevado ao daemon. Só use com um container alvo confiável e com MUSTER_DOCKER_CONTAINER configurado.", PALE_YELLOW))
    story.append(code_box("export MUSTER_DOCKER_CONTAINER=muster-agent-workload\ndocker compose --profile agent-docker run --rm agent-runner-docker"))

    story.extend(section("10. Backend remoto cloud/on-premise", "O runner também pode delegar as tarefas a um worker externo."))
    story.append(code_box("export MUSTER_EXECUTION_BACKEND=remote\nexport MUSTER_EXECUTION_GATEWAY_URL=https://worker.example.com\nexport MUSTER_EXECUTION_TOKEN=seu-token\npnpm --filter @workspace/agent-runner run start"))
    story.append(p("O worker deve aceitar POST /tasks com { taskKey } e retornar exitCode, stdout, stderr e durationMs. O catálogo de tarefas continua sendo o mesmo."))

    story.append(PageBreak())
    story.extend(section("11. Checklist final", "Marque cada item durante a validação."))
    checklist = [
        [p("Status", "TableHeadMuster"), p("Validação", "TableHeadMuster"), p("Evidência", "TableHeadMuster")],
        [p("[ ]", "TableMuster"), p("Postgres healthy", "TableMuster"), p("docker compose ps", "TableMuster")],
        [p("[ ]", "TableMuster"), p("Migrations aplicadas", "TableMuster"), p("sem erro no terminal", "TableMuster")],
        [p("[ ]", "TableMuster"), p("API saudável", "TableMuster"), p("curl /api/health", "TableMuster")],
        [p("[ ]", "TableMuster"), p("Painel acessível", "TableMuster"), p("localhost:5173", "TableMuster")],
        [p("[ ]", "TableMuster"), p("Runner dry-run", "TableMuster"), p("Dry-run concluído", "TableMuster")],
        [p("[ ]", "TableMuster"), p("Telemetria registrada", "TableMuster"), p("execução no detalhe do agente", "TableMuster")],
        [p("[ ]", "TableMuster"), p("Runner live", "TableMuster"), p("resultado LangChain", "TableMuster")],
    ]
    story.append(Table(checklist, colWidths=[20 * mm, 70 * mm, 80 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE_BLUE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])))

    story.extend(section("12. Troubleshooting rápido"))
    troubleshooting = [
        [p("Problema", "TableHeadMuster"), p("Ação", "TableHeadMuster")],
        [p("Docker não conecta", "TableMuster"), p("Abra o Docker Desktop e repita docker compose up -d postgres.", "TableMuster")],
        [p("Porta 5433 ocupada", "TableMuster"), p("Defina POSTGRES_PORT=55433 e use essa porta no DATABASE_URL.", "TableMuster")],
        [p("API sem DATABASE_URL", "TableMuster"), p("Exporte DATABASE_URL no mesmo terminal que inicia a API.", "TableMuster")],
        [p("Painel sem dados", "TableMuster"), p("Confirme o proxy, a sessão Clerk e o vínculo do usuário com a organização.", "TableMuster")],
        [p("Runner não acha agente", "TableMuster"), p("Admite um agente no painel ou defina MUSTER_AGENT_ID manualmente.", "TableMuster")],
        [p("Live falha por credencial", "TableMuster"), p("Use AGENT_MODE=dry-run primeiro; depois configure OPENAI_API_KEY.", "TableMuster")],
    ]
    story.append(Table(troubleshooting, colWidths=[45 * mm, 125 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE_BLUE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])))
    story.append(Spacer(1, 8))
    story.append(callout("Próxima etapa", "Depois de concluir este roteiro, registre os resultados observados, o tempo de execução, erros encontrados e quais tarefas o agente deve executar no ambiente real.", PALE_TEAL))
    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=20 * mm, title="Guia de Validacao do MVP Muster",
        author="Muster",
    )
    document.build(build_story(), onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
