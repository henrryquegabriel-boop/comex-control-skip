import { FormEvent, useEffect, useState } from 'react'
import {
  Anchor,
  BarChart3,
  BellRing,
  Building2,
  Check,
  ChevronDown,
  CircleUserRound,
  Container,
  FileCheck2,
  Filter,
  Globe2,
  Layers3,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShipWheel,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MapFilters, MapLayerStyle, MapSurface } from './components/MapSurface'
import {
  CUSTOMS_CHANNEL_OPTIONS,
  OPERATIONAL_STAGES,
  PRODUCT,
  TRACKING_POLICY,
  type UserSessionProfile,
} from './lib/domain'
import { isValidIso6346, normalizeContainerCode } from './lib/iso6346'
import { hasGoogleOAuthConfig, hasSupabaseConfig, supabase } from './lib/supabase'

type Theme = 'dark' | 'light' | 'violet' | 'ocean' | 'graphite' | 'amber'
type CompanyName = string
type AuthUser = UserSessionProfile
type CompanyMembershipOption = Pick<AuthUser, 'company' | 'companyId' | 'role'>

const NAVIGATION = [
  { to: '/dashboard', label: 'Mapa operacional', icon: Anchor },
  { to: '/importacoes', label: 'Importações', icon: Container },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

function Logo() {
  const [failed, setFailed] = useState(false)
  return (
    <div className="brand" aria-label="Comex Control — Import Intelligence">
      {!failed ? (
        <picture>
          <source srcSet="/comex-control-logo.png" type="image/png" />
          <img src="/comex-control-logo.svg" alt="Comex Control" onError={() => setFailed(true)} />
        </picture>
      ) : (
        <span className="brand-fallback">
          <Anchor size={23} />
        </span>
      )}
      <span className="brand-copy">
        <b>
          COMEX
          <br />
          CONTROL
        </b>
        <small>
          IMPORT
          <br />
          INTELLIGENCE
        </small>
      </span>
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  // Sessão de usuário autenticado: sem sessão por padrão (sem empresa ativa)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [company, setCompany] = useState<CompanyName | null>(null)
  const [companyMemberships, setCompanyMemberships] = useState<CompanyMembershipOption[]>([])

  const [theme, setTheme] = useState<Theme>('dark')
  const [blueprint, setBlueprint] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [newImportOpen, setNewImportOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    setMobileMenu(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // Escuta mudanças de sessão reais no Supabase quando disponível
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true

    async function loadSessionUser(userId: string, sessionEmail?: string) {
      const [profileResult, membershipResult] = await Promise.all([
        client
          .from('user_profiles')
          .select('user_id, display_name, email')
          .eq('user_id', userId)
          .maybeSingle(),
        client
          .from('company_memberships')
          .select('role, company_id, companies(code)')
          .eq('user_id', userId)
          .eq('active', true),
      ])

      if (!active) return
      const profile = profileResult.data
      const memberships = (membershipResult.data ?? [])
        .flatMap((membership) => {
          const relatedCompany = Array.isArray(membership.companies)
            ? membership.companies[0]
            : membership.companies
          if (!relatedCompany?.code) return []
          return [
            {
              company: relatedCompany.code,
              companyId: membership.company_id,
              role: membership.role,
            } as CompanyMembershipOption,
          ]
        })
        .sort((left, right) => left.company.localeCompare(right.company, 'pt-BR'))

      const activeMembership = memberships[0]
      if (profileResult.error || membershipResult.error || !activeMembership) {
        setUser(null)
        setCompany(null)
        setCompanyMemberships([])
        return
      }

      const loadedUser: AuthUser = {
        id: userId,
        name: profile?.display_name || sessionEmail?.split('@')[0] || 'Usuário',
        email: profile?.email || sessionEmail || '',
        role: activeMembership.role,
        company: activeMembership.company,
        companyId: activeMembership.companyId,
      }
      setUser(loadedUser)
      setCompany(activeMembership.company)
      setCompanyMemberships(memberships)
      setAuthModalOpen(false)
    }

    // Verifica sessão atual
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void loadSessionUser(session.user.id, session.user.email)
      }
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadSessionUser(session.user.id, session.user.email)
      } else {
        setUser(null)
        setCompany(null)
        setCompanyMemberships([])
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Sincroniza a empresa ativa a partir do perfil retornado exclusivamente pelo backend
  const handleLogin = (newUser: AuthUser) => {
    setUser(newUser)
    setCompany(newUser.company)
    setCompanyMemberships([
      { company: newUser.company, companyId: newUser.companyId, role: newUser.role },
    ])
    setAuthModalOpen(false)
  }

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        // Ignora erros de rede em desconexão
      }
    }
    setUser(null)
    setCompany(null)
    setCompanyMemberships([])
    setUserMenuOpen(false)
  }

  // O usuário só alterna entre vínculos retornados pelo backend; nunca informa empresa avulsa.
  const handleCompanyChange = (newComp: CompanyName | '') => {
    if (!user) return
    const membership = companyMemberships.find((item) => item.company === newComp)
    if (!membership) return
    setCompany(membership.company)
    setUser({
      ...user,
      company: membership.company,
      companyId: membership.companyId,
      role: membership.role,
    })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const code = normalizeContainerCode(search)
    if (!code) return setSearchMessage('Digite o código do contêiner.')
    if (!isValidIso6346(code)) return setSearchMessage('Código ISO 6346 inválido.')
    setSearchMessage('Nenhuma importação oficial carregada.')
    navigate(`/importacoes?container=${code}`)
  }

  return (
    <div className={blueprint ? 'app blueprint' : 'app'}>
      <header className="topbar">
        <Logo />

        {/* Identificação de empresa vinculada: exclusivamente derivada de auth.uid() / profiles / memberships */}
        <div
          className={`company-picker ${!user ? 'is-disabled' : ''}`}
          title={
            !user
              ? 'Nenhuma empresa vinculada — necessária sessão autenticada'
              : `${companyMemberships.length} empresa(s) autorizada(s) pelo backend e RLS`
          }
          role="status"
          aria-label={
            !user ? 'Nenhuma empresa vinculada (sem sessão)' : `Empresa vinculada: ${company}`
          }
        >
          <Building2 size={17} />
          <span>
            <small>{companyMemberships.length > 1 ? 'Empresa ativa' : 'Empresa vinculada'}</small>
            <b>{company ? company : 'Nenhuma (sem sessão)'}</b>
          </span>
          {user && companyMemberships.length > 1 && (
            <>
              <ChevronDown size={14} aria-hidden="true" />
              <select
                aria-label="Selecionar empresa ativa"
                value={company ?? ''}
                onChange={(event) => handleCompanyChange(event.target.value)}
              >
                {companyMemberships.map((membership) => (
                  <option key={membership.companyId} value={membership.company}>
                    {membership.company}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <form className="global-search" onSubmit={submitSearch}>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setSearchMessage('')
            }}
            placeholder="Buscar contêiner (ex.: ABCU1234567)"
            aria-label="Buscar contêiner"
          />
          <kbd>ENTER</kbd>
          <button aria-label="Buscar" type="submit">
            <Search size={16} />
          </button>
          {searchMessage && <span className="search-message">{searchMessage}</span>}
        </form>

        <button
          className={`blueprint-switch ${blueprint ? 'is-on' : ''}`}
          onClick={() => setBlueprint((value) => !value)}
          aria-pressed={blueprint}
          title="Modo blueprint: exibe malha de engenharia sem dados fictícios"
        >
          <span className="toggle-dot" />
          <span>
            <b>
              Modo
              <br />
              blueprint
            </b>
            <small>
              Sem dados
              <br />
              fictícios
            </small>
          </span>
        </button>

        <button
          className="icon-button theme-quick"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
          title="Alternar tema claro/escuro"
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>

        <label
          className="icon-button palette-picker"
          aria-label="Paleta de cores"
          title="Selecionar paleta"
        >
          <Palette size={17} />
          <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
            <option value="violet">Violeta</option>
            <option value="ocean">Oceano</option>
            <option value="graphite">Grafite</option>
            <option value="amber">Âmbar</option>
          </select>
        </label>

        <button
          className="primary-action"
          onClick={() => {
            if (!user) {
              setAuthModalOpen(true)
            } else {
              setNewImportOpen(true)
            }
          }}
          title={
            !user ? 'Sessão necessária — faça login para cadastrar importações' : 'Nova importação'
          }
          aria-label={
            !user ? 'Sessão necessária — faça login para cadastrar importações' : 'Nova importação'
          }
        >
          <Plus size={16} /> Nova
          <br />
          importação
        </button>

        <div className="user-profile-wrapper">
          <button
            className={`profile-button ${user ? 'is-logged-in' : ''}`}
            onClick={() => {
              if (user) {
                setUserMenuOpen((val) => !val)
              } else {
                setAuthModalOpen(true)
              }
            }}
            aria-label={user ? `Perfil de ${user.name}` : 'Entrar / Iniciar sessão'}
            title={user ? `Sessão ativa: ${user.name} (${user.company})` : 'Entrar na conta'}
          >
            <CircleUserRound size={22} />
          </button>
          {userMenuOpen && user && (
            <div className="profile-menu-popover">
              <div className="profile-menu-header">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <span className="role-tag">
                  {user.role} · {user.company}
                </span>
              </div>
              <hr />
              <button className="profile-menu-item logout" onClick={handleLogout}>
                <LogOut size={14} /> Encerrar sessão
              </button>
            </div>
          )}
        </div>

        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenu((value) => !value)}
          aria-label="Menu"
          aria-expanded={mobileMenu}
        >
          <Menu />
        </button>
      </header>

      <nav
        className={mobileMenu ? 'main-nav is-open' : 'main-nav'}
        aria-label="Navegação principal"
      >
        <div className="nav-links">
          {NAVIGATION.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </div>

        {/* Mobile session info */}
        <div className="mobile-session-banner">
          {user ? (
            <div className="mobile-user-row">
              <span>
                <CircleUserRound size={14} /> {user.name} (<b>{company}</b>)
              </span>
              {companyMemberships.length > 1 && (
                <select
                  className="mobile-company-select"
                  aria-label="Selecionar empresa ativa no menu"
                  value={company ?? ''}
                  onChange={(event) => handleCompanyChange(event.target.value)}
                >
                  {companyMemberships.map((membership) => (
                    <option key={membership.companyId} value={membership.company}>
                      {membership.company}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={handleLogout} className="mobile-logout-btn">
                <LogOut size={13} /> Sair
              </button>
            </div>
          ) : (
            <div className="mobile-user-row">
              <span className="text-muted">
                <ShieldAlert size={14} /> Sem sessão ativa (nenhuma empresa)
              </span>
              <button onClick={() => setAuthModalOpen(true)} className="mobile-login-btn">
                <LogIn size={13} /> Entrar
              </button>
            </div>
          )}
        </div>

        <span className="security-notice">
          <ShieldCheck size={14} /> Isolamento multiempresa <i /> RLS obrigatório
        </span>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard company={company} user={user} onOpenAuth={() => setAuthModalOpen(true)} />
            }
          />
          <Route
            path="/importacoes"
            element={
              <ImportsPage
                company={company}
                user={user}
                onNew={() => {
                  if (!user) setAuthModalOpen(true)
                  else setNewImportOpen(true)
                }}
              />
            }
          />
          <Route path="/relatorios" element={<ReportsPage company={company} />} />
          <Route
            path="/configuracoes"
            element={
              <SettingsPage
                theme={theme}
                setTheme={setTheme}
                user={user}
                company={company}
                onOpenAuth={() => setAuthModalOpen(true)}
                onLogout={handleLogout}
              />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer>
        <ShieldCheck size={14} />{' '}
        {hasSupabaseConfig
          ? 'Supabase HML conectado · aguardando dados oficiais'
          : 'Starter local · Supabase não configurado'}{' '}
        <span>·</span>{' '}
        {company ? `Empresa ativa: ${company}` : 'Nenhuma empresa ativa (sem sessão)'}
      </footer>

      {newImportOpen && user && company && (
        <NewImportModal close={() => setNewImportOpen(false)} company={company} user={user} />
      )}
      {authModalOpen && <AuthModal close={() => setAuthModalOpen(false)} onLogin={handleLogin} />}
    </div>
  )
}

function MetricCard({
  label,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  detail: string
  icon: typeof Anchor
  tone: string
}) {
  return (
    <article className="metric-card" style={{ '--metric-tone': tone } as React.CSSProperties}>
      <span>{label}</span>
      <Icon size={16} />
      <b>0</b>
      <small>{detail}</small>
    </article>
  )
}

function Dashboard({
  company,
  user,
  onOpenAuth,
}: {
  company: CompanyName | null
  user: AuthUser | null
  onOpenAuth: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  // Estados dos controles interativos do Mapa
  const [layersOpen, setLayersOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mapStyle, setMapStyle] = useState<MapLayerStyle>('positron')
  const [showGrid, setShowGrid] = useState(true)
  const [showLegends, setShowLegends] = useState(true)
  const [filters, setFilters] = useState<MapFilters>({
    stage: 'ALL',
    channel: 'ALL',
    search: '',
  })
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null)

  // Timer de cooldown manual de 60s (SOMENTE iniciado após resposta real bem-sucedida do backend)
  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownRemaining])

  const handleRefresh = async () => {
    if (cooldownRemaining > 0 || refreshing) return

    // 1. Verificação de Supabase configurado
    if (!hasSupabaseConfig || !supabase) {
      setSyncStatusMessage('Backend não configurado — nenhuma consulta realizada')
      return
    }

    // 2. Verificação de sessão de usuário
    if (!user) {
      setSyncStatusMessage('Sessão necessária')
      return
    }

    // 3. Com backend e sessão, solicita a consulta síncrona ao relay protegido.
    setRefreshing(true)
    setSyncStatusMessage(null)

    try {
      const { data, error } = await supabase.functions.invoke('tracking-refresh', {
        body: { companyId: user.companyId },
      })

      if (error) {
        setSyncStatusMessage(`Atualização não executada: ${error.message}`)
      } else if (!data?.ok) {
        setSyncStatusMessage(data?.error || 'Atualização não confirmada pelo backend.')
      } else {
        // Timestamp e cooldown ocorrem SOMENTE após resposta real bem-sucedida
        setLastRefreshedAt(new Date())
        setCooldownRemaining(TRACKING_POLICY.manualCooldownSeconds)
        setSyncStatusMessage('Atualização de rastreamento confirmada pelo backend.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na conexão com o backend'
      setSyncStatusMessage(`Falha de conexão: ${msg}`)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className={collapsed ? 'dashboard side-collapsed' : 'dashboard'}>
      <aside className="ops-sidebar">
        {!collapsed && (
          <button
            className="collapse-button"
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Recolher painel"
            title="Recolher painel"
          >
            ‹
          </button>
        )}
        <p className="eyebrow">Visão operacional</p>
        <h1>Importações</h1>

        {!user && (
          <div className="no-session-callout">
            <ShieldAlert size={16} />
            <div>
              <b>Sem sessão autenticada</b>
              <p>
                Nenhuma empresa selecionada. Conecte sua conta para visualizar a operação vinculada.
              </p>
              <button onClick={onOpenAuth} className="session-callout-btn">
                <LogIn size={13} /> Iniciar sessão
              </button>
            </div>
          </div>
        )}

        <div className="metrics">
          <MetricCard
            label="Ativos"
            detail={company ? `na empresa ${company}` : 'sem empresa ativa'}
            icon={Anchor}
            tone="#38BDF8"
          />
          <MetricCard
            label="Pendentes"
            detail="sem dados carregados"
            icon={BellRing}
            tone="#EC4899"
          />
          <MetricCard
            label="ETA nas próximas 72h"
            detail="rastreamento híbrido (06h/18h + exceções)"
            icon={ShipWheel}
            tone="#8B5CF6"
          />
        </div>
        <div className="audit-note">
          <ShieldCheck size={18} />
          <span>
            <b>Base limpa e auditável</b>
            <small>Contadores zerados até importar os dados oficiais homologados.</small>
          </span>
        </div>
        <h2>Etapas operacionais</h2>
        <ul className="stage-list">
          {OPERATIONAL_STAGES.map((stage) => (
            <li
              key={stage.code}
              className={filters.stage === stage.code ? 'selected-stage' : ''}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  stage: prev.stage === stage.code ? 'ALL' : stage.code,
                }))
              }}
              style={{ cursor: 'pointer' }}
              title={`Filtrar por etapa: ${stage.label}`}
            >
              <i style={{ background: stage.color }} />
              <span>{stage.label}</span>
              <b>0</b>
            </li>
          ))}
        </ul>
        <div className="monitoring">
          <h2>Monitoramento</h2>
          <p>
            Nenhum contêiner monitorado. Coordenadas só serão exibidas após validação por fonte de
            rastreamento.
          </p>
        </div>
      </aside>

      <div className="map-panel">
        {collapsed && (
          <button
            className="expand-sidebar-button"
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expandir painel"
            title="Expandir painel"
          >
            ›
          </button>
        )}
        <div className="map-tools" role="toolbar" aria-label="Controles do mapa">
          <button
            aria-label="Camadas do mapa"
            title="Camadas e estilos do mapa"
            className={`map-tool-btn ${layersOpen ? 'active' : ''}`}
            onClick={() => {
              setLayersOpen(!layersOpen)
              setFiltersOpen(false)
            }}
          >
            <Layers3 size={17} />
          </button>
          <button
            aria-label="Filtros do mapa"
            title="Filtrar por etapa, canal ou termo"
            className={`map-tool-btn ${filtersOpen ? 'active' : ''}`}
            onClick={() => {
              setFiltersOpen((v) => !v)
              setLayersOpen(false)
            }}
          >
            <Filter size={17} />
          </button>
          <button
            aria-label={
              cooldownRemaining > 0
                ? `Aguarde ${cooldownRemaining}s para atualizar`
                : 'Atualizar posições e rastreamento'
            }
            title={
              cooldownRemaining > 0
                ? `Cooldown ativo (${cooldownRemaining}s)`
                : 'Atualizar rastreamento (Manual)'
            }
            className={`map-tool-btn ${refreshing ? 'is-spinning' : ''} ${cooldownRemaining > 0 ? 'is-cooling' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing || cooldownRemaining > 0}
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {/* Popover de Camadas */}
        {layersOpen && (
          <div
            className="map-control-popover layers-popover"
            role="dialog"
            aria-label="Opções de Camadas"
          >
            <div className="popover-header">
              <Layers3 size={14} />
              <strong>Estilo da Camada</strong>
              <button className="popover-close" onClick={() => setLayersOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="popover-body">
              <label className="popover-option">
                <input
                  type="radio"
                  name="mapStyle"
                  checked={mapStyle === 'positron'}
                  onChange={() => setMapStyle('positron')}
                />
                <span>Positron (Padrão claro/cinza)</span>
              </label>
              <label className="popover-option">
                <input
                  type="radio"
                  name="mapStyle"
                  checked={mapStyle === 'dark'}
                  onChange={() => setMapStyle('dark')}
                />
                <span>Dark (Alto contraste)</span>
              </label>
              <label className="popover-option">
                <input
                  type="radio"
                  name="mapStyle"
                  checked={mapStyle === 'bright'}
                  onChange={() => setMapStyle('bright')}
                />
                <span>Bright (Colorido / Topográfico)</span>
              </label>
              <label className="popover-option">
                <input
                  type="radio"
                  name="mapStyle"
                  checked={mapStyle === 'liberty'}
                  onChange={() => setMapStyle('liberty')}
                />
                <span>Liberty (Rotas e relevo)</span>
              </label>
              <hr />
              <label className="popover-checkbox">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                <span>Exibir grade de coordenadas</span>
              </label>
              <label className="popover-checkbox">
                <input
                  type="checkbox"
                  checked={showLegends}
                  onChange={(e) => setShowLegends(e.target.checked)}
                />
                <span>Exibir legendas de status/canal</span>
              </label>
            </div>
          </div>
        )}

        {/* Popover de Filtros */}
        {filtersOpen && (
          <div
            className="map-control-popover filters-popover"
            role="dialog"
            aria-label="Filtros do Mapa"
          >
            <div className="popover-header">
              <Filter size={14} />
              <strong>Filtros Operacionais</strong>
              <button className="popover-close" onClick={() => setFiltersOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="popover-body">
              <div className="filter-group">
                <label>Etapa Operacional</label>
                <select
                  value={filters.stage}
                  onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
                >
                  <option value="ALL">Todas as etapas</option>
                  {OPERATIONAL_STAGES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Canal Aduaneiro</label>
                <select
                  value={filters.channel}
                  onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
                >
                  <option value="ALL">Todos os canais</option>
                  {CUSTOMS_CHANNEL_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Filtro por texto / contêiner</label>
                <input
                  type="text"
                  placeholder="Ex.: ABCU..."
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
              <div className="popover-actions">
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => setFilters({ stage: 'ALL', channel: 'ALL', search: '' })}
                >
                  Limpar
                </button>
                <button type="button" className="apply-btn" onClick={() => setFiltersOpen(false)}>
                  <Check size={13} /> Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        <MapSurface
          mapStyle={mapStyle}
          showGrid={showGrid}
          showLegends={showLegends}
          filters={filters}
          onRefresh={handleRefresh}
          lastRefreshedAt={lastRefreshedAt}
          syncStatusMessage={syncStatusMessage}
        />

        {showLegends && (
          <div className="legends">
            <div className="legend">
              <span>Status</span>
              {OPERATIONAL_STAGES.map((stage) => (
                <small key={stage.code}>
                  <i style={{ background: stage.color }} />
                  {stage.label}
                </small>
              ))}
            </div>
            <div className="legend">
              <span>Canal</span>
              {CUSTOMS_CHANNEL_OPTIONS.map((channel) => (
                <small key={channel.code}>
                  <i style={{ background: channel.color }} />
                  {channel.label}
                </small>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyPage({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: typeof Anchor
  eyebrow: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <section className="content-page">
      <header>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </header>
      <div className="empty-state">
        <span>
          <Icon size={26} />
        </span>
        <h2>Nenhum dado oficial carregado</h2>
        <p>
          Este ambiente permanece limpo até a importação controlada e auditável da base homologada.
        </p>
      </div>
    </section>
  )
}

function ImportsPage({
  company,
  user,
  onNew,
}: {
  company: CompanyName | null
  user: AuthUser | null
  onNew: () => void
}) {
  return (
    <EmptyPage
      icon={Container}
      eyebrow="Operação marítima"
      title={`Importações ${company ? `— ${company}` : '(sem empresa ativa)'}`}
      description="Gestão multiempresa de processos e contêineres com isolamento RLS."
    >
      <button className="page-action" onClick={onNew}>
        <Plus size={16} /> Nova importação
      </button>
    </EmptyPage>
  )
}

function ReportsPage({ company }: { company: CompanyName | null }) {
  return (
    <EmptyPage
      icon={BarChart3}
      eyebrow="Inteligência operacional"
      title={`Relatórios ${company ? `— ${company}` : '(sem empresa ativa)'}`}
      description="Volumes, lead times, canais aduaneiros e trilha de auditoria."
    />
  )
}

function SettingsPage({
  theme,
  setTheme,
  user,
  company,
  onOpenAuth,
  onLogout,
}: {
  theme: Theme
  setTheme: (theme: Theme) => void
  user: AuthUser | null
  company: CompanyName | null
  onOpenAuth: () => void
  onLogout: () => void
}) {
  return (
    <section className="content-page settings-page">
      <header>
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Configurações</h1>
          <p>Preferências locais, autenticação e preparação do ambiente de homologação.</p>
        </div>
      </header>
      <div className="settings-grid">
        <article>
          <SlidersHorizontal />
          <div>
            <h2>Aparência</h2>
            <p>Selecione uma paleta para a interface.</p>
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              <option value="dark">Escuro industrial</option>
              <option value="light">Claro</option>
              <option value="violet">Violeta</option>
              <option value="ocean">Oceano</option>
              <option value="graphite">Grafite</option>
              <option value="amber">Âmbar</option>
            </select>
          </div>
        </article>
        <article>
          <ShieldCheck />
          <div>
            <h2>Supabase / RLS</h2>
            <p>Não conectado. Aguardando projeto exclusivo de homologação.</p>
            <span className="status-pill">Configuração pendente</span>
          </div>
        </article>
        <article>
          <CircleUserRound />
          <div>
            <h2>Sessão do Usuário</h2>
            {user ? (
              <div>
                <p>
                  Autenticado como <b>{user.name}</b> ({user.email}).
                  <br />
                  Empresa ativa: <b>{company}</b> ({user.role})
                </p>
                <button className="session-action-btn logout-btn" onClick={onLogout}>
                  <LogOut size={14} /> Encerrar sessão
                </button>
              </div>
            ) : (
              <div>
                <p>Nenhuma sessão autenticada. A empresa ativa permanece desmarcada.</p>
                <button className="session-action-btn" onClick={onOpenAuth}>
                  <LogIn size={14} /> Iniciar sessão
                </button>
              </div>
            )}
          </div>
        </article>
        <article>
          <Globe2 />
          <div>
            <h2>Política de Rastreamento</h2>
            <p>
              Modo híbrido (janelas padrão 06h / 18h) com cadência de 60min para exceções críticas.
              Cooldown manual de 60 segundos.
            </p>
            <span className="status-pill active">Cooldown ativo: 60s</span>
          </div>
        </article>
      </div>
    </section>
  )
}

function NotFound() {
  return (
    <section className="content-page">
      <div className="empty-state">
        <Anchor />
        <h1>Rota não encontrada</h1>
        <NavLink to="/dashboard">Voltar ao mapa operacional</NavLink>
      </div>
    </section>
  )
}

function AuthModal({ close, onLogin }: { close: () => void; onLogin: (user: AuthUser) => void }) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    if (!hasGoogleOAuthConfig || !supabase) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) {
        setErrorMessage(error.message)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar fluxo Google OAuth'
      setErrorMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="modal-close" onClick={close} aria-label="Fechar modal de autenticação">
          <X size={18} />
        </button>
        <p className="eyebrow">Acesso Seguro</p>
        <h2 id="auth-modal-title">Autenticação Google OAuth</h2>
        <p>
          Acesso exclusivo corporativo via Google OAuth. O perfil de acesso e a empresa vinculada
          são determinados estritamente pelo backend via RLS (auth.uid() e company_memberships).
        </p>

        <div className="oauth-container">
          {hasGoogleOAuthConfig ? (
            <button
              className="google-oauth-btn primary-action"
              onClick={handleGoogleSignIn}
              disabled={loading}
              aria-label="Entrar com Google"
            >
              <LogIn size={16} />
              {loading ? 'Redirecionando...' : 'Continuar com Google'}
            </button>
          ) : (
            <div
              className="oauth-disabled-box"
              role="region"
              aria-label="Status de configuração OAuth"
            >
              <button
                className="google-oauth-btn is-disabled"
                disabled
                aria-disabled="true"
                aria-describedby="oauth-disabled-reason"
              >
                <LogIn size={16} /> Continuar com Google
              </button>
              <p id="oauth-disabled-reason" className="oauth-disabled-reason" role="status">
                Google OAuth não configurado
              </p>
              <small className="oauth-disabled-detail">
                O provedor Google OAuth requer conexão ao Supabase homologado. Nenhum perfil ou
                empresa pode ser selecionado manualmente na interface.
              </small>
            </div>
          )}

          {errorMessage && (
            <div className="form-message" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={close}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewImportModal({
  close,
  company,
  user,
}: {
  close: () => void
  company: string
  user: AuthUser
}) {
  const [containerCode, setContainerCode] = useState('')
  const [internalReference, setInternalReference] = useState('')
  const [importerName, setImporterName] = useState(company)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!isValidIso6346(containerCode)) {
      return setMessage('Informe um contêiner válido no padrão ISO 6346.')
    }
    if (!internalReference.trim() || !importerName.trim()) {
      return setMessage('Informe a referência interna e o importador.')
    }

    if (!hasSupabaseConfig || !supabase) {
      return setMessage('Backend não configurado — nenhum dado foi gravado.')
    }

    setSaving(true)
    try {
      const { error } = await supabase.rpc('create_import_with_container', {
        p_company_id: user.companyId,
        p_internal_reference: internalReference.trim(),
        p_importer_name: importerName.trim(),
        p_container_number: normalizeContainerCode(containerCode),
      })

      if (error) {
        setMessage(`Erro ao salvar: ${error.message}`)
      } else {
        setMessage('Importação cadastrada com sucesso.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na comunicação'
      setMessage(`Falha: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-import-title">
        <button className="modal-close" onClick={close} aria-label="Fechar modal">
          <X size={18} />
        </button>
        <p className="eyebrow">Cadastro controlado</p>
        <h2 id="new-import-title">Nova importação</h2>
        <p>
          Empresa vinculada: <b>{company}</b> (operador: {user.name}). A gravação ocorre diretamente
          no Supabase HML e é protegida pelo RLS da empresa ativa.
        </p>
        <form onSubmit={submit}>
          <label>
            Referência interna
            <input
              value={internalReference}
              onChange={(event) => {
                setInternalReference(event.target.value)
                setMessage('')
              }}
              placeholder="IMP-2026-0001"
              maxLength={120}
              autoFocus
              required
            />
          </label>
          <label>
            Importador
            <input
              value={importerName}
              onChange={(event) => {
                setImporterName(event.target.value)
                setMessage('')
              }}
              placeholder="Razão social do importador"
              maxLength={200}
              required
            />
          </label>
          <label>
            Número do contêiner
            <input
              value={containerCode}
              onChange={(event) => {
                setContainerCode(normalizeContainerCode(event.target.value))
                setMessage('')
              }}
              placeholder="CSQU3054383"
              maxLength={11}
            />
            <small>Formato ISO 6346 com dígito verificador.</small>
          </label>
          {message && (
            <div
              className={
                message.startsWith('Importação cadastrada')
                  ? 'form-message success'
                  : 'form-message'
              }
              role="alert"
            >
              {message}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" onClick={close}>
              Cancelar
            </button>
            <button className="primary-action" type="submit" disabled={saving}>
              <FileCheck2 size={16} /> {saving ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
