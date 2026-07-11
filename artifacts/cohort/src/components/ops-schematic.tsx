/**
 * OpsSchematic — o esquema animado "a plataforma operando por dentro".
 * Pipeline: conectores → admissão (carteira) → avaliação 5 camadas (feixe de
 * varredura + detector de vitória ilusória) → veredito do comitê.
 *
 * SVG puro com animações nativas (SMIL) — sem dependências. Cores fixas da
 * paleta Ops Room (mesmos valores dos tokens); o app é single-theme.
 * `prefers-reduced-motion` esconde pontos/feixe via classes ops-* (index.css).
 */

const PHOSPHOR = "#7fb89a";
const CREAM = "#efe9da";
const OCHRE = "#c89b4b";
const TERRA = "#c86450";
const MUTED = "#8fa094";
const EYEBROW = "#5c6f63";

const box = {
  fill: "rgba(127,184,154,.05)",
  stroke: "rgba(127,184,154,.4)",
  rx: 5,
} as const;

const SOURCES = [
  { y: 53, label: "GITHUB" },
  { y: 133, label: "OPENAI" },
  { y: 213, label: "AWS BEDROCK" },
  { y: 293, label: "COPILOT" },
];

const LAYERS = [
  { y: 130, label: "EFICÁCIA", dur: "2.4s", begin: "0s" },
  { y: 170, label: "EFICIÊNCIA", dur: "2.1s", begin: ".4s" },
  { y: 210, label: "ADOÇÃO", dur: "2.7s", begin: ".2s" },
  { y: 250, label: "GOVERNANÇA", dur: "2.2s", begin: ".7s" },
  { y: 290, label: "VALOR", dur: "2.5s", begin: ".1s" },
];

const VERDICTS = [
  { y: 78, label: "▲ PROMOVER", color: PHOSPHOR, stroke: "rgba(127,184,154,.6)" },
  { y: 193, label: "◆ MENTORAR", color: OCHRE, stroke: "rgba(200,155,75,.55)" },
  { y: 308, label: "▼ APOSENTAR", color: TERRA, stroke: "rgba(200,100,80,.55)" },
];

const DOTS: Array<{ path: string; color: string; dur: string; begin: string; opacity?: number }> = [
  { path: "#ops-j-promote", color: PHOSPHOR, dur: "7.5s", begin: "0s" },
  { path: "#ops-j-promote", color: PHOSPHOR, dur: "7.5s", begin: "3.7s", opacity: 0.7 },
  { path: "#ops-j-mentor", color: OCHRE, dur: "8.6s", begin: "1.4s" },
  { path: "#ops-j-mentor", color: OCHRE, dur: "8.6s", begin: "5.6s", opacity: 0.7 },
  { path: "#ops-j-retire", color: TERRA, dur: "9.8s", begin: "2.3s" },
];

