import React, { useState } from 'react';
import {
  Target, TrendingUp, DollarSign, Clock, BarChart3, Shield,
  AlertTriangle, CheckCircle2, XCircle, ArrowRight, ArrowUpRight,
  ArrowDownRight, Calendar, User, Wrench, ScrollText, Sparkles,
  Lock, Compass, Activity, Award, RefreshCw, Zap, Eye,
  ChevronRight, ChevronLeft, Circle, Code2, Briefcase, Terminal,
  LogIn, Plug, Database, Cloud, FileCode, Layers, Settings,
  Users, Search, Filter, Plus, Bell, HelpCircle, Globe,
  CheckCircle, AlertCircle, ArrowLeft, Download, Upload,
  Mail, Building2, KeyRound, Github, BookOpen, MessageSquare,
  Workflow, GitBranch, History, FileText, MoreVertical
} from 'lucide-react';

// ==================== STATE / ROUTING ====================
export default function TrincheiraApp() {
  const [route, setRoute] = useState('login'); // login | signup | onboard-welcome | onboard-connect | onboard-mapping | portfolio | agent | governance | benchmarks | cadastrar-agente | configuracoes | perfil
  const [audience, setAudience] = useState('manager');
  const [selectedAgent, setSelectedAgent] = useState('julia');
  const [onboardStep, setOnboardStep] = useState(0);
  const [cadastroStep, setCadastroStep] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  const nav = (r) => setRoute(r);

  return (
    <>
      <GlobalStyles />
      <div className="paper-bg min-h-screen font-body text-stone-900">
        {/* === ROUTING === */}
        {route === 'login' && <LoginScreen onLogin={() => { setLoggedIn(true); nav('onboard-welcome'); }} onSignup={() => nav('signup')} />}
        {route === 'signup' && <SignupScreen onSignup={() => { setLoggedIn(true); nav('onboard-welcome'); }} onBack={() => nav('login')} />}
        {route === 'onboard-welcome' && <OnboardWelcome onNext={() => nav('onboard-connect')} />}
        {route === 'onboard-connect' && <OnboardConnect onNext={() => nav('onboard-mapping')} onBack={() => nav('onboard-welcome')} />}
        {route === 'onboard-mapping' && <OnboardMapping onNext={() => nav('portfolio')} onBack={() => nav('onboard-connect')} />}

        {/* TELAS COM SHELL (NAVEGAÇÃO LATERAL) */}
        {['portfolio','agent','governance','benchmarks','cadastrar-agente','configuracoes','perfil'].includes(route) && (
          <AppShell
            route={route} nav={nav} audience={audience} setAudience={setAudience}
            selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
            cadastroStep={cadastroStep} setCadastroStep={setCadastroStep}
          />
        )}
      </div>
    </>
  );
}

