export const IMPORT_STAGES = {
  IMPORT_STARTED: { label: "Início da importação", color: "#38BDF8", order: 1 },
  IN_TRANSIT: { label: "Em andamento", color: "#8B5CF6", order: 2 },
  PENDING: { label: "Pendente", color: "#EC4899", order: 3 },
  COMPLETED: { label: "Concluído", color: "#14B8A6", order: 4 },
} as const;

export const OPERATIONAL_STAGES = [
  { code: "IMPORT_STARTED", ...IMPORT_STAGES.IMPORT_STARTED },
  { code: "IN_TRANSIT", ...IMPORT_STAGES.IN_TRANSIT },
  { code: "PENDING", ...IMPORT_STAGES.PENDING },
  { code: "COMPLETED", ...IMPORT_STAGES.COMPLETED },
] as const;

export const CUSTOMS_CHANNELS = {
  NOT_ASSIGNED: { label: "Não parametrizado", color: "#64748B" },
  GREEN: { label: "Verde", color: "#008000" },
  YELLOW: { label: "Amarelo", color: "#FFFF00" },
  RED: { label: "Vermelho", color: "#FF0000" },
  GRAY: { label: "Cinza", color: "#808080" },
} as const;

export const CUSTOMS_CHANNEL_OPTIONS = [
  { code: "NOT_ASSIGNED", ...CUSTOMS_CHANNELS.NOT_ASSIGNED },
  { code: "GREEN", ...CUSTOMS_CHANNELS.GREEN },
  { code: "YELLOW", ...CUSTOMS_CHANNELS.YELLOW },
  { code: "RED", ...CUSTOMS_CHANNELS.RED },
  { code: "GRAY", ...CUSTOMS_CHANNELS.GRAY },
] as const;

export const PRODUCT = {
  name: "Comex Control",
  purpose: "Gestão multiempresa de importações marítimas com rastreamento híbrido e auditoria",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
} as const;

export const COMPANIES = ["QUALLY", "PDA", "SAFRA", "GOGA"] as const;

export interface UserSessionProfile {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "OPERATOR" | "AUDITOR" | "VIEWER";
  company: string;
  companyId: string;
}

export const ROLE_PERMISSIONS = {
  OWNER: ["IMPORTS_READ", "IMPORTS_WRITE", "TRACKING_REFRESH", "CUSTOMS_CHANNEL_WRITE", "AUDIT_READ", "REPORTS_GENERATE", "MEMBERS_MANAGE"],
  ADMIN: ["IMPORTS_READ", "IMPORTS_WRITE", "TRACKING_REFRESH", "CUSTOMS_CHANNEL_WRITE", "AUDIT_READ", "REPORTS_GENERATE", "MEMBERS_MANAGE_WITHOUT_OWNER"],
  AUDITOR: ["IMPORTS_READ", "AUDIT_READ", "REPORTS_GENERATE"],
  OPERATOR: ["IMPORTS_READ", "IMPORTS_WRITE", "TRACKING_REFRESH", "CUSTOMS_CHANNEL_WRITE"],
  VIEWER: ["IMPORTS_READ"],
} as const;

export const CARRIERS = [
  "MAERSK", "CMA_CGM", "MSC", "HAPAG_LLOYD", "ONE", "EVERGREEN", "COSCO",
  "OOCL", "ZIM", "YANG_MING", "PIL", "HMM", "WAN_HAI", "OTHER",
] as const;

export type ImportStage = keyof typeof IMPORT_STAGES;
export type CustomsChannel = keyof typeof CUSTOMS_CHANNELS;
export type CompanyRole = keyof typeof ROLE_PERMISSIONS;

export const TRACKING_POLICY = {
  mode: "HYBRID",
  timezone: "America/Sao_Paulo",
  sweepHours: [6, 18],
  criticalEtaHours: 72,
  manualCooldownSeconds: 60,
} as const;

export type TrackingPolicyInput = {
  stage?: ImportStage | null;
  customsChannel?: CustomsChannel | null;
  eta?: string | null;
};

export function trackingCadence(input: TrackingPolicyInput, now = Date.now()) {
  if (input.stage === "COMPLETED") return { tier: "STOPPED", label: "Concluído · sem consultas automáticas", reason: "Importação concluída" } as const;
  if (input.stage === "PENDING") return { tier: "CRITICAL", label: "Prioritário · a cada hora", reason: "Pendência operacional" } as const;
  if (input.customsChannel === "RED" || input.customsChannel === "GRAY") return { tier: "CRITICAL", label: "Prioritário · a cada hora", reason: "Canal aduaneiro crítico" } as const;
  const eta = input.eta ? Date.parse(input.eta) : Number.NaN;
  if (Number.isFinite(eta) && eta <= now + TRACKING_POLICY.criticalEtaHours * 3_600_000) {
    return { tier: "CRITICAL", label: "Prioritário · a cada hora", reason: eta < now ? "ETA vencido; confirmar chegada" : "ETA nas próximas 72 horas" } as const;
  }
  return { tier: "STANDARD", label: "Padrão · 06h e 18h", reason: "Acompanhamento duas vezes ao dia" } as const;
}
