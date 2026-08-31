import { FormEvent, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Anchor, BarChart3, Building2, ChevronLeft, ChevronRight, CircleUserRound,
  FileClock, Filter, Layers3, Map as MapIcon, Moon, Palette, Plus, RefreshCw,
  Search, Settings, ShieldCheck, Ship, Sun, X,
} from "lucide-react";
import { MapSurface } from "@/components/MapSurface";
import { CUSTOMS_CHANNELS, IMPORT_STAGES } from "@/lib/domain";
import { isIso6346, normalizeContainerNumber } from "@/lib/iso6346";
import { hasSupabaseConfig } from "@/lib/supabase";

type Theme = "dark" | "light";
type PaletteName = "radar" | "harbor" | "executive" | "contrast";

const pages = [
  { to: "/dashboard", label: "Mapa operacional", icon: MapIcon },
  { to: "/importacoes", label: "Importações", icon: Ship },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [palette, setPalette] = useState<PaletteName>("radar");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Starter local · aguardando Supabase e dados oficiais");
  const location = useLocation();
  const navigate = useNavigate();

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeContainerNumber(query);
    if (!normalized) return setMessage("Digite um número de contêiner para pesquisar.");
    setMessage(isIso6346(normalized)
      ? `${normalized} é ISO 6346 válido; sem posição carregada nesta base.`
      : `${normalized} não passou na validação ISO 6346.`);
  }

  const activePage = useMemo(() => pages.find((page) => location.pathname.startsWith(page.to)) ?? pages[0], [location.pathname]);

  return (
    <div className="radar-shell" data-theme={theme} data-palette={palette}>
      <header className="topbar">
        <button className="brand-lockup brand-button" onClick={() => navigate("/dashboard")} aria-label="Ir ao mapa operacional">
          <span className="brand-mark"><img src="/comex-control-logo.png" alt="" /></span>
          <span><strong>COMEX CONTROL</strong><small>IMPORT INTELLIGENCE</small></span>
        </button>
        <label className="company-switcher">
          <Building2 size={16} />
          <span><small>Empresa ativa</small><strong>Nenhuma empresa vinculada</strong></span>
          <select aria-label="Selecionar empresa" disabled><option>Conecte o Supabase</option></select>
        </label>
        <form className="global-search" onSubmit={submitSearch}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contêiner (ex.: ABCU1234567)" maxLength={14} />
          <kbd>ENTER</kbd>
          <button type="submit" aria-label="Pesquisar"><Search size={15} /></button>
        </form>
        <div className="top-actions">
          <div className="sync-health"><span className="pulse-dot loading" /><div><strong>{hasSupabaseConfig ? "Supabase configurado" : "Modo blueprint"}</strong><small>Sem dados fictícios</small></div></div>
          <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Alternar tema" aria-label="Alternar tema">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="palette-control">
            <button className="theme-toggle" onClick={() => setPaletteOpen(!paletteOpen)} title="Padrão de cores" aria-label="Abrir padrões de cores"><Palette size={16} /></button>
            {paletteOpen && <PaletteMenu current={palette} onChange={(value) => { setPalette(value); setPaletteOpen(false); }} />}
          </div>
          <button className="new-import-button" onClick={() => setDialogOpen(true)}><Plus size={14} /> <span>Nova importação</span></button>
          <button className="avatar" aria-label="Conta do usuário"><CircleUserRound size={17} /></button>
        </div>
      </header>

      <nav className="workspace-tabs" aria-label="Navegação principal">
        <div>{pages.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}><Icon size={13} /> {label}</NavLink>)}</div>
        <span><ShieldCheck size={13} /> Isolamento multiempresa <i /> RLS obrigatório</span>
      </nav>

      <Routes>
        <Route path="*" element={<Dashboard theme={theme} overviewOpen={overviewOpen} onToggleOverview={() => setOverviewOpen(!overviewOpen)} message={message} />} />
        <Route path="/dashboard" element={<Dashboard theme={theme} overviewOpen={overviewOpen} onToggleOverview={() => setOverviewOpen(!overviewOpen)} message={message} />} />
        <Route path="/importacoes" element={<WorkspacePlaceholder page="Importações" description="Listagem, cadastro e edição serão ativados ao aplicar a migration e configurar o Supabase." icon={Ship} onAction={() => setDialogOpen(true)} />} />
        <Route path="/relatorios" element={<WorkspacePlaceholder page="Relatórios" description="Estrutura reservada para relatórios operacionais, aduaneiros, ETA, auditoria e exportações." icon={BarChart3} />} />
        <Route path="/configuracoes" element={<WorkspacePlaceholder page="Configurações" description="Área de empresas, membros, papéis, integrações, transportadoras e auditoria." icon={Settings} />} />
      </Routes>

      {dialogOpen && <ImportDialog onClose={() => setDialogOpen(false)} />}
      <span className="sr-only" aria-live="polite">Página atual: {activePage.label}. {message}</span>
    </div>
  );
}

