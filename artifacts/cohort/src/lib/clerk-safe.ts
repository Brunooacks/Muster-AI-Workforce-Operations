import { useClerk, useOrganization, useUser } from "@clerk/react";

/**
 * O build de demonstração não monta o ClerkProvider. Sem isso, telas que
 * consultam o usuário derrubam a página inteira. Aqui o hook é chamado sempre
 * (mesma ordem de hooks) e a ausência de contexto vira estado vazio.
 */
export function useUserSeguro(): { user: ReturnType<typeof useUser>["user"]; isLoaded: boolean } {
  try {
    const { user, isLoaded } = useUser();
    return { user, isLoaded };
  } catch {
    return { user: null, isLoaded: true };
  }
}

export function useIdentidadeSegura(): { userId?: string; orgId?: string } {
  try {
    const { user } = useUser();
    const { organization } = useOrganization();
    return { userId: user?.id, orgId: organization?.id };
  } catch {
    return {};
  }
}

/** Ações de conta do Clerk; no demo viram no-op e `disponivel` fica falso. */
export function useAcoesClerkSeguras(): {
  disponivel: boolean;
  openUserProfile: () => void;
  openOrganizationProfile: () => void;
} {
  try {
    const clerk = useClerk();
    return {
      disponivel: true,
      openUserProfile: () => clerk.openUserProfile(),
      openOrganizationProfile: () => clerk.openOrganizationProfile(),
    };
  } catch {
    return { disponivel: false, openUserProfile: () => {}, openOrganizationProfile: () => {} };
  }
}

/**
 * RG-M13: Organizations está desligado na instância Clerk do Muster. O
 * <OrganizationSwitcher> consulta /v1/me/organization_memberships e recebe 403.
 * Só renderiza quando o build liga VITE_CLERK_ORGANIZATIONS=1.
 */
export const CLERK_ORGANIZACOES = String(import.meta.env?.VITE_CLERK_ORGANIZATIONS ?? "") === "1";
