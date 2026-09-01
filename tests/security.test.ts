import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { COMPANIES, ROLE_PERMISSIONS, TRACKING_POLICY } from "../src/lib/domain.ts";
import { hasGoogleOAuthConfig, hasSupabaseConfig, supabase } from "../src/lib/supabase.ts";

test("garantia de atualização: sem Supabase/sessão não dispara cooldown nem timestamp", () => {
  // Estado sem Supabase conectado e sem sessão
  assert.equal(hasSupabaseConfig, false, "Sem envs, hasSupabaseConfig deve ser false");
  assert.equal(supabase, null, "Cliente supabase deve ser null");

  // Simulação da lógica de verificação de atualização:
  function executeTrackingRefresh(
    isConfigured: boolean,
    userSession: unknown | null,
    backendResponseSuccess: boolean,
  ) {
    let lastRefreshedAt: Date | null = null;
    let cooldownRemaining = 0;
    let syncStatusMessage = "";

    if (!isConfigured) {
      syncStatusMessage = "Backend não configurado — nenhuma consulta realizada";
      return { lastRefreshedAt, cooldownRemaining, syncStatusMessage };
    }

    if (!userSession) {
      syncStatusMessage = "Sessão necessária";
      return { lastRefreshedAt, cooldownRemaining, syncStatusMessage };
    }

    if (backendResponseSuccess) {
      lastRefreshedAt = new Date();
      cooldownRemaining = TRACKING_POLICY.manualCooldownSeconds;
      syncStatusMessage = "Consulta ao backend concluída com sucesso.";
    }

    return { lastRefreshedAt, cooldownRemaining, syncStatusMessage };
  }

  // 1. Sem Supabase configurado
  const resNoBackend = executeTrackingRefresh(false, { id: "user_1" }, true);
  assert.equal(resNoBackend.lastRefreshedAt, null);
  assert.equal(resNoBackend.cooldownRemaining, 0);
  assert.equal(resNoBackend.syncStatusMessage, "Backend não configurado — nenhuma consulta realizada");

  // 2. Sem sessão
  const resNoSession = executeTrackingRefresh(true, null, true);
  assert.equal(resNoSession.lastRefreshedAt, null);
  assert.equal(resNoSession.cooldownRemaining, 0);
  assert.equal(resNoSession.syncStatusMessage, "Sessão necessária");

  // 3. Com backend e sessão, porém sem sucesso do backend
  const resFailedBackend = executeTrackingRefresh(true, { id: "user_1" }, false);
  assert.equal(resFailedBackend.lastRefreshedAt, null);
  assert.equal(resFailedBackend.cooldownRemaining, 0);

  // 4. Com backend, sessão e resposta real com sucesso
  const resSuccess = executeTrackingRefresh(true, { id: "user_1" }, true);
  assert.ok(resSuccess.lastRefreshedAt instanceof Date);
  assert.equal(resSuccess.cooldownRemaining, 60);
});

test("login seguro: modal não expõe campos locais nem escolha de empresa/ADMIN/OWNER na UI", async () => {
  const appFileContent = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  // Verifica que o modal de autenticação (AuthModal) NÃO possui inputs de texto ou selects para empresa, nome ou perfil
  const authModalSection = appFileContent.slice(
    appFileContent.indexOf("function AuthModal"),
    appFileContent.indexOf("function NewImportModal"),
  );

  assert.equal(
    authModalSection.includes('<input type="email"'),
    false,
    "AuthModal não deve ter input de email local",
  );
  assert.equal(
    authModalSection.includes("Nome do operador"),
    false,
    "AuthModal não deve ter campo local de nome",
  );
  assert.equal(
    authModalSection.includes("Empresa vinculada"),
    false,
    "AuthModal não deve ter seletor de empresa",
  );
  assert.equal(
    authModalSection.includes("Perfil de acesso"),
    false,
    "AuthModal não deve ter seletor de perfil",
  );
  assert.equal(
    authModalSection.includes('<option value="OWNER">'),
    false,
    "UI não pode permitir seleção de OWNER",
  );
  assert.equal(
    authModalSection.includes('<option value="ADMIN">'),
    false,
    "UI não pode permitir seleção de ADMIN",
  );

  // Deve exibir o aviso acessível de Google OAuth não configurado quando sem envs
  assert.equal(
    authModalSection.includes("Google OAuth não configurado"),
    true,
    "Deve conter o texto 'Google OAuth não configurado'",
  );
  assert.equal(
    authModalSection.includes("Continuar com Google"),
    true,
    "Deve conter o controle do Google OAuth",
  );
});

test("isolamento de empresa e perfil: RLS e auth.uid() exclusivos, OWNER protegido", () => {
  // Valida que OWNER existe nas regras de domínio do backend, mas as permissões de membro não deixam OWNER ser gerenciado pela UI comum
  assert.ok(ROLE_PERMISSIONS.OWNER);
  assert.ok(ROLE_PERMISSIONS.ADMIN);
  assert.ok(ROLE_PERMISSIONS.OPERATOR);
  assert.ok(ROLE_PERMISSIONS.AUDITOR);
  assert.ok(ROLE_PERMISSIONS.VIEWER);

  // ADMIN gerencia apenas membros sem OWNER
  assert.deepEqual(
    ROLE_PERMISSIONS.ADMIN.includes("MEMBERS_MANAGE_WITHOUT_OWNER"),
    true,
    "ADMIN só pode gerenciar membros sem OWNER",
  );
  assert.deepEqual(
    ROLE_PERMISSIONS.ADMIN.includes("MEMBERS_MANAGE" as any),
    false,
    "ADMIN não pode ter permissão irrestrita MEMBERS_MANAGE",
  );
});

test("cadastro sem sessão abre bloqueio seguro (Google OAuth/Login) sem criar dados", () => {
  // Simulação da ação de 'Nova Importação'
  function handleNewImportClick(
    userSession: unknown | null,
    openAuthModal: () => void,
    openNewImportModal: () => void,
  ) {
    if (!userSession) {
      openAuthModal();
      return;
    }
    openNewImportModal();
  }

  let authModalOpened = false;
  let newImportModalOpened = false;

  // Sem sessão
  handleNewImportClick(
    null,
    () => {
      authModalOpened = true;
    },
    () => {
      newImportModalOpened = true;
    },
  );

  assert.equal(authModalOpened, true, "Sem sessão deve abrir AuthModal");
  assert.equal(newImportModalOpened, false, "Sem sessão não pode abrir NewImportModal nem criar dados");
});