function Dashboard({ theme, overviewOpen, onToggleOverview, message }: { theme: Theme; overviewOpen: boolean; onToggleOverview: () => void; message: string }) {
  return (
    <main className="map-stage">
      <MapSurface theme={theme} />
      {overviewOpen ? <OverviewPanel onClose={onToggleOverview} /> : <button className="overview-open-button" onClick={onToggleOverview}><ChevronRight size={14} /> Exibir painel</button>}
      <div className="map-tools"><button title="Camadas" aria-label="Camadas"><Layers3 size={15} /></button><button title="Filtros" aria-label="Filtros"><Filter size={15} /></button><button title="Atualizar" aria-label="Atualizar"><RefreshCw size={15} /></button></div>
      <Legend title="Status" className="status-legend" entries={Object.values(IMPORT_STAGES)} />
      <Legend title="Canal" className="channel-legend" entries={Object.values(CUSTOMS_CHANNELS)} />
      <div className="system-toast"><ShieldCheck size={13} /> {message}</div>
    </main>
  );
}

function OverviewPanel({ onClose }: { onClose: () => void }) {
  return <aside className="overview-panel" aria-label="Resumo operacional">
    <div className="overview-heading"><div><p className="eyebrow">Visão operacional</p><h1>Importações</h1></div><button className="icon-button" onClick={onClose} title="Ocultar painel"><ChevronLeft size={15} /></button></div>
    <div className="overview-metrics">
      <article className="metric-card"><Anchor size={14} /><span>Ativos</span><strong>0</strong><small>na empresa ativa</small></article>
      <article className="metric-card"><FileClock size={14} /><span>Pendentes</span><strong>0</strong><small>sem dados carregados</small><i className="metric-kicker red" /></article>
      <article className="metric-card metric-card-wide"><Ship size={14} /><span>ETA nas próximas 72h</span><strong>0</strong><small>rastreamento híbrido 06h/18h + exceções</small><i className="metric-kicker orange" /></article>
    </div>
    <div className="eta-alert"><ShieldCheck size={16} /><div><strong>Base limpa e auditável</strong><small>Contadores zerados até importar os dados oficiais.</small></div></div>
    <div className="section-title"><span>Etapas operacionais</span></div>
    <div className="filter-list">{Object.values(IMPORT_STAGES).map((stage) => <button key={stage.label}><i className="legend-dot" style={{ color: stage.color, background: stage.color }} /><span>{stage.label}</span><strong>0</strong></button>)}</div>
    <section className="watchlist"><div className="section-title"><span>Monitoramento</span></div><p className="watchlist-empty">Nenhum contêiner monitorado. Coordenadas só serão exibidas após validação por fonte de rastreamento.</p></section>
  </aside>;
}

function Legend({ title, className, entries }: { title: string; className: string; entries: ReadonlyArray<{ label: string; color: string }> }) {
  return <div className={`map-legend ${className}`}><strong>{title}</strong>{entries.map((entry) => <span key={entry.label}><i style={{ color: entry.color, background: entry.color }} />{entry.label}</span>)}</div>;
}