// ==================== STYLES ====================
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
      .font-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
      .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      .paper-bg {
        background-color: #F4EFE3;
        background-image:
          radial-gradient(at 12% 18%, rgba(45, 95, 79, 0.04) 0px, transparent 50%),
          radial-gradient(at 88% 82%, rgba(179, 58, 42, 0.03) 0px, transparent 50%);
      }
      .paper-card {
        background: linear-gradient(180deg, #FDFAF3 0%, #FBF6EB 100%);
        box-shadow: 0 1px 0 rgba(31, 46, 40, 0.04), 0 8px 24px -12px rgba(31, 46, 40, 0.08);
      }
      .grain::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
        opacity: 0.03; pointer-events: none; mix-blend-mode: multiply;
      }
      .number-display { font-family: 'IBM Plex Mono', monospace; font-weight: 500; letter-spacing: -0.02em; }
      .divider-thin { height: 1px; background: linear-gradient(90deg, transparent, #C9BEAA 20%, #C9BEAA 80%, transparent); }
      @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      .pulse-dot { animation: pulse-soft 2.5s ease-in-out infinite; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .fade-in { animation: fade-in 0.3s ease; }
      .nav-item { transition: all 0.2s; }
      .nav-item:hover { background: rgba(45, 95, 79, 0.06); }
      .nav-item.active { background: rgba(45, 95, 79, 0.12); color: #1F2E28; }
      .nav-item.active::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; background: #2D5F4F; border-radius: 0 2px 2px 0; }
      input.cream:focus, textarea.cream:focus, select.cream:focus { outline: none; box-shadow: 0 0 0 2px rgba(45,95,79,0.2); }
    `}</style>
  );
}

// ==================== LOGIN ====================
function LoginScreen({ onLogin, onSignup }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="font-display text-5xl tracking-tight mb-2" style={{ color: '#1F2E28' }}>
            Trincheira
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-stone-500">
            AI Workforce Ops
          </div>
        </div>

        <div className="paper-card rounded-lg p-8 relative grain">
          <h1 className="font-display text-2xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-stone-600 mb-6 italic">
            Continue de onde parou na gestão da sua força de trabalho de IA.
          </p>

          <div className="space-y-4 mb-5">
            <button className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md border border-stone-300 bg-white/60 hover:bg-white transition-all text-sm font-medium">
              <Globe className="w-4 h-4" />
              Continuar com Google
            </button>
            <button className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md border border-stone-300 bg-white/60 hover:bg-white transition-all text-sm font-medium">
              <Github className="w-4 h-4" />
              Continuar com GitHub
            </button>
            <button className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md border border-stone-300 bg-white/60 hover:bg-white transition-all text-sm font-medium">
              <Building2 className="w-4 h-4" />
              SSO empresarial
            </button>
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-stone-300/60" />
            <span className="text-[10px] uppercase tracking-wider text-stone-500">ou</span>
            <div className="flex-1 h-px bg-stone-300/60" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Email corporativo</label>
              <input
                type="email"
                placeholder="renata@veridian.com.br"
                defaultValue="renata.silva@veridian.com.br"
                className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Senha</label>
              <input
                type="password"
                placeholder="••••••••••"
                defaultValue="••••••••••"
                className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm"
              />
            </div>
          </div>

          <button
            onClick={onLogin}
            className="w-full mt-6 py-2.5 rounded-md font-medium text-sm transition-all hover:opacity-90"
            style={{ background: '#1F2E28', color: '#FAF5E9' }}
          >
            Entrar
          </button>

          <div className="text-center mt-5 text-xs text-stone-500">
            Esqueceu a senha? <a className="text-[#2D5F4F] hover:underline cursor-pointer">Recuperar</a>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-stone-600">
          Primeira vez aqui? <button onClick={onSignup} className="text-[#2D5F4F] font-medium hover:underline">Criar conta</button>
        </div>

        <p className="text-center text-[11px] text-stone-500 mt-8 italic font-display max-w-sm mx-auto">
          "Quem lê só um indicador, comemora. Quem lê o sistema, intervém."
        </p>
      </div>
    </div>
  );
}

// ==================== SIGNUP ====================
function SignupScreen({ onSignup, onBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 fade-in">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1.5 mb-6">
          <ArrowLeft className="w-3 h-3" /> Voltar ao login
        </button>

        <div className="paper-card rounded-lg p-8 relative grain">
          <h1 className="font-display text-3xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>
            Criar conta na Trincheira
          </h1>
          <p className="text-sm text-stone-600 mb-6 italic">
            Comece pelo diagnóstico gratuito · 1 agente · 30 dias · sem cartão.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Nome completo</label>
              <input type="text" defaultValue="Renata Silva" className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Email corporativo</label>
              <input type="email" defaultValue="renata.silva@veridian.com.br" className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Empresa</label>
              <input type="text" defaultValue="Veridian Capital" className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Seu papel</label>
              <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="growth">
                <option value="growth">Head of Growth / Commercial</option>
                <option value="ops">COO / Head of Operations</option>
                <option value="cto">CTO / VP Engineering</option>
                <option value="ai">Lead AI Engineer</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Tamanho da empresa</label>
              <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="200">
                <option value="50">10–50</option>
                <option value="200">51–250</option>
                <option value="500">251–1.000</option>
                <option value="5000">1.001–5.000</option>
                <option value="enterprise">+5.000</option>
              </select>
            </div>
            <div className="flex items-start gap-2 pt-2">
              <input type="checkbox" defaultChecked className="mt-1" />
              <label className="text-xs text-stone-600 leading-snug">
                Aceito os <a className="text-[#2D5F4F] underline cursor-pointer">Termos</a> e <a className="text-[#2D5F4F] underline cursor-pointer">Política de Privacidade</a>. Os dados ficam no perímetro da Veridian — a Trincheira é read-only.
              </label>
            </div>
          </div>

          <button
            onClick={onSignup}
            className="w-full mt-6 py-2.5 rounded-md font-medium text-sm transition-all hover:opacity-90"
            style={{ background: '#1F2E28', color: '#FAF5E9' }}
          >
            Criar conta e começar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== ONBOARDING ====================
function OnboardWelcome({ onNext }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 fade-in">
      <div className="w-full max-w-3xl text-center">
        <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-3">Passo 1 de 3 · Boas-vindas</div>
        <h1 className="font-display text-6xl tracking-tight mb-6" style={{ color: '#1F2E28' }}>
          Olá, Renata.
        </h1>
        <p className="font-display text-2xl italic text-stone-700 mb-12 max-w-2xl mx-auto leading-snug">
          Vamos colocar a primeira agente da Veridian no painel. Você terá uma avaliação completa em até <strong className="not-italic">5 minutos</strong>.
        </p>

        <div className="grid grid-cols-3 gap-5 mb-12 text-left">
          <OnboardStep n="01" title="Conectar fonte" detail="Diga onde os agentes já estão rodando — Trincheira lê de lá, não exige mudança no código." active />
          <OnboardStep n="02" title="Mapear agentes" detail="Identificamos os agentes existentes e você confirma quem é cada um." />
          <OnboardStep n="03" title="Primeiro insight" detail="Carteira de Trabalho + 5 camadas de métricas + recomendação de rota." />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button className="text-sm text-stone-500 hover:text-stone-800">Pular para o tour guiado</button>
          <button
            onClick={onNext}
            className="px-6 py-2.5 rounded-md font-medium text-sm transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: '#2D5F4F', color: '#FAF5E9' }}
          >
            Conectar primeira fonte
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardStep({ n, title, detail, active }) {
  return (
    <div className={`paper-card rounded-lg p-5 relative grain ${active ? '' : 'opacity-60'}`}
         style={active ? { borderLeft: '3px solid #2D5F4F' } : {}}>
      <div className="font-display italic text-2xl mb-2" style={{ color: active ? '#2D5F4F' : '#9BA8A1' }}>{n}</div>
      <h3 className="font-display text-lg font-medium mb-1.5" style={{ color: '#1F2E28' }}>{title}</h3>
      <p className="text-xs text-stone-600 leading-relaxed">{detail}</p>
    </div>
  );
}

function OnboardConnect({ onNext, onBack }) {
  const [selected, setSelected] = useState('langfuse');
  const connectors = [
    { id: 'langfuse', name: 'Langfuse', tag: 'Mais comum', desc: 'Open-source, self-hostable. Cola um token e estamos prontos.', icon: '🪵', recommended: true },
    { id: 'langsmith', name: 'LangSmith', tag: 'LangChain', desc: 'Ideal para stacks LangChain / LangGraph.', icon: '⚙️' },
    { id: 'phoenix', name: 'Arize Phoenix', tag: 'OSS · MLOps', desc: 'OTel-native. Para times com base MLOps.', icon: '🔥' },
    { id: 'braintrust', name: 'Braintrust', tag: 'Eval-first', desc: 'Consumimos traces e eval scores.', icon: '🧠' },
    { id: 'otel', name: 'OTel Collector', tag: 'Universal', desc: 'Você roda framework sem plataforma de observabilidade.', icon: '📡' },
    { id: 'sdk', name: 'SDK Direto', tag: 'Avançado', desc: 'Para quem quer atribuição de negócio embutida no código.', icon: '💎' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 fade-in">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-2">Passo 2 de 3 · Conectar fonte</div>
          <h1 className="font-display text-4xl tracking-tight mb-2" style={{ color: '#1F2E28' }}>
            Onde sua agente está hoje?
          </h1>
          <p className="text-base text-stone-600 italic max-w-2xl">
            Trincheira nunca pede para você re-instrumentar — apenas plugamos onde já existe trace.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {connectors.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`paper-card rounded-lg p-4 text-left relative grain transition-all ${
                selected === c.id ? 'ring-2 ring-[#2D5F4F] ring-offset-2 ring-offset-[#F4EFE3]' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-3xl">{c.icon}</span>
                {c.recommended && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#2D5F4F', color: '#FAF5E9' }}>
                    Recomendado
                  </span>
                )}
              </div>
              <h3 className="font-display text-lg font-medium tracking-tight mb-0.5" style={{ color: '#1F2E28' }}>{c.name}</h3>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">{c.tag}</div>
              <p className="text-xs text-stone-600 leading-snug">{c.desc}</p>
            </button>
          ))}
        </div>

        {selected === 'langfuse' && (
          <div className="paper-card rounded-lg p-6 relative grain mb-6 fade-in">
            <h3 className="font-display text-xl mb-1" style={{ color: '#1F2E28' }}>Conectar Langfuse</h3>
            <p className="text-xs text-stone-500 mb-4">Cole o endpoint e a chave do projeto. Acesso read-only.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Endpoint</label>
                <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm font-mono" defaultValue="https://langfuse.veridian.com.br" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Project Public Key</label>
                <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm font-mono" defaultValue="pk-lf-9f8a3d7c-..." />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#2D5F4F]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Conexão validada · 4 agentes detectados na janela 30d
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <button
            onClick={onNext}
            className="px-6 py-2.5 rounded-md font-medium text-sm transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: '#2D5F4F', color: '#FAF5E9' }}
          >
            Identificar agentes
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardMapping({ onNext, onBack }) {
  const agents = [
    { id: 'julia', detected: 'qualify-inbound-lead', name: 'Júlia', persona: 'Pré-qualificação Inbound', confidence: 96, executions: 14230 },
    { id: 'teo', detected: 'dunning-orchestrator', name: 'Téo', persona: 'Cobrança e régua', confidence: 91, executions: 8420 },
    { id: 'sofia', detected: 'support-tier1-bot', name: 'Sofia', persona: 'Suporte N1', confidence: 88, executions: 22100 },
    { id: 'diego', detected: 'legal-triage', name: 'Diego', persona: 'Triagem Jurídica', confidence: 73, executions: 3210 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 fade-in">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 mb-2">Passo 3 de 3 · Mapeamento</div>
          <h1 className="font-display text-4xl tracking-tight mb-2" style={{ color: '#1F2E28' }}>
            Encontramos 4 agentes em produção.
          </h1>
          <p className="text-base text-stone-600 italic max-w-2xl">
            Classificamos cada um contra nossos templates de persona. Você confirma ou ajusta.
          </p>
        </div>

        <div className="paper-card rounded-lg overflow-hidden relative grain mb-6">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-stone-300/60 text-[10px] uppercase tracking-wider text-stone-500 font-medium">
            <div className="col-span-3">ID detectado</div>
            <div className="col-span-3">Persona sugerida</div>
            <div className="col-span-2">Confiança</div>
            <div className="col-span-2">Execuções (30d)</div>
            <div className="col-span-2 text-right">Nome de exibição</div>
          </div>
          {agents.map((a, i) => (
            <div key={a.id} className={`grid grid-cols-12 gap-3 px-5 py-4 items-center text-sm ${i % 2 === 0 ? 'bg-white/30' : ''} border-b border-stone-200/60 last:border-0`}>
              <div className="col-span-3 font-mono text-xs text-stone-700">{a.detected}</div>
              <div className="col-span-3">
                <select className="cream w-full px-2 py-1 rounded border border-stone-300 bg-white/60 text-xs" defaultValue={a.persona}>
                  <option>{a.persona}</option>
                  <option>Pré-qualificação Inbound</option>
                  <option>Suporte N1</option>
                  <option>Cobrança e régua</option>
                  <option>Triagem Jurídica</option>
                  <option>Outro · cadastrar</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full" style={{ width: `${a.confidence}%`, background: a.confidence > 85 ? '#2D5F4F' : '#D9B36A' }} />
                </div>
                <span className="text-xs font-mono text-stone-700">{a.confidence}%</span>
              </div>
              <div className="col-span-2 font-mono text-xs text-stone-700">{a.executions.toLocaleString('pt-BR')}</div>
              <div className="col-span-2 text-right">
                <input className="cream px-2 py-1 rounded border border-stone-300 bg-white/60 text-xs w-24 text-right" defaultValue={a.name} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <button
            onClick={onNext}
            className="px-6 py-2.5 rounded-md font-medium text-sm transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: '#2D5F4F', color: '#FAF5E9' }}
          >
            Entrar no painel
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== APP SHELL ====================
function AppShell({ route, nav, audience, setAudience, selectedAgent, setSelectedAgent, cadastroStep, setCadastroStep }) {
  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR */}
      <aside className="w-60 border-r border-stone-300/60 flex-shrink-0 flex flex-col" style={{ background: 'rgba(250, 245, 233, 0.6)' }}>
        <div className="p-5 border-b border-stone-300/60">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-xl tracking-tight" style={{ color: '#1F2E28' }}>Trincheira</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-stone-500">AI Workforce Ops</div>
        </div>

        <nav className="flex-1 py-3 px-2">
          <div className="text-[9px] uppercase tracking-wider text-stone-500 px-3 mb-1 mt-2">Workspace</div>
          <NavItem icon={Layers} label="Portfólio" active={route === 'portfolio'} onClick={() => nav('portfolio')} />
          <NavItem icon={BarChart3} label="Júlia · em alerta" active={route === 'agent'} onClick={() => { setSelectedAgent('julia'); nav('agent'); }} indent badge="alert" />
          <NavItem icon={Plus} label="Cadastrar agente" active={route === 'cadastrar-agente'} onClick={() => { setCadastroStep(0); nav('cadastrar-agente'); }} indent muted />

          <div className="text-[9px] uppercase tracking-wider text-stone-500 px-3 mb-1 mt-5">Análise</div>
          <NavItem icon={Shield} label="Governança" active={route === 'governance'} onClick={() => nav('governance')} />
          <NavItem icon={Activity} label="Benchmarks" active={route === 'benchmarks'} onClick={() => nav('benchmarks')} />

          <div className="text-[9px] uppercase tracking-wider text-stone-500 px-3 mb-1 mt-5">Conta</div>
          <NavItem icon={Settings} label="Configurações" active={route === 'configuracoes'} onClick={() => nav('configuracoes')} />
          <NavItem icon={User} label="Perfil" active={route === 'perfil'} onClick={() => nav('perfil')} />
        </nav>

        <div className="p-4 border-t border-stone-300/60">
          <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">Plano</div>
          <div className="paper-card rounded p-3 relative grain">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: '#1F2E28' }}>Trial · Crescimento</span>
              <span className="text-[10px] font-mono text-[#C5762E]">18d restantes</span>
            </div>
            <div className="h-1 bg-stone-200 rounded-full overflow-hidden mb-2">
              <div className="h-full" style={{ width: '40%', background: '#2D5F4F' }} />
            </div>
            <button className="text-[10px] text-[#2D5F4F] hover:underline">Comparar planos →</button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col">
        {/* TOP BAR */}
        <header className="border-b border-stone-300/60 sticky top-0 z-40" style={{ background: 'rgba(250, 245, 233, 0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Crumbs route={route} />
            </div>

            <div className="flex items-center gap-3">
              {/* SEARCH */}
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-stone-300/60 bg-white/40 text-xs text-stone-500 hover:bg-white/70 transition">
                <Search className="w-3.5 h-3.5" />
                Buscar agente, métrica, incidente…
                <span className="ml-3 text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200/60">⌘K</span>
              </button>

              {/* TOGGLE */}
              <div className="flex items-center gap-0 p-1 rounded-full" style={{ background: '#E8E4D8' }}>
                <button
                  onClick={() => setAudience('manager')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition ${
                    audience === 'manager' ? 'bg-[#1F2E28] text-[#FAF5E9] shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Briefcase className="w-3 h-3" />
                  <span className="font-medium">Gestor</span>
                </button>
                <button
                  onClick={() => setAudience('technical')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition ${
                    audience === 'technical' ? 'bg-[#1F2E28] text-[#FAF5E9] shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Terminal className="w-3 h-3" />
                  <span className="font-medium">Platform</span>
                </button>
              </div>

              <button className="relative p-1.5 hover:bg-stone-200/50 rounded">
                <Bell className="w-4 h-4 text-stone-600" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#B33A2A]" />
              </button>
              <button className="p-1.5 hover:bg-stone-200/50 rounded">
                <HelpCircle className="w-4 h-4 text-stone-600" />
              </button>

              <button onClick={() => nav('perfil')} className="w-7 h-7 rounded-full bg-[#2D5F4F] text-white flex items-center justify-center text-[10px] font-medium hover:opacity-90 transition">
                RS
              </button>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 fade-in" key={route}>
          {route === 'portfolio' && <PortfolioView audience={audience} nav={nav} setSelectedAgent={setSelectedAgent} />}
          {route === 'agent' && <AgentView audience={audience} />}
          {route === 'governance' && <GovernanceView audience={audience} />}
          {route === 'benchmarks' && <BenchmarksView audience={audience} />}
          {route === 'cadastrar-agente' && <CadastroAgenteView step={cadastroStep} setStep={setCadastroStep} nav={nav} />}
          {route === 'configuracoes' && <ConfiguracoesView />}
          {route === 'perfil' && <PerfilView />}
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, indent, badge, muted }) {
  return (
    <button onClick={onClick} className={`nav-item w-full flex items-center gap-2.5 ${indent ? 'pl-8' : 'px-3'} py-2 rounded text-sm relative ${active ? 'active' : muted ? 'text-stone-500' : 'text-stone-700'}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1 text-left text-[13px]">{label}</span>
      {badge === 'alert' && <span className="w-1.5 h-1.5 rounded-full bg-[#C5762E] pulse-dot" />}
    </button>
  );
}

function Crumbs({ route }) {
  const map = {
    portfolio: ['Portfólio'],
    agent: ['Portfólio', 'Comercial', 'Júlia · Pré-qualificação'],
    governance: ['Análise', 'Governança'],
    benchmarks: ['Análise', 'Benchmarks setoriais'],
    'cadastrar-agente': ['Portfólio', 'Cadastrar agente'],
    configuracoes: ['Conta', 'Configurações'],
    perfil: ['Conta', 'Perfil'],
  };
  const crumbs = map[route] || [];
  return (
    <>
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          <span className={i === crumbs.length - 1 ? 'text-stone-800 font-medium' : ''}>{c}</span>
          {i < crumbs.length - 1 && <ChevronRight className="w-3 h-3" />}
        </React.Fragment>
      ))}
    </>
  );
}

// ==================== PORTFOLIO ====================
function PortfolioView({ audience, nav, setSelectedAgent }) {
  const agents = [
    { id: 'julia', name: 'Júlia', role: 'Pré-qualificação Inbound', owner: 'Renata Silva', status: 'alerta', acuracia: 72, roi: '12x', cpe: 0.18, volume: 14230, deltaROI: '+1x', alert: true },
    { id: 'teo', name: 'Téo', role: 'Cobrança e régua', owner: 'Felipe Costa', status: 'ativo', acuracia: 91, roi: '8x', cpe: 0.22, volume: 8420, deltaROI: '+0.5x' },
    { id: 'sofia', name: 'Sofia', role: 'Suporte N1', owner: 'Patrícia Lima', status: 'ativo', acuracia: 86, roi: '14x', cpe: 0.09, volume: 22100, deltaROI: '+2x' },
    { id: 'diego', name: 'Diego', role: 'Triagem Jurídica', owner: 'André Mendes', status: 'probation', acuracia: 79, roi: '—', cpe: 0.41, volume: 3210, deltaROI: '—' },
    { id: 'maia', name: 'Maia', role: 'Onboarding RH', owner: 'Ana Reis', status: 'ativo', acuracia: 93, roi: '6x', cpe: 0.14, volume: 1820, deltaROI: '+0.2x' },
    { id: 'vega', name: 'Vega', role: 'KYC Documentos', owner: 'Bruno Carvalho', status: 'recalibracao', acuracia: 81, roi: '4x', cpe: 0.32, volume: 6710, deltaROI: '-0.8x' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>Portfólio</h1>
          <p className="text-sm text-stone-600 italic">6 agentes em produção · 2 precisam de atenção · 1 em onboarding</p>
        </div>
        <button onClick={() => nav('cadastrar-agente')} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition" style={{ background: '#2D5F4F', color: '#FAF5E9' }}>
          <Plus className="w-4 h-4" />
          Cadastrar agente
        </button>
      </div>

      {/* RESUMO */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Agentes ativos" value="6" delta="+2 MoM" deltaPositive icon={Layers} />
        <SummaryCard label={audience === 'manager' ? 'ROI consolidado' : 'Aggregate ROI'} value="10,2x" delta="+0.8x" deltaPositive icon={Award} />
        <SummaryCard label={audience === 'manager' ? 'Custo total mensal' : 'Monthly TCO'} value="R$ 38,4k" delta="-12%" deltaPositive icon={DollarSign} />
        <SummaryCard label="Incidentes abertos" value="3" delta="2 críticos" icon={AlertTriangle} alert />
      </div>

      {/* FILTROS */}
      <div className="flex items-center gap-3 mb-4">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-300/60 bg-white/40 text-xs text-stone-700 hover:bg-white">
          <Filter className="w-3 h-3" />
          Filtros
        </button>
        {['Todos · 6', 'Em alerta · 1', 'Em recalibração · 1', 'Probation · 1', 'Ativos · 3'].map((f, i) => (
          <button key={i} className={`px-3 py-1.5 rounded-md text-xs ${i === 0 ? 'bg-[#1F2E28] text-[#FAF5E9]' : 'border border-stone-300/60 bg-white/40 text-stone-700 hover:bg-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* TABELA */}
      <div className="paper-card rounded-lg overflow-hidden relative grain">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-stone-300/60 text-[10px] uppercase tracking-wider text-stone-500 font-medium">
          <div className="col-span-3">Agente · Papel</div>
          <div className="col-span-2">Dono de negócio</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">{audience === 'manager' ? 'Acurácia' : 'Groundedness'}</div>
          <div className="col-span-1">CPE</div>
          <div className="col-span-2">{audience === 'manager' ? 'Volume mês' : 'Volume (30d)'}</div>
          <div className="col-span-1">ROI</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>

        {agents.map((a, i) => (
          <button
            key={a.id}
            onClick={() => { setSelectedAgent(a.id); if (a.id === 'julia') nav('agent'); }}
            className={`grid grid-cols-12 gap-3 px-5 py-4 items-center text-sm w-full text-left ${i % 2 === 0 ? 'bg-white/30' : ''} border-b border-stone-200/60 last:border-0 hover:bg-[#FBF6EB]/80 transition`}
          >
            <div className="col-span-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-display text-base text-[#FAF5E9] flex-shrink-0" style={{ background: getAgentColor(a.id) }}>
                  {a.name[0]}
                </div>
                <div>
                  <div className="font-medium text-stone-900">{a.name}</div>
                  <div className="text-xs text-stone-500">{a.role}</div>
                </div>
              </div>
            </div>
            <div className="col-span-2 text-xs text-stone-700">{a.owner}</div>
            <div className="col-span-1">
              <StatusPill status={a.status} />
            </div>
            <div className="col-span-1 font-mono text-sm">
              <span className={a.acuracia < 80 ? 'text-[#B33A2A] font-semibold' : 'text-stone-800'}>{a.acuracia}%</span>
            </div>
            <div className="col-span-1 font-mono text-sm text-stone-800">R$ {a.cpe.toFixed(2)}</div>
            <div className="col-span-2 font-mono text-sm text-stone-800">{a.volume.toLocaleString('pt-BR')}</div>
            <div className="col-span-1 font-mono text-sm">
              <span className="text-stone-900">{a.roi}</span>
              {a.deltaROI !== '—' && <span className={`ml-1 text-[10px] ${a.deltaROI.startsWith('+') ? 'text-[#2D5F4F]' : 'text-[#B33A2A]'}`}>{a.deltaROI}</span>}
            </div>
            <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
              {a.alert && <AlertTriangle className="w-3.5 h-3.5 text-[#C5762E]" />}
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getAgentColor(id) {
  const map = { julia: 'linear-gradient(135deg, #2D5F4F 0%, #1F2E28 100%)', teo: 'linear-gradient(135deg, #C5762E 0%, #8B4F1F 100%)', sofia: 'linear-gradient(135deg, #4A7BAB 0%, #2C5378 100%)', diego: 'linear-gradient(135deg, #8B6F47 0%, #5C4730 100%)', maia: 'linear-gradient(135deg, #7B5E8C 0%, #4E3A60 100%)', vega: 'linear-gradient(135deg, #B33A2A 0%, #7A2418 100%)' };
  return map[id] || '#1F2E28';
}

function SummaryCard({ label, value, delta, deltaPositive, icon: Icon, alert }) {
  return (
    <div className="paper-card rounded-lg p-5 relative grain">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-4 h-4 ${alert ? 'text-[#B33A2A]' : 'text-[#2D5F4F]'}`} />
      </div>
      <div className="font-display text-3xl mb-1" style={{ color: '#1F2E28' }}>{value}</div>
      <div className="text-xs text-stone-600">{label}</div>
      <div className={`text-[10px] font-mono mt-1 ${alert ? 'text-[#B33A2A]' : deltaPositive ? 'text-[#2D5F4F]' : 'text-[#B33A2A]'}`}>{delta}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    alerta: { label: 'Em alerta', bg: '#C5762E', color: '#FAF5E9' },
    ativo: { label: 'Ativo', bg: '#9BBFAE', color: '#1F2E28' },
    probation: { label: 'Probation', bg: '#D9B36A', color: '#1F2E28' },
    recalibracao: { label: 'Recalibrando', bg: '#9BA8A1', color: '#1F2E28' },
  };
  const s = map[status];
  return (
    <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: s.bg, color: s.color }}>
      {status === 'alerta' && <span className="w-1 h-1 rounded-full bg-current pulse-dot" />}
      {s.label}
    </span>
  );
}

// ==================== AGENT VIEW (resumido — reaproveita lógica do dual) ====================
function AgentView({ audience }) {
  const t = audience === 'manager' ? {
    section01Title: 'Carteira de Trabalho',
    section01Caption: 'Identidade, papel e cadeia de responsabilidade da agente',
    decisionTitle: 'Mentoria',
    recommended: 'Decisão recomendada',
  } : {
    section01Title: 'Agent Registry Record',
    section01Caption: 'ID, ownership chain, autonomy boundaries',
    decisionTitle: 'Recalibrate',
    recommended: 'Recommended route',
  };

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      {/* HERO */}
      <section className="mb-10">
        <div className="flex items-baseline gap-5 mb-5">
          <span className="font-display italic text-2xl text-stone-400">01</span>
          <div>
            <h2 className="font-display text-2xl tracking-tight" style={{ color: '#1F2E28' }}>{t.section01Title}</h2>
            <p className="text-xs text-stone-500 mt-0.5">{t.section01Caption}</p>
          </div>
        </div>

        <div className="paper-card rounded-lg relative grain overflow-hidden">
          <div className="p-8 pb-6 grid grid-cols-12 gap-8 items-start border-b border-stone-300/60">
            <div className="col-span-2 flex flex-col items-start">
              <div className="w-20 h-20 rounded-full flex items-center justify-center font-display text-4xl text-[#FAF5E9] mb-3" style={{ background: 'linear-gradient(135deg, #2D5F4F 0%, #1F2E28 100%)' }}>
                {audience === 'manager' ? 'J' : <Code2 className="w-8 h-8" />}
              </div>
              <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full" style={{ background: '#C5762E', color: '#FDFAF3' }}>
                {audience === 'manager' ? 'Em alerta' : 'Degraded'}
              </span>
            </div>
            <div className="col-span-10">
              <div className="flex items-baseline gap-3 mb-1">
                <h1 className="font-display text-5xl tracking-tight" style={{ color: '#1F2E28' }}>
                  {audience === 'manager' ? 'Júlia' : 'AGT-COM-007'}
                </h1>
                <span className="text-stone-500 text-sm font-mono">AGT-COM-007 · v3.2</span>
              </div>
              <p className="font-display italic text-xl text-stone-700 mb-5 leading-snug max-w-3xl">
                {audience === 'manager' ? '"Qualifico leads inbound em até 90 segundos."' : 'Inbound lead qualification. Target SLA: 90s.'}
              </p>
              <div className="flex items-center gap-6 text-xs text-stone-500">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Em produção desde 14/jun</span>
                <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> v3.2 · há 9 dias</span>
                <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> 14.230 exec./mês</span>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="border-b border-stone-300/60 px-8 flex gap-6 text-xs">
            {['Visão geral', 'Métricas', 'Versões', 'Incidentes', 'Auditoria'].map((tab, i) => (
              <button key={i} className={`py-3 ${i === 0 ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-500 hover:text-stone-800'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* QUICK STATS */}
          <div className="grid grid-cols-5 divide-x divide-stone-300/60">
            <QuickStat label={audience === 'manager' ? 'Acurácia' : 'Groundedness'} value="72%" delta="-16pp" alert />
            <QuickStat label="CPE" value="R$ 0,18" delta="dentro da meta" />
            <QuickStat label="ROI" value="12x" delta="+1x" positive />
            <QuickStat label={audience === 'manager' ? 'Cliente volta em 72h' : 'Repeat (72h)'} value="24%" delta="+11pp" alert />
            <QuickStat label={audience === 'manager' ? 'Time corrige' : 'Override'} value="14%" delta="+6pp" alert />
          </div>
        </div>
      </section>

      {/* DETECTOR HIGHLIGHT */}
      <section className="mb-10">
        <div className="paper-card rounded-lg p-6 relative grain" style={{ borderLeft: '4px solid #B33A2A' }}>
          <div className="flex items-start gap-4">
            <Eye className="w-6 h-6 text-[#B33A2A] flex-shrink-0 mt-1" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-xl tracking-tight" style={{ color: '#1F2E28' }}>
                  {audience === 'manager' ? 'Vitória ilusória detectada' : 'Illusory victory detected'}
                </h3>
                <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full" style={{ background: '#B33A2A', color: '#FAF5E9' }}>
                  Crítica
                </span>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed mb-3">
                {audience === 'manager'
                  ? 'O ROI subiu de 11x para 12x, mas a acurácia caiu de 88% para 72% e clientes voltando dobrou. A Júlia está fechando casos sem resolver — o ganho de eficiência está sendo financiado por queda em qualidade.'
                  : 'ROI rose 11x → 12x while groundedness dropped 88% → 72% and repeat contact doubled. Agent is closing sessions without resolving — efficiency gain financed by quality loss.'}
              </p>
              <div className="flex items-center gap-3">
                <button className="text-xs px-3 py-1.5 rounded-md font-medium" style={{ background: '#1F2E28', color: '#FAF5E9' }}>
                  Ver análise completa
                </button>
                <button className="text-xs text-stone-600 hover:text-stone-900">Auditar 50 conversas</button>
                <button className="text-xs text-stone-600 hover:text-stone-900">Dispensar alerta</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECOMENDAÇÃO COMPACTA */}
      <section className="mb-10">
        <div className="paper-card rounded-lg p-6 relative grain">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3 border-r border-stone-300/60 pr-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2">{t.recommended}</div>
              <div className="font-display text-4xl tracking-tight mb-3" style={{ color: '#C5762E' }}>{t.decisionTitle}</div>
              <div className="text-xs text-stone-600 space-y-1">
                <div>Confiança · <span className="font-mono">87%</span></div>
                <div>Janela · <span className="font-mono">14 dias</span></div>
              </div>
            </div>
            <div className="col-span-9">
              <p className="text-sm text-stone-700 leading-relaxed mb-4">
                {audience === 'manager'
                  ? 'Recalibrar antes de qualquer decisão de aposentar. A Júlia tem 4 meses de aprendizado capturado e payback já entregue (47 dias vs. meta de 90). A falha aparenta ser reversível pelo padrão de drift detectado após a mudança de 14/set.'
                  : 'Recalibrate before decommissioning. 4 months of captured learning and payback already delivered. Drift signature suggests reversible failure post 14/Sep model swap.'}
              </p>
              <div className="flex items-center gap-3">
                <button className="text-sm px-4 py-2 rounded-md font-medium" style={{ background: '#2D5F4F', color: '#FAF5E9' }}>
                  Aprovar plano de recalibração
                </button>
                <button className="text-sm px-4 py-2 rounded-md font-medium border border-stone-300 bg-white/60 hover:bg-white">
                  Discordar do sistema
                </button>
                <button className="text-sm text-stone-600 hover:text-stone-900">Exportar para comitê</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-stone-500 italic">
        Vista completa do agente Júlia · 5 seções, 23 métricas, 9 detectores ativos
      </p>
    </div>
  );
}

function QuickStat({ label, value, delta, alert, positive }) {
  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{label}</div>
      <div className="number-display text-2xl mb-1 text-stone-900">{value}</div>
      <div className={`text-[10px] font-mono ${alert ? 'text-[#B33A2A]' : positive ? 'text-[#2D5F4F]' : 'text-stone-500'}`}>{delta}</div>
    </div>
  );
}

// ==================== GOVERNANCE ====================
function GovernanceView({ audience }) {
  const incidents = [
    { time: 'há 2h', severity: 'critical', agent: 'Júlia', event: audience === 'manager' ? 'Vitória ilusória detectada · acurácia ↓ + ROI ↑' : 'Illusory victory · groundedness ↓ + ROI ↑', state: 'aberto' },
    { time: 'há 5h', severity: 'high', agent: 'Vega', event: audience === 'manager' ? 'Tentativa de ação fora de escopo (bloqueada)' : 'Out-of-scope action attempt (blocked)', state: 'acknowledged' },
    { time: 'há 1d', severity: 'high', agent: 'Diego', event: audience === 'manager' ? 'Drift comportamental 2.1σ acima do baseline' : 'Behavioral drift 2.1σ above baseline', state: 'em análise' },
    { time: 'há 2d', severity: 'medium', agent: 'Sofia', event: audience === 'manager' ? 'Override rate subiu 4pp em 7 dias' : 'Override rate +4pp in 7d', state: 'resolvido' },
    { time: 'há 4d', severity: 'critical', agent: 'Vega', event: audience === 'manager' ? 'Política violada · escalonamento manual disparado' : 'Policy violation · manual escalation triggered', state: 'resolvido' },
    { time: 'há 6d', severity: 'medium', agent: 'Júlia', event: audience === 'manager' ? 'Latência P95 fora da meta por 4 horas' : 'P95 latency SLO breach for 4h', state: 'resolvido' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>Governança</h1>
          <p className="text-sm text-stone-600 italic">Audit trail, comitê de IA e conformidade · EU AI Act ready</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-300 bg-white/60 text-xs hover:bg-white">
            <Download className="w-3 h-3" /> Exportar relatório
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#1F2E28', color: '#FAF5E9' }}>
            <FileText className="w-3 h-3" /> Preparar para comitê
          </button>
        </div>
      </div>

      {/* KPIs DE GOVERNANÇA */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Incidentes abertos" value="3" delta="2 críticos" alert icon={AlertTriangle} />
        <SummaryCard label="MTTD médio" value="3,2 h" delta="-1,4h MoM" deltaPositive icon={Clock} />
        <SummaryCard label="Audit trail" value="99,8%" delta="hash-chain íntegro" deltaPositive icon={Lock} />
        <SummaryCard label="Cobertura de guardrails" value="92%" delta="critical: 100%" deltaPositive icon={Shield} />
      </div>

      <div className="grid grid-cols-12 gap-5 mb-8">
        {/* TIMELINE DE INCIDENTES */}
        <div className="col-span-8 paper-card rounded-lg p-6 relative grain">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-xl tracking-tight" style={{ color: '#1F2E28' }}>Timeline de incidentes · últimos 7 dias</h3>
            <button className="text-xs text-stone-500 hover:text-stone-800">Ver tudo →</button>
          </div>

          <div className="space-y-3">
            {incidents.map((i, idx) => (
              <div key={idx} className="flex items-start gap-3 pb-3 border-b border-stone-200/60 last:border-0">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: i.severity === 'critical' ? '#B33A2A' : i.severity === 'high' ? '#C5762E' : '#D9B36A' }} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-medium text-sm text-stone-900">{i.agent}</span>
                    <span className="text-[10px] text-stone-500 font-mono">{i.time}</span>
                    <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      i.state === 'aberto' ? 'bg-[#FBE5DE] text-[#B33A2A]' :
                      i.state === 'resolvido' ? 'bg-[#E5EEE8] text-[#2D5F4F]' :
                      'bg-stone-200 text-stone-700'
                    }`}>
                      {i.state}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-snug">{i.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COMITÊ DE IA */}
        <div className="col-span-4 paper-card rounded-lg p-6 relative grain">
          <h3 className="font-display text-xl tracking-tight mb-4" style={{ color: '#1F2E28' }}>Comitê de IA</h3>

          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">Próxima reunião</div>
          <div className="mb-4">
            <div className="font-display text-2xl" style={{ color: '#1F2E28' }}>23 de outubro</div>
            <div className="text-xs text-stone-600">Comitê trimestral · revisão de portfólio</div>
          </div>

          <div className="divider-thin mb-4" />

          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">Pauta sugerida pelo sistema</div>
          <div className="space-y-2 mb-5 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-stone-400 mt-1">·</span>
              <span className="text-stone-700">Decisão Júlia: aprovar plano de recalibração</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-stone-400 mt-1">·</span>
              <span className="text-stone-700">Diego sai de probation: promover ou estender?</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-stone-400 mt-1">·</span>
              <span className="text-stone-700">Vega: ROI -0.8x — descontinuar ou refatorar?</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-stone-400 mt-1">·</span>
              <span className="text-stone-700">Sofia: aprovar promoção para suporte N2?</span>
            </div>
          </div>

          <button className="w-full py-2 rounded-md text-sm font-medium border border-stone-300 bg-white/60 hover:bg-white">
            Abrir agenda completa
          </button>
        </div>
      </div>

      {/* COMPLIANCE */}
      <div className="paper-card rounded-lg p-6 relative grain">
        <h3 className="font-display text-xl tracking-tight mb-5" style={{ color: '#1F2E28' }}>Compliance · ativação em curso</h3>

        <div className="grid grid-cols-3 gap-4">
          <ComplianceItem name="LGPD" status="ready" detail="Trilha de auditoria + DPO designado + DPIA por agente" />
          <ComplianceItem name="EU AI Act · Art. 9 (risk mgmt)" status="ready" detail="Risk register conectado a cobertura de guardrails" />
          <ComplianceItem name="EU AI Act · Art. 12 (logs)" status="ready" detail="Append-only com hash chain SHA-256 · 6 meses retenção" />
          <ComplianceItem name="SOC 2 Type II" status="progress" detail="Em fase final · auditoria conclui em 4 semanas" />
          <ComplianceItem name="ISO/IEC 42001" status="pending" detail="Roadmap 2027 · gap analysis agendado" />
          <ComplianceItem name="NIST AI RMF" status="ready" detail="Mapeamento de controles concluído · Govern/Map/Measure/Manage" />
        </div>
      </div>
    </div>
  );
}

function ComplianceItem({ name, status, detail }) {
  const cfg = {
    ready: { icon: CheckCircle2, color: '#2D5F4F', label: 'OK' },
    progress: { icon: RefreshCw, color: '#C5762E', label: 'Em curso' },
    pending: { icon: Circle, color: '#9BA8A1', label: 'Pendente' },
  }[status];
  const Icon = cfg.icon;

  return (
    <div className="bg-white/40 rounded p-4 border border-stone-200">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.color, color: '#FAF5E9' }}>
          {cfg.label}
        </span>
      </div>
      <div className="font-medium text-sm text-stone-900 mb-1">{name}</div>
      <div className="text-xs text-stone-600 leading-snug">{detail}</div>
    </div>
  );
}

// ==================== BENCHMARKS ====================
function BenchmarksView({ audience }) {
  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>Benchmarks setoriais</h1>
        <p className="text-sm text-stone-600 italic">Compare seus agentes contra a mediana de empresas similares · dados anonimizados</p>
      </div>

      <div className="paper-card rounded-lg p-5 relative grain mb-6 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">Filtros ativos</div>
          <div className="text-sm">
            <strong className="text-stone-900">Vertical:</strong> Serviços financeiros B2B <span className="text-stone-400 mx-2">·</span>
            <strong className="text-stone-900">Porte:</strong> 251–1.000 colaboradores <span className="text-stone-400 mx-2">·</span>
            <strong className="text-stone-900">Persona:</strong> Pré-qualificação Inbound
          </div>
        </div>
        <button className="text-xs px-3 py-1.5 rounded-md border border-stone-300 bg-white/60 hover:bg-white">Editar filtros</button>
      </div>

      <div className="paper-card rounded-lg p-6 relative grain mb-6">
        <h3 className="font-display text-xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>
          {audience === 'manager' ? 'Sua Júlia vs. mediana setorial' : 'Your AGT-COM-007 vs. industry median'}
        </h3>
        <p className="text-xs text-stone-500 mb-5">Baseado em 47 agentes similares · janela de 90 dias</p>

        <div className="space-y-4">
          <BenchmarkBar metric={audience === 'manager' ? 'Acurácia' : 'Groundedness'} yours={72} median={84} top={94} unit="%" yoursAlert />
          <BenchmarkBar metric="CPE" yours={0.18} median={0.22} top={0.12} unit="R$" reverse />
          <BenchmarkBar metric={audience === 'manager' ? 'Cliente volta em 72h' : 'Repeat (72h)'} yours={24} median={16} top={9} unit="%" yoursAlert reverse />
          <BenchmarkBar metric={audience === 'manager' ? 'Tempo de resposta' : 'P95 latency'} yours={1.2} median={1.9} top={1.0} unit="s" reverse />
          <BenchmarkBar metric="ROI" yours={12} median={7} top={18} unit="x" />
          <BenchmarkBar metric={audience === 'manager' ? 'Time corrige' : 'Override'} yours={14} median={9} top={4} unit="%" yoursAlert reverse />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="paper-card rounded-lg p-6 relative grain">
          <h3 className="font-display text-lg tracking-tight mb-3" style={{ color: '#1F2E28' }}>Onde a Júlia está acima</h3>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-start gap-2"><ArrowUpRight className="w-4 h-4 text-[#2D5F4F] mt-0.5" /><span>ROI 71% acima da mediana (12x vs. 7x)</span></li>
            <li className="flex items-start gap-2"><ArrowUpRight className="w-4 h-4 text-[#2D5F4F] mt-0.5" /><span>Custo por execução 18% abaixo da mediana</span></li>
            <li className="flex items-start gap-2"><ArrowUpRight className="w-4 h-4 text-[#2D5F4F] mt-0.5" /><span>Latência 37% abaixo da mediana</span></li>
          </ul>
        </div>
        <div className="paper-card rounded-lg p-6 relative grain">
          <h3 className="font-display text-lg tracking-tight mb-3" style={{ color: '#1F2E28' }}>Onde a Júlia está abaixo</h3>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-start gap-2"><ArrowDownRight className="w-4 h-4 text-[#B33A2A] mt-0.5" /><span>{audience === 'manager' ? 'Acurácia 12pp abaixo da mediana' : 'Groundedness 12pp below median'}</span></li>
            <li className="flex items-start gap-2"><ArrowDownRight className="w-4 h-4 text-[#B33A2A] mt-0.5" /><span>{audience === 'manager' ? 'Clientes voltando 50% mais que a mediana' : 'Repeat contact 50% above median'}</span></li>
            <li className="flex items-start gap-2"><ArrowDownRight className="w-4 h-4 text-[#B33A2A] mt-0.5" /><span>{audience === 'manager' ? 'Time corrige 55% mais que a mediana' : 'Override rate 55% above median'}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function BenchmarkBar({ metric, yours, median, top, unit, yoursAlert, reverse }) {
  const max = Math.max(yours, median, top) * 1.15;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-stone-800">{metric}</span>
        <div className="flex items-baseline gap-4 text-xs">
          <span className={`font-mono font-medium ${yoursAlert ? 'text-[#B33A2A]' : 'text-[#2D5F4F]'}`}>
            Você: {unit === 'R$' ? `R$ ${yours.toFixed(2)}` : `${yours}${unit}`}
          </span>
          <span className="text-stone-500">Mediana: {unit === 'R$' ? `R$ ${median.toFixed(2)}` : `${median}${unit}`}</span>
          <span className="text-stone-500">Top 10%: {unit === 'R$' ? `R$ ${top.toFixed(2)}` : `${top}${unit}`}</span>
        </div>
      </div>
      <div className="relative h-6 bg-stone-200/50 rounded overflow-hidden">
        <div className="absolute top-0 bottom-0" style={{ left: `${(median / max) * 100}%`, width: '1px', background: '#1F2E28' }} />
        <div className="absolute top-0 bottom-0" style={{ left: `${(top / max) * 100}%`, width: '1px', background: '#2D5F4F' }} />
        <div className="absolute top-1 bottom-1 rounded" style={{ width: `${(yours / max) * 100}%`, background: yoursAlert ? '#B33A2A' : '#2D5F4F', opacity: 0.7 }} />
      </div>
    </div>
  );
}

// ==================== CADASTRAR AGENTE (WIZARD) ====================
function CadastroAgenteView({ step, setStep, nav }) {
  const steps = ['Identidade', 'Job Description', 'Responsabilidade', 'Autonomia', 'Origem', 'Conectar', 'Probation'];

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <button onClick={() => nav('portfolio')} className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1.5 mb-4">
        <ArrowLeft className="w-3 h-3" /> Voltar ao portfólio
      </button>

      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>Cadastrar nova agente</h1>
        <p className="text-sm text-stone-600 italic">A Carteira de Trabalho começa antes do agente existir. Cada campo evita uma falha futura.</p>
      </div>

      {/* STEPPER */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                step === i ? 'bg-[#1F2E28] text-[#FAF5E9]' : step > i ? 'text-[#2D5F4F]' : 'text-stone-400'
              }`}
            >
              {step > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="font-mono">{(i+1).toString().padStart(2, '0')}</span>}
              {s}
            </button>
            {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-stone-300" />}
          </React.Fragment>
        ))}
      </div>

      <div className="paper-card rounded-lg p-8 relative grain">
        {step === 0 && <CadastroIdentidade />}
        {step === 1 && <CadastroJD />}
        {step === 2 && <CadastroResp />}
        {step === 3 && <CadastroAutonomia />}
        {step === 4 && <CadastroOrigem />}
        {step === 5 && <CadastroConectar />}
        {step === 6 && <CadastroProbation />}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-300/60">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="text-sm text-stone-500 hover:text-stone-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            <ArrowLeft className="w-3 h-3" /> Anterior
          </button>
          <div className="text-xs text-stone-500">Passo {step + 1} de {steps.length}</div>
          <button
            onClick={() => step < steps.length - 1 ? setStep(step + 1) : nav('portfolio')}
            className="px-5 py-2 rounded-md font-medium text-sm transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: '#2D5F4F', color: '#FAF5E9' }}
          >
            {step < steps.length - 1 ? 'Próximo' : 'Cadastrar agente'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CadastroIdentidade() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Identidade</h2>
      <p className="text-sm text-stone-600 italic mb-6">Como o time vai chamar essa agente no dia a dia?</p>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Nome humano</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" placeholder="Ex: Júlia" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Tagline (uma frase)</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" placeholder="Ex: Qualifico leads inbound em até 90 segundos" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Template de persona</label>
            <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm">
              <option>Pré-qualificação Inbound</option>
              <option>Suporte N1</option>
              <option>Cobrança e régua</option>
              <option>Triagem (Ops / Jurídico / TI)</option>
              <option>Análise documental</option>
              <option>Onboarding interno</option>
              <option>Custom (do zero)</option>
            </select>
            <div className="text-[11px] text-[#2D5F4F] mt-1.5">✓ Vai pré-popular metas, severidades e fronteiras tipicamente dessa persona</div>
          </div>
        </div>

        <div className="paper-card rounded p-4 relative grain" style={{ background: '#FBF6EB' }}>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">Preview da Carteira</div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-2xl text-[#FAF5E9]" style={{ background: 'linear-gradient(135deg, #2D5F4F 0%, #1F2E28 100%)' }}>?</div>
            <div>
              <div className="font-display text-xl text-stone-900">Sem nome ainda</div>
              <div className="text-xs text-stone-500 font-mono">AGT-???-???</div>
            </div>
          </div>
          <p className="text-xs italic text-stone-600">"Tagline aparece aqui em itálico, como assinatura da agente."</p>
        </div>
      </div>
    </div>
  );
}

function CadastroJD() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Job Description</h2>
      <p className="text-sm text-stone-600 italic mb-6">O escopo de trabalho. Tão importante o que faz quanto o que não faz.</p>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2D5F4F]" />
            Deve fazer
          </label>
          <textarea
            className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-32"
            placeholder="Uma tarefa por linha. Ex:&#10;- Coletar BANT do lead&#10;- Agendar reunião com SDR&#10;- Atualizar CRM"
            defaultValue={`- Coletar BANT do lead\n- Agendar reunião com SDR\n- Atualizar CRM em tempo real`}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 text-[#B33A2A]" />
            Não deve fazer
          </label>
          <textarea
            className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-32"
            placeholder="Limites explícitos. Ex:&#10;- Cotar preço&#10;- Discutir contratos"
            defaultValue={`- Cotar preço\n- Discutir contratos`}
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block">Critério de "bom trabalho"</label>
        <textarea
          className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-20"
          placeholder="O que define que essa agente fez bem o trabalho? Esta é a rubrica de avaliação."
          defaultValue="Lead foi qualificado (BANT completo OU descartado com razão), reunião foi marcada quando aplicável, CRM atualizado, tempo total < 90s, nenhuma informação inventada."
        />
      </div>
    </div>
  );
}

function CadastroResp() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Cadeia de responsabilidade</h2>
      <p className="text-sm text-stone-600 italic mb-6">Sem 3 nomes preenchidos, a agente não pode ir para produção. Resolve a tensão de propriedade na raiz.</p>

      <div className="space-y-5">
        <RespRow label="Dono de negócio" sublabel="Responde por ROI · geralmente Head de área" defaultValue="Renata Silva · Head of Growth" hint="Tipicamente C-level ou diretor da função impactada" />
        <RespRow label="Dono técnico" sublabel="Responde por uptime, SLO, refinement" defaultValue="Marcos Tavares · Lead AI Eng" hint="Geralmente Eng Lead ou Staff" />
        <RespRow label="Stakeholder de governança" sublabel="Audita decisões críticas · responde por compliance" defaultValue="Comitê de IA · ai-governance@" hint="Time, comitê ou indivíduo com mandato" />
        <RespRow label="Aprovador de mudanças" sublabel="Quem assina mudanças significativas de prompt/modelo" defaultValue="Marcos Tavares + Renata Silva" hint="Pode ser 1 pessoa ou aprovação dupla" />
      </div>
    </div>
  );
}

function RespRow({ label, sublabel, defaultValue, hint }) {
  return (
    <div className="grid grid-cols-12 gap-4 items-start py-3 border-b border-stone-200/60 last:border-0">
      <div className="col-span-4">
        <div className="text-sm font-medium text-stone-900">{label}</div>
        <div className="text-xs text-stone-500 italic mt-0.5">{sublabel}</div>
      </div>
      <div className="col-span-8">
        <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue={defaultValue} />
        <div className="text-[10px] text-stone-500 mt-1">{hint}</div>
      </div>
    </div>
  );
}

function CadastroAutonomia() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Autonomia e fronteiras</h2>
      <p className="text-sm text-stone-600 italic mb-6">Defina até onde a agente decide sozinha. Sem fronteira clara, não há como dar autonomia.</p>

      <div className="space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block">Decide sozinha (sem humano)</label>
          <textarea className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-20" defaultValue="Qualificação BANT, scheduling, criação de oportunidade até R$ 50k de ARR projetado" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block">Escala para humano (gatilhos explícitos)</label>
          <textarea className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-20" defaultValue="Lead com ARR > R$ 50k, lead enterprise, pedido de demo técnica, qualquer menção a SLA contratual" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block">Proibido (mesmo se souber fazer)</label>
          <textarea className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-20" defaultValue="Cotar preços específicos · Discutir contratos · Citar concorrentes · Prometer prazos" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Máx. follow-ups</label>
            <input type="number" className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="3" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Custo teto / exec.</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="R$ 0,40" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Ferramentas autorizadas</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="7 ferramentas" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CadastroOrigem() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Por que essa agente existe</h2>
      <p className="text-sm text-stone-600 italic mb-6">Sem baseline registrada, ROI é ficção. Este é o passo que torna o cálculo honesto.</p>

      <div className="space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block">Business case (2 frases)</label>
          <textarea className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm h-20" defaultValue="SDRs estavam levando 4h para responder leads inbound — perdendo 38% da janela quente de contato. A Júlia foi criada para responder em < 90s e capturar essa janela." />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 block">Métrica de negócio principal</label>
          <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm">
            <option>Taxa de conversão de leads quentes</option>
            <option>Tempo médio de resposta</option>
            <option>Custo por lead qualificado</option>
            <option>Receita influenciada</option>
            <option>Customizar...</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Baseline pré-agente</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="4h · 38% perda" />
            <div className="text-[10px] text-stone-500 mt-1">Medido antes do deploy</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Meta de payback</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="90 dias" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Janela de avaliação</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="60 dias" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CadastroConectar() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Conectar fonte de dados</h2>
      <p className="text-sm text-stone-600 italic mb-6">Onde a agente já roda? Conectamos read-only para coletar métricas.</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { name: 'Langfuse', selected: true },
          { name: 'LangSmith' },
          { name: 'Arize Phoenix' },
          { name: 'OTel Collector' },
        ].map((c, i) => (
          <button key={i} className={`paper-card rounded p-4 text-left relative grain ${c.selected ? 'ring-2 ring-[#2D5F4F]' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-stone-900">{c.name}</span>
              {c.selected && <CheckCircle2 className="w-4 h-4 text-[#2D5F4F]" />}
            </div>
          </button>
        ))}
      </div>

      <div className="paper-card rounded p-4 relative grain mb-4" style={{ background: '#FBF6EB' }}>
        <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">Mapeamento</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-500 font-mono text-xs w-44">Trace ID da agente em Langfuse:</span>
            <input className="cream flex-1 px-3 py-1.5 rounded border border-stone-300 bg-white/60 text-sm font-mono" defaultValue="qualify-inbound-lead" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-500 font-mono text-xs w-44">Sistema de atribuição:</span>
            <select className="cream flex-1 px-3 py-1.5 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="salesforce">
              <option value="salesforce">Salesforce · oportunidades</option>
              <option value="hubspot">HubSpot</option>
              <option value="none">Não conectar agora</option>
            </select>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[#2D5F4F] flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3" /> Trincheira terá acesso read-only · dados não saem do perímetro Veridian
      </div>
    </div>
  );
}

function CadastroProbation() {
  return (
    <div>
      <h2 className="font-display text-2xl mb-1" style={{ color: '#1F2E28' }}>Probation</h2>
      <p className="text-sm text-stone-600 italic mb-6">Como qualquer contratação, a agente passa por um período de avaliação antes de virar "ativa".</p>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Duração do probation</label>
            <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="60">
              <option value="30">30 dias · agentes simples</option>
              <option value="60">60 dias · padrão</option>
              <option value="90">90 dias · agentes críticos</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Sample inicial</label>
            <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="20">
              <option value="10">10% do volume elegível</option>
              <option value="20">20% do volume elegível</option>
              <option value="50">50% do volume elegível</option>
              <option value="100">100% (sem ramp-up)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Revisão</label>
            <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="weekly">
              <option value="daily">Diária · primeira semana</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quinzenal</option>
            </select>
          </div>
        </div>

        <div className="paper-card rounded p-5 relative grain" style={{ background: '#FBF6EB' }}>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">Critérios para sair do probation</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Circle className="w-3 h-3 text-stone-400" /><span className="text-stone-700">Acurácia ≥ 85% por 3 semanas consecutivas</span></div>
            <div className="flex items-center gap-2"><Circle className="w-3 h-3 text-stone-400" /><span className="text-stone-700">CPE estável na faixa-alvo</span></div>
            <div className="flex items-center gap-2"><Circle className="w-3 h-3 text-stone-400" /><span className="text-stone-700">Zero violações críticas de governança</span></div>
            <div className="flex items-center gap-2"><Circle className="w-3 h-3 text-stone-400" /><span className="text-stone-700">NPS interno ≥ 35</span></div>
            <div className="flex items-center gap-2"><Circle className="w-3 h-3 text-stone-400" /><span className="text-stone-700">Aprovação do dono de negócio</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CONFIGURAÇÕES ====================
function ConfiguracoesView() {
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>Configurações</h1>
        <p className="text-sm text-stone-600 italic">Workspace, integrações, equipe e preferências</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <nav className="col-span-1">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 px-3">Seções</div>
          {['Workspace', 'Integrações', 'Equipe e permissões', 'Notificações', 'Segurança', 'Faturamento', 'API · Webhooks'].map((s, i) => (
            <button key={i} className={`nav-item w-full text-left px-3 py-2 rounded text-sm ${i === 1 ? 'active' : 'text-stone-700'} relative`}>
              {s}
            </button>
          ))}
        </nav>

        <div className="col-span-3 space-y-5">
          <div className="paper-card rounded-lg p-6 relative grain">
            <h3 className="font-display text-lg mb-1" style={{ color: '#1F2E28' }}>Integrações ativas</h3>
            <p className="text-xs text-stone-500 mb-4">Fontes de dados conectadas ao seu workspace</p>

            <div className="space-y-2">
              <IntegrationRow name="Langfuse" desc="Self-hosted · 4 agentes monitorados" status="ok" />
              <IntegrationRow name="Salesforce" desc="OAuth · sandbox + produção" status="ok" />
              <IntegrationRow name="Slack" desc="Notificações de incidentes para #ai-ops" status="ok" />
              <IntegrationRow name="LangSmith" desc="Não conectado" status="off" />
              <IntegrationRow name="Datadog LLM Obs" desc="Não conectado" status="off" />
              <IntegrationRow name="Snowflake" desc="Reverse ETL · 2 tabelas de baseline" status="ok" />
            </div>

            <button className="mt-4 text-xs text-[#2D5F4F] hover:underline">+ Adicionar nova integração</button>
          </div>

          <div className="paper-card rounded-lg p-6 relative grain">
            <h3 className="font-display text-lg mb-1" style={{ color: '#1F2E28' }}>Webhooks</h3>
            <p className="text-xs text-stone-500 mb-4">Notificar sistemas externos quando incidentes forem detectados</p>

            <div className="bg-white/40 rounded p-3 border border-stone-200 mb-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono">https://veridian.com.br/webhooks/trincheira-incidents</span>
                <span className="text-[#2D5F4F]">200 OK · há 4 min</span>
              </div>
              <div className="text-[10px] text-stone-500 mt-1">Eventos: illusory_victory · drift_detected · policy_violation</div>
            </div>

            <button className="text-xs text-[#2D5F4F] hover:underline">+ Adicionar webhook</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({ name, desc, status }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-200/60 last:border-0">
      <div>
        <div className="text-sm font-medium text-stone-900">{name}</div>
        <div className="text-xs text-stone-500">{desc}</div>
      </div>
      <div className="flex items-center gap-3">
        {status === 'ok' ? (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#E5EEE8] text-[#2D5F4F]">
            Conectado
          </span>
        ) : (
          <button className="text-xs text-[#2D5F4F] hover:underline">Conectar</button>
        )}
        <button className="p-1 hover:bg-stone-200/50 rounded">
          <MoreVertical className="w-3.5 h-3.5 text-stone-500" />
        </button>
      </div>
    </div>
  );
}

// ==================== PERFIL ====================
function PerfilView() {
  return (
    <div className="max-w-[900px] mx-auto px-8 py-8">
      <h1 className="font-display text-4xl tracking-tight mb-1" style={{ color: '#1F2E28' }}>Seu perfil</h1>
      <p className="text-sm text-stone-600 italic mb-8">Preferências pessoais e configurações de conta</p>

      <div className="paper-card rounded-lg p-6 mb-5 relative grain">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-20 h-20 rounded-full bg-[#2D5F4F] text-white flex items-center justify-center text-2xl font-display">RS</div>
          <div>
            <div className="font-display text-2xl" style={{ color: '#1F2E28' }}>Renata Silva</div>
            <div className="text-sm text-stone-600">Head of Growth · Veridian Capital</div>
            <div className="text-xs text-stone-500 mt-1">Dona de negócio de 1 agente · membro do Comitê de IA</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Nome</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="Renata Silva" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Email</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="renata.silva@veridian.com.br" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Cargo</label>
            <input className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="Head of Growth" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1 block">Fuso horário</label>
            <select className="cream w-full px-3 py-2 rounded border border-stone-300 bg-white/60 text-sm" defaultValue="brt">
              <option value="brt">America/Sao_Paulo (BRT)</option>
              <option value="utc">UTC</option>
            </select>
          </div>
        </div>
      </div>

      <div className="paper-card rounded-lg p-6 mb-5 relative grain">
        <h3 className="font-display text-lg mb-3" style={{ color: '#1F2E28' }}>Preferências de visualização</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-stone-200/60">
            <div>
              <div className="text-sm font-medium">Vocabulário padrão</div>
              <div className="text-xs text-stone-500">Como a Trincheira fala com você</div>
            </div>
            <div className="flex items-center gap-0 p-1 rounded-full" style={{ background: '#E8E4D8' }}>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[#1F2E28] text-[#FAF5E9]">
                <Briefcase className="w-3 h-3" /> Gestor
              </button>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-stone-600">
                <Terminal className="w-3 h-3" /> Platform
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-stone-200/60">
            <div>
              <div className="text-sm font-medium">Tema</div>
              <div className="text-xs text-stone-500">Light editorial ou dark mode</div>
            </div>
            <select className="cream px-3 py-1.5 rounded border border-stone-300 bg-white/60 text-xs" defaultValue="light">
              <option value="light">Light editorial</option>
              <option value="dark">Dark</option>
              <option value="auto">Automático</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium">Idioma</div>
              <div className="text-xs text-stone-500">Idioma da interface</div>
            </div>
            <select className="cream px-3 py-1.5 rounded border border-stone-300 bg-white/60 text-xs" defaultValue="pt-BR">
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </div>
        </div>
      </div>

      <div className="paper-card rounded-lg p-6 relative grain">
        <h3 className="font-display text-lg mb-3" style={{ color: '#1F2E28' }}>Agentes que você acompanha</h3>
        <div className="space-y-2">
          {[{ n: 'Júlia', r: 'Pré-qualificação Inbound', role: 'Dona de negócio' }, { n: 'Téo', r: 'Cobrança e régua', role: 'Observadora' }].map((a, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-stone-200/60 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-display text-[#FAF5E9]" style={{ background: getAgentColor(a.n.toLowerCase()) }}>{a.n[0]}</div>
                <div>
                  <div className="text-sm font-medium">{a.n}</div>
                  <div className="text-xs text-stone-500">{a.r}</div>
                </div>
              </div>
              <span className="text-xs text-stone-600">{a.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