export function OpsSchematic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1120 430"
      role="img"
      aria-label="Esquema animado do pipeline do Muster: conectores alimentam a admissão, agentes atravessam a avaliação em cinco camadas sob o detector de vitória ilusória e saem com veredito de promover, mentorar ou aposentar."
      className={className}
      fontFamily="'IBM Plex Mono', Menlo, monospace"
    >
      {/* ── Conectores (fontes) ── */}
      <text x="28" y="38" fill={EYEBROW} fontSize="9" letterSpacing=".22em">
        CONECTORES
      </text>
      {SOURCES.map((s) => (
        <g key={s.label}>
          <rect x="28" y={s.y} width="120" height="34" {...box} />
          <text x="88" y={s.y + 21} textAnchor="middle" fill={MUTED} fontSize="10" letterSpacing=".14em">
            {s.label}
          </text>
        </g>
      ))}

      {/* ── Fios conectores → admissão ── */}
      <path className="ops-flow" d="M148,70 C205,70 205,182 250,183" />
      <path className="ops-flow" d="M148,150 C200,150 202,187 250,188" />
      <path className="ops-flow" d="M148,230 C200,230 202,193 250,192" />
      <path className="ops-flow" d="M148,310 C205,310 205,198 250,197" />

      {/* ── Admissão ── */}
      <rect x="250" y="166" width="122" height="48" {...box} />
      <text x="311" y="186" textAnchor="middle" fill={CREAM} fontSize="11.5" letterSpacing=".16em">
        ADMISSÃO
      </text>
      <text x="311" y="202" textAnchor="middle" fill={MUTED} fontSize="8.5" letterSpacing=".14em">
        CARTEIRA DE TRABALHO
      </text>
      <path className="ops-flow" d="M372,190 L440,190" />

      {/* ── Detector (acima do núcleo) ── */}
      <rect x="470" y="16" width="240" height="32" fill={box.fill} stroke="rgba(200,155,75,.5)" rx={5} />
      <text x="590" y="36" textAnchor="middle" fill={OCHRE} fontSize="10" letterSpacing=".14em">
        DETECTOR DE VITÓRIA ILUSÓRIA
      </text>
      <line x1="560" y1="48" x2="560" y2="126" stroke="rgba(127,184,154,.18)" strokeDasharray="2 4" />
      <line x1="640" y1="48" x2="640" y2="286" stroke="rgba(127,184,154,.18)" strokeDasharray="2 4" />
      <g>
        <text x="726" y="30" fill={TERRA} fontSize="9.5" letterSpacing=".1em">
          ROI ↑ + ACURÁCIA ↓
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.55;.6;.9;1" dur="6s" repeatCount="indefinite" />
        </text>
        <circle cx="716" cy="26" r="3" fill={TERRA}>
          <animate attributeName="opacity" values="0;0;1;.2;1;0" keyTimes="0;.55;.6;.72;.9;1" dur="6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* ── Núcleo: avaliação 5 camadas ── */}
      <rect x="440" y="80" width="300" height="260" fill={box.fill} stroke="rgba(127,184,154,.55)" rx={5} />
      <text x="456" y="103" fill={CREAM} fontSize="10.5" letterSpacing=".16em">
        AVALIAÇÃO · 5 CAMADAS
      </text>
      {LAYERS.map((l) => (
        <g key={l.label}>
          <text x="456" y={l.y + 4} fill={MUTED} fontSize="9" letterSpacing=".12em">
            {l.label}
          </text>
          <line x1="545" y1={l.y} x2="724" y2={l.y} stroke="rgba(127,184,154,.18)" />
          <circle cx="724" cy={l.y} r="2.5" fill={PHOSPHOR}>
            <animate attributeName="r" values="2;3.4;2" dur={l.dur} begin={l.begin} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      {/* feixe de varredura */}
      <rect className="ops-scan" x="445" y="112" width="2.5" height="196" fill={PHOSPHOR} opacity=".55">
        <animate
          attributeName="x"
          values="445;722;445"
          dur="4.6s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines=".45 0 .55 1;.45 0 .55 1"
        />
        <animate attributeName="opacity" values=".2;.6;.2" dur="4.6s" repeatCount="indefinite" />
      </rect>

      {/* ── Saídas núcleo → vereditos ── */}
      <path className="ops-flow" d="M740,130 C800,130 820,100 900,100" />
      <path className="ops-flow" d="M740,210 C790,210 810,215 900,215" />
      <path className="ops-flow" d="M740,290 C800,290 820,330 900,330" />

      {/* ── Vereditos ── */}
      <text x="900" y="66" fill={EYEBROW} fontSize="9" letterSpacing=".22em">
        VEREDITO DO COMITÊ
      </text>
      {VERDICTS.map((v) => (
        <g key={v.label}>
          <rect x="900" y={v.y} width="192" height="44" fill={box.fill} stroke={v.stroke} rx={5} />
          <text x="922" y={v.y + 27} fill={v.color} fontSize="11.5" letterSpacing=".16em">
            {v.label}
          </text>
        </g>
      ))}

      {/* ── Jornadas completas (trilhas invisíveis dos agentes) ── */}
      <path
        id="ops-j-promote"
        d="M148,70 C205,70 205,182 250,183 L372,186 C410,186 415,130 445,130 L740,130 C800,130 820,100 900,100"
        fill="none"
      />
      <path
        id="ops-j-mentor"
        d="M148,230 C200,230 202,193 250,192 L372,190 L445,210 L740,210 C790,210 810,215 900,215"
        fill="none"
      />
      <path
        id="ops-j-retire"
        d="M148,310 C205,310 205,198 250,197 L372,194 C410,194 415,290 445,290 L740,290 C800,290 820,330 900,330"
        fill="none"
      />

      {/* ── Agentes fluindo ── */}
      <g className="ops-flow-dot">
        {DOTS.map((d, i) => (
          <circle key={i} r="3.5" fill={d.color} opacity={d.opacity ?? 1}>
            <animateMotion dur={d.dur} begin={d.begin} repeatCount="indefinite">
              <mpath href={d.path} />
            </animateMotion>
          </circle>
        ))}
      </g>
    </svg>
  );
}