function PaletteMenu({ current, onChange }: { current: PaletteName; onChange: (value: PaletteName) => void }) {
  const items: Array<{ value: PaletteName; label: string; colors: string[] }> = [
    { value: "radar", label: "Radar", colors: ["#c9f43e", "#42d8ff"] },
    { value: "harbor", label: "Porto", colors: ["#f59e0b", "#38bdf8"] },
    { value: "executive", label: "Executivo", colors: ["#a78bfa", "#67e8f9"] },
    { value: "contrast", label: "Alto contraste", colors: ["#ffe500", "#00e5ff"] },
  ];
  return <div className="palette-menu"><strong>Padrão visual</strong><small>Apenas cores de interface; status e canais não mudam.</small>{items.map((item) => <button key={item.value} className={current === item.value ? "active" : ""} onClick={() => onChange(item.value)}><span>{item.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>{item.label}{current === item.value ? "✓" : ""}</button>)}</div>;
}

function WorkspacePlaceholder({ page, description, icon: Icon, onAction }: { page: string; description: string; icon: typeof Ship; onAction?: () => void }) {
  return <main className="workspace-page"><section className="workspace-card"><Icon size={25} /><p className="eyebrow">Comex Control</p><h1>{page}</h1><p>{description}</p><div className="blueprint-checklist"><span>✓ rota React Router</span><span>✓ tema escuro/claro</span><span>✓ RLS descrita em migration</span><span>✓ nenhum dado inventado</span></div>{onAction && <button className="new-import-button" onClick={onAction}><Plus size={14} /> Preparar cadastro</button>}</section></main>;
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [container, setContainer] = useState("");
  const valid = container.length > 0 && isIso6346(container);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="new-import-title">
      <header className="dialog-head"><span className="dialog-title-mark"><Anchor size={18} /></span><div><p className="eyebrow">Cadastro multiempresa</p><h2 id="new-import-title">Nova importação</h2><p>Formulário preparado para persistir via Supabase após autenticação e vínculo empresarial.</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={16} /></button></header>
      <form className="import-form" onSubmit={(event) => event.preventDefault()}>
        <div className="company-scope-note"><span>Escopo</span><strong>Nenhuma empresa ativa</strong><small>O company_id nunca será escolhido pelo payload do cliente; será validado por membership/RLS.</small></div>
        <div className="minimum-registration-note"><ShieldCheck size={17} /><div><strong>Base sem dados de demonstração</strong><p>Preencha apenas para validar o formulário. O botão permanece bloqueado até o Supabase estar conectado.</p></div></div>
        <fieldset><legend><FileClock size={14} /> Identificação</legend><div className="form-grid"><label><span>Referência interna</span><input placeholder="Ex.: IMP-2026-0001" /></label><label><span>Importador</span><input placeholder="Razão social" /></label><label><span>Contêiner</span><input value={container} onChange={(event) => setContainer(normalizeContainerNumber(event.target.value))} placeholder="ABCU1234567" maxLength={11} /><small>{container ? valid ? "ISO 6346 válido" : "Número ainda não é ISO 6346 válido" : ""}</small></label><label><span>Conhecimento de embarque (BL)</span><input placeholder="Opcional no cadastro inicial" /></label></div></fieldset>
        <fieldset><legend><Ship size={14} /> Rota e previsão</legend><div className="form-grid route-form-grid"><label><span>POL</span><input placeholder="Código UN/LOCODE" /></label><label><span>Porto de origem</span><input placeholder="Nome do porto" /></label><label><span>POD</span><input placeholder="Código UN/LOCODE" /></label><label><span>Porto de destino</span><input placeholder="Nome do porto" /></label></div></fieldset>
        <div className="dialog-actions"><span><ShieldCheck size={13} /> Persistência protegida por RLS</span><div><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="new-import-button" disabled>Conectar Supabase para salvar</button></div></div>
      </form>
    </section>
  </div>;
}

export default App;
