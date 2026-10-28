import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  Loader2,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function ComparativeBarChart() {
  const data = [
    { label: "Custo por resultado", value: 68, target: 55, unit: "R$", color: "chart-1" },
    { label: "Qualidade vs linha de base", value: 91, target: 85, unit: "%", color: "chart-1" },
    { label: "Cobertura de prova", value: 76, target: 90, unit: "%", color: "chart-2" },
    { label: "Autonomia efetiva", value: 42, target: 70, unit: "%", color: "chart-3" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barra comparativa</CardTitle>
        <CardDescription>Valor atual vs. alvo por métrica</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="font-mono text-foreground">{item.value}{item.unit}</span>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (item.value / Math.max(item.target, item.value)) * 100)}%`,
                  backgroundColor: `hsl(var(--${item.color}))`,
                }}
              />
              {item.target > 0 && (
                <div
                  className="absolute top-0 bottom-0 border-r-2 border-dashed border-primary"
                  style={{ left: `${Math.min(100, (item.target / Math.max(item.target, item.value)) * 100)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Alvo: {item.target}{item.unit}</span>
              <span className={cn("font-mono", item.value >= item.target ? "text-chart-1" : "text-chart-3-text")}>
                {item.value >= item.target ? "✓ No alvo" : "⚠ Abaixo"}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BulletChart() {
  const data = {
    label: "Custo por resultado validado",
    value: 68,
    target: 55,
    ranges: [
      { label: "Crítico", max: 90, color: "chart-4" },
      { label: "Atenção", max: 70, color: "chart-2" },
      { label: "Aceitável", max: 55, color: "chart-1" },
      { label: "Ideal", max: 40, color: "chart-1" },
    ],
    unit: "R$",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bullet chart</CardTitle>
        <CardDescription>Qualidade vs. linha de base com zonas de performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{data.label}</span>
            <span className="font-mono text-2xl font-medium">{data.value}{data.unit}</span>
          </div>
          <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
            {data.ranges.map((range, index) => (
              <div
                key={range.label}
                className="absolute top-0 bottom-0"
                style={{
                  left: index === 0 ? "0%" : `${(data.ranges[index - 1].max / 100) * 100}%`,
                  width: `${((range.max - (data.ranges[index - 1]?.max || 0)) / 100) * 100}%`,
                  backgroundColor: `hsl(var(--${range.color}) / 0.3)`,
                }}
              />
            ))}
            <div
              className="absolute top-1/2 -translate-y-1/2 border-r-4 border-primary"
              style={{ left: `${Math.min(100, (data.target / 100) * 100)}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-1.5 rounded bg-primary shadow-lg"
              style={{ left: `${Math.min(100, (data.value / 100) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {data.ranges.map((range) => (
              <span key={range.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded" style={{ backgroundColor: `hsl(var(--${range.color}) / 0.5)` }} />
                {range.label}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StackedBarChart() {
  const data = [
    { label: "Jan", values: [45, 23, 12, 8], colors: ["chart-1", "chart-2", "chart-3", "chart-5"] },
    { label: "Fev", values: [52, 18, 15, 5], colors: ["chart-1", "chart-2", "chart-3", "chart-5"] },
    { label: "Mar", values: [48, 25, 10, 12], colors: ["chart-1", "chart-2", "chart-3", "chart-5"] },
    { label: "Abr", values: [55, 20, 8, 10], colors: ["chart-1", "chart-2", "chart-3", "chart-5"] },
    { label: "Mai", values: [60, 15, 12, 8], colors: ["chart-1", "chart-2", "chart-3", "chart-5"] },
    { label: "Jun", values: [58, 22, 9, 11], colors: ["chart-1", "chart-2", "chart-3", "chart-5"] },
  ];
  const legends = ["No alvo", "Atenção", "Fora da meta", "Sem dado"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barra empilhada</CardTitle>
        <CardDescription>Distribuição de status por período</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-16 text-sm font-mono text-muted-foreground">{item.label}</span>
              <div className="flex-1 h-6 rounded overflow-hidden flex">
                {item.values.map((value, index) => (
                  <div
                    key={index}
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${value}%`,
                      backgroundColor: `hsl(var(--${item.colors[index]}) / 0.8)`,
                    }}
                  />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-muted-foreground font-mono">
                {item.values.reduce((a, b) => a + b, 0)}%
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
          {legends.map((legend, index) => (
            <span key={legend} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded" style={{ backgroundColor: `hsl(var(--chart-${index + 1}) / 0.8)` }} />
              {legend}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Matrix2x2() {
  const quadrants = [
    { name: "Ampliar", x: "Alto", y: "Alto", color: "chart-1", description: "Resultado alto, custo baixo — escalar" },
    { name: "Corrigir", x: "Alto", y: "Baixo", color: "chart-3", description: "Resultado alto, custo alto — otimizar" },
    { name: "Observar", x: "Baixo", y: "Alto", color: "chart-2", description: "Resultado baixo, custo baixo — monitorar" },
    { name: "Desligar", x: "Baixo", y: "Baixo", color: "chart-4", description: "Resultado baixo, custo alto — encerrar" },
  ];

  const agents = [
    { name: "Sofia", x: 85, y: 78, quadrant: 0 },
    { name: "Atlas", x: 72, y: 45, quadrant: 2 },
    { name: "Nora", x: 35, y: 82, quadrant: 1 },
    { name: "Vega", x: 28, y: 30, quadrant: 3 },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Matriz 2×2: Custo × Resultado</CardTitle>
        <CardDescription>Quadrantes de decisão: Ampliar, Corrigir, Observar, Desligar</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ width: "100%", aspectRatio: "1 / 1", maxWidth: "400px" }}>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            {quadrants.map((q, index) => (
              <div
                key={q.name}
                className="relative p-4 flex flex-col justify-between"
                style={{
                  backgroundColor: `hsl(var(--${q.color}) / 0.08)`,
                  borderRight: index % 2 === 0 ? "1px dashed hsl(var(--border))" : "none",
                  borderBottom: index < 2 ? "1px dashed hsl(var(--border))" : "none",
                }}
              >
                <span className="font-mono text-xs uppercase tracking-wide" style={{ color: `hsl(var(--${q.color}))` }}>
                  {q.name}
                </span>
                <p className="text-xs text-muted-foreground">{q.description}</p>
              </div>
            ))}
          </div>
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="absolute flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-primary-foreground shadow-lg transition-all duration-300 hover:scale-110 z-10"
              style={{
                left: `${agent.x}%`,
                top: `${100 - agent.y}%`,
                transform: "translate(-50%, 50%)",
                backgroundColor: `hsl(var(--chart-${agent.quadrant + 1}))`,
              }}
            >
              {agent.name}
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          {agents.map((agent) => (
            <div key={agent.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(var(--chart-${agent.quadrant + 1}))` }} />
              <span className="font-medium">{agent.name}</span>
              <Badge variant="outline" className="text-xs">
                {quadrants[agent.quadrant].name}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageBadge() {
  const agents = [
    { name: "Sofia", type: "aberto", coverage: 96, sources: ["Gateway", "Logs", "Tickets"] },
    { name: "Atlas", type: "parcial", coverage: 72, sources: ["Logs", "Tickets"] },
    { name: "Nora", type: "fechado", coverage: 34, sources: ["Tickets"] },
    { name: "Vega", type: "aberto", coverage: 89, sources: ["Gateway", "Logs"] },
  ];

  const typeConfig = {
    aberto: { label: "Aberto", color: "chart-1", description: "Gateway + Logs + Tickets" },
    parcial: { label: "Parcial", color: "chart-2", description: "Algumas fontes disponíveis" },
    fechado: { label: "Fechado", color: "chart-3", description: "Apenas tickets / manual" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selo de cobertura por agente</CardTitle>
        <CardDescription>Coleta pelas bordas: gateway/proxy, logs, tickets — sem depender do fornecedor</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-3 border-b">
          <span>Agente</span>
          <span className="text-center">Cobertura</span>
          <span className="text-right">Tipo</span>
        </div>
        {agents.map((agent) => {
          const config = typeConfig[agent.type as keyof typeof typeConfig];
          return (
            <div key={agent.name} className="flex items-center gap-3">
              <span className="w-28 font-medium truncate">{agent.name}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${agent.coverage}%`,
                    backgroundColor: `hsl(var(--${config.color}))`,
                  }}
                />
              </div>
              <Badge variant={agent.type === "aberto" ? "default" : agent.type === "parcial" ? "secondary" : "destructive"} className="w-24 justify-center">
                {config.label}
              </Badge>
            </div>
          );
        })}
        <div className="pt-3 space-y-1 text-xs text-muted-foreground">
          {Object.entries(typeConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <Badge variant={key === "aberto" ? "default" : key === "parcial" ? "secondary" : "destructive"} className="w-20 justify-center">
                {config.label}
              </Badge>
              <span>{config.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ResponsiveTable() {
  const columns = ["Agente", "Função", "Custo/resultado", "Qualidade", "Cobertura", "Status", "Ações"];
  const rows = [
    ["Sofia", "Atendimento N1", "R$ 68", "91%", "96%", "No alvo", ""],
    ["Atlas", "Prospecção", "R$ 142", "72%", "72%", "Atenção", ""],
    ["Nora", "Financeiro", "R$ 287", "68%", "34%", "Crítico", ""],
    ["Vega", "Engenharia", "R$ 95", "84%", "89%", "No alvo", ""],
    ["Orion", "RH", "R$ 156", "59%", "41%", "Fora da meta", ""],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabela responsiva</CardTitle>
        <CardDescription>{"Vira cards no mobile (< 640px)"}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="text-xs font-medium uppercase tracking-wide">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="data-[state=selected]:bg-muted">
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} className="text-sm">
                      {cellIndex === columns.length - 1 ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Search className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : cellIndex === 5 ? (
                        <Badge variant={cell === "No alvo" ? "default" : cell === "Atenção" ? "secondary" : "destructive"}>
                          {cell}
                        </Badge>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="md:hidden mt-4 space-y-3">
          {rows.map((row, rowIndex) => (
            <Card key={rowIndex} className="border-border bg-card">
              <CardContent className="pt-0 space-y-2">
                {columns.slice(0, -1).map((col, index) => (
                  <div key={col} className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-mono text-xs uppercase tracking-wide">{col}</span>
                    <span className="font-medium">{row[index]}</span>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t">
                  <Button variant="ghost" size="sm">
                    <Search className="h-3.5 w-3.5 mr-1" /> Ver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FormDemo() {
  type FormData = {
    nome: string;
    funcao: string;
    custoMeta: string;
    responsavel: string;
    objetivo: string;
    limite: string;
  };

  const [formData, setFormData] = useState<FormData>({
    nome: "",
    funcao: "",
    custoMeta: "",
    responsavel: "",
    objetivo: "",
    limite: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const requiredFields: (keyof FormData)[] = ["nome", "funcao", "custoMeta", "responsavel", "objetivo", "limite"];

  const validate = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    requiredFields.forEach((field) => {
      if (!formData[field]?.trim()) {
        newErrors[field] = "Obrigatório";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const missingFields = requiredFields.filter((field) => !formData[field]?.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    requiredFields.forEach((field) => setTouched((prev) => ({ ...prev, [field]: true })));
    if (validate()) {
      alert("Formulário válido! Enviando...");
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: value.trim() ? "" : "Obrigatório" }));
    }
  };

  const handleBlur = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (!formData[field]?.trim()) {
      setErrors((prev) => ({ ...prev, [field]: "Obrigatório" }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulário: Adicionar agente</CardTitle>
        <CardDescription>Campos obrigatórios marcados com * · Botão sempre ativo com "Falta preencher"</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="nome" className="flex items-center gap-1">
                Nome do agente <span className="text-chart-3-text" aria-hidden="true">*</span>
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                onBlur={() => handleBlur("nome")}
                className={cn(errors.nome && touched.nome && "border-chart-3 focus:ring-chart-3")}
                placeholder="Ex: Sofia"
                aria-invalid={errors.nome && touched.nome ? "true" : "false"}
                aria-describedby={errors.nome && touched.nome ? "nome-error" : undefined}
              />
              {errors.nome && touched.nome && (
                <p id="nome-error" className="text-xs text-chart-3-text" role="alert">
                  {errors.nome}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="funcao" className="flex items-center gap-1">
                Função <span className="text-chart-3-text" aria-hidden="true">*</span>
              </Label>
              <Input
                id="funcao"
                value={formData.funcao}
                onChange={(e) => handleChange("funcao", e.target.value)}
                onBlur={() => handleBlur("funcao")}
                className={cn(errors.funcao && touched.funcao && "border-chart-3 focus:ring-chart-3")}
                placeholder="Ex: Atendimento N1"
                aria-invalid={errors.funcao && touched.funcao ? "true" : "false"}
                aria-describedby={errors.funcao && touched.funcao ? "funcao-error" : undefined}
              />
              {errors.funcao && touched.funcao && (
                <p id="funcao-error" className="text-xs text-chart-3-text" role="alert">
                  {errors.funcao}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="custoMeta" className="flex items-center gap-1">
                Custo por resultado (meta) <span className="text-chart-3-text" aria-hidden="true">*</span>
              </Label>
              <Input
                id="custoMeta"
                type="number"
                value={formData.custoMeta}
                onChange={(e) => handleChange("custoMeta", e.target.value)}
                onBlur={() => handleBlur("custoMeta")}
                className={cn(errors.custoMeta && touched.custoMeta && "border-chart-3 focus:ring-chart-3")}
                placeholder="Ex: 50"
                aria-invalid={errors.custoMeta && touched.custoMeta ? "true" : "false"}
                aria-describedby={errors.custoMeta && touched.custoMeta ? "custoMeta-error" : undefined}
              />
              {errors.custoMeta && touched.custoMeta && (
                <p id="custoMeta-error" className="text-xs text-chart-3-text" role="alert">
                  {errors.custoMeta}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="responsavel" className="flex items-center gap-1">
                Responsável <span className="text-chart-3-text" aria-hidden="true">*</span>
              </Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => handleChange("responsavel", e.target.value)}
                onBlur={() => handleBlur("responsavel")}
                className={cn(errors.responsavel && touched.responsavel && "border-chart-3 focus:ring-chart-3")}
                placeholder="Ex: Marina Alves · CX"
                aria-invalid={errors.responsavel && touched.responsavel ? "true" : "false"}
                aria-describedby={errors.responsavel && touched.responsavel ? "responsavel-error" : undefined}
              />
              {errors.responsavel && touched.responsavel && (
                <p id="responsavel-error" className="text-xs text-chart-3-text" role="alert">
                  {errors.responsavel}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="objetivo" className="flex items-center gap-1">
              Objetivo <span className="text-chart-3-text" aria-hidden="true">*</span>
            </Label>
            <Textarea
              id="objetivo"
              value={formData.objetivo}
              onChange={(e) => handleChange("objetivo", e.target.value)}
              onBlur={() => handleBlur("objetivo")}
              className={cn(errors.objetivo && touched.objetivo && "border-chart-3 focus:ring-chart-3")}
              placeholder="Ex: Resolver 90% dos chamados de 1º nível sem escalar"
              rows={2}
              aria-invalid={errors.objetivo && touched.objetivo ? "true" : "false"}
              aria-describedby={errors.objetivo && touched.objetivo ? "objetivo-error" : undefined}
            />
            {errors.objetivo && touched.objetivo && (
              <p id="objetivo-error" className="text-xs text-chart-3-text" role="alert">
                {errors.objetivo}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="limite" className="flex items-center gap-1">
              Limite <span className="text-chart-3-text" aria-hidden="true">*</span>
            </Label>
            <Textarea
              id="limite"
              value={formData.limite}
              onChange={(e) => handleChange("limite", e.target.value)}
              onBlur={() => handleBlur("limite")}
              className={cn(errors.limite && touched.limite && "border-chart-3 focus:ring-chart-3")}
              placeholder="Ex: Reembolsa até R$ 500 sozinha"
              rows={2}
              aria-invalid={errors.limite && touched.limite ? "true" : "false"}
              aria-describedby={errors.limite && touched.limite ? "limite-error" : undefined}
            />
            {errors.limite && touched.limite && (
              <p id="limite-error" className="text-xs text-chart-3-text" role="alert">
                {errors.limite}
              </p>
            )}
          </div>

          {missingFields.length > 0 && (
            <div className="rounded-lg border border-chart-2 bg-chart-2/10 p-3" role="alert">
              <div className="flex items-center gap-2 text-sm text-chart-2-text">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <span>
                  Falta preencher: <strong>{missingFields.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ")}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="btn-primary" disabled={submitted}>
              {submitted ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar agente
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setFormData({ nome: "", funcao: "", custoMeta: "", responsavel: "", objetivo: "", limite: "" }); setErrors({}); setTouched({}); setSubmitted(false); }}>
              Limpar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EmptyStates() {
  const states = [
    {
      title: "Nenhum agente cadastrado",
      description: "Conecte sua primeira execução e o Muster criará a ficha automaticamente.",
      icon: Bot,
      action: "Conectar execução",
      secondary: "Ver como funciona",
    },
    {
      title: "Nenhuma entrega registrada",
      description: "As entregas aparecem aqui quando o agente conclui uma tarefa com prova.",
      icon: FileText,
      action: "Ver agentes",
      secondary: null,
    },
    {
      title: "Nenhum alerta ativo",
      description: "A operação está estável. O Muster avisará quando algo precisar de atenção.",
      icon: ShieldCheck,
      action: null,
      secondary: null,
    },
    {
      title: "Nenhum relatório disponível",
      description: "O primeiro relatório mensal será gerado após 30 dias de coleta.",
      icon: FileText,
      action: "Ver agentes",
      secondary: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estados vazios</CardTitle>
        <CardDescription>Copy das referências para cada estado vazio do app</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {states.map((state, index) => {
            const Icon = state.icon;
            return (
              <Card key={index} className="border-border bg-card/50 h-full">
                <CardContent className="flex flex-col items-center text-center p-6 gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-medium">{state.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{state.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    {state.action && (
                      <Button className="btn-primary w-full justify-center">{state.action}</Button>
                    )}
                    {state.secondary && (
                      <Button variant="secondary" className="w-full justify-center">
                        {state.secondary}
                      </Button>
                    )}
                    {!state.action && !state.secondary && (
                      <Badge variant="outline" className="w-full justify-center">
                        Sem ação necessária
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopNavigation() {
  const items = [
    { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard, badge: null },
    { id: "agentes", label: "Agentes", icon: Users, badge: "3" },
    { id: "entregas", label: "Entregas", icon: FileText, badge: "12" },
    { id: "relatorios", label: "Relatórios", icon: MessageSquare, badge: null },
    { id: "pendencias", label: "Pendências", icon: CircleAlert, badge: "5" },
  ];

  return (
    <Card className="w-64 flex-shrink-0 hidden lg:block">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Muster
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <nav className="space-y-1" aria-label="Navegação principal">
          {items.map((item) => (
            <button
              key={item.id}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <Badge variant="default" className="text-[9px] px-1.5 py-0.5">
                  {item.badge}
                </Badge>
              )}
            </button>
          ))}
        </nav>
        <Separator className="my-4" />
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="h-4.5 w-4.5 shrink-0" />
          <span>Configurações</span>
        </button>
      </CardContent>
    </Card>
  );
}

function MobileBottomNav() {
  const items = [
    { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
    { id: "agentes", label: "Agentes", icon: Users },
    { id: "entregas", label: "Entregas", icon: FileText },
    { id: "pendencias", label: "Pendências", icon: CircleAlert },
    { id: "mais", label: "Mais", icon: Menu },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className="flex flex-col items-center gap-1 px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavigationDemo() {
  return (
    <Card className="lg:h-[500px]">
      <CardHeader>
        <CardTitle>Navegação: Desktop + Mobile</CardTitle>
        <CardDescription>Sidebar fixa no desktop (5 itens + Configurações no rodapé) · Barra inferior no mobile (5 itens)</CardDescription>
      </CardHeader>
      <CardContent className="relative h-full">
        <div className="flex h-full">
          <DesktopNavigation />
          <div className="flex-1 p-6 lg:p-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-medium">Visão geral</h2>
                  <p className="text-sm text-muted-foreground">Resumo da operação com número grande e gráficos</p>
                </div>
                <Badge variant="illustrative">Dados ilustrativos</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Custo total/mês" value="R$ 42.3k" delta="+8% MoM" tone="chart-2" />
                <MetricCard label="Agentes com responsável" value="12 / 15" delta="+2" tone="chart-1" />
                <MetricCard label="Decisões pendentes" value="5" delta="-1" tone="chart-1" />
              </div>
              <div className="rounded-xl border p-6 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Desktop:</strong> sidebar fixa à esquerda com 5 itens de menu + Configurações no rodapé.
                  <br />
                  <strong className="text-foreground">Mobile:</strong> barra inferior fixa com 5 itens (Visão geral, Agentes, Entregas, Pendências, Mais).
                </p>
              </div>
            </div>
          </div>
        </div>
        <MobileBottomNav />
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: string }) {
  return (
    <div className="rounded-xl border p-4 bg-card">
      <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 font-serif text-2xl font-medium">{value}</div>
      <p className="mt-1 text-xs font-mono" style={{ color: `hsl(var(--${tone}))` }}>{delta}</p>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-medium">Design System</span>
            <Badge variant="outline">Claro de decisão</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <HelpCircle className="h-4 w-4 mr-1" /> Documentação
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 space-y-8">
        <section>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Componentes visuais</h1>
          <p className="mt-2 text-muted-foreground">Gráficos, tabelas, formulários, estados vazios e navegação do sistema "Claro de decisão"</p>
        </section>

        <section className="space-y-6" aria-labelledby="charts-heading">
          <h2 id="charts-heading" className="font-serif text-2xl font-medium tracking-tight">Gráficos</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ComparativeBarChart />
            <BulletChart />
            <StackedBarChart />
            <Matrix2x2 />
            <CoverageBadge />
          </div>
        </section>

        <section className="space-y-6" aria-labelledby="tables-heading">
          <h2 id="tables-heading" className="font-serif text-2xl font-medium tracking-tight">Tabelas</h2>
          <ResponsiveTable />
        </section>

        <section className="space-y-6" aria-labelledby="forms-heading">
          <h2 id="forms-heading" className="font-serif text-2xl font-medium tracking-tight">Formulários</h2>
          <FormDemo />
        </section>

        <section className="space-y-6" aria-labelledby="empty-heading">
          <h2 id="empty-heading" className="font-serif text-2xl font-medium tracking-tight">Estados vazios</h2>
          <EmptyStates />
        </section>

        <section className="space-y-6" aria-labelledby="nav-heading">
          <h2 id="nav-heading" className="font-serif text-2xl font-medium tracking-tight">Navegação</h2>
          <NavigationDemo />
        </section>

        <section className="space-y-6 pt-8 border-t" aria-labelledby="tokens-heading">
          <h2 id="tokens-heading" className="font-serif text-2xl font-medium tracking-tight">Tokens de cor (referência)</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Background", token: "background", text: "foreground" },
              { name: "Foreground", token: "foreground", text: "background" },
              { name: "Primary (Ação)", token: "primary", text: "primary-foreground" },
              { name: "Secondary", token: "secondary", text: "secondary-foreground" },
              { name: "Muted", token: "muted", text: "muted-foreground" },
              { name: "Accent (Ciano)", token: "accent", text: "accent-foreground" },
              { name: "Destructive", token: "destructive", text: "destructive-foreground" },
              { name: "Border", token: "border", text: "foreground" },
            ].map(({ name, token, text }) => (
              <div key={name} className="rounded-xl border p-4">
                <div
                  className="h-16 rounded-lg mb-3"
                  style={{
                    backgroundColor: `hsl(var(--${token}))`,
                    color: `hsl(var(--${text}))`,
                    border: token === "border" ? "1px dashed hsl(var(--foreground))" : "none",
                  }}
                />
                <div className="font-mono text-xs text-muted-foreground">--{token}</div>
                <div className="font-medium text-sm">{name}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {[
              { name: "chart-1 (Positivo)", token: "chart-1" },
              { name: "chart-2 (Atenção)", token: "chart-2" },
              { name: "chart-3 (Negativo)", token: "chart-3" },
              { name: "chart-4 (Crítico)", token: "chart-4" },
              { name: "chart-5 (Neutro)", token: "chart-5" },
            ].map(({ name, token }) => (
              <div key={name} className="rounded-xl border p-4">
                <div className="h-16 rounded-lg mb-3" style={{ backgroundColor: `hsl(var(--${token}))` }} />
                <div className="font-mono text-xs text-muted-foreground">--{token}</div>
                <div className="font-medium text-sm">{name}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}