import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/react";

/**
 * Conta exibida no shell (avatar, nome, sair). Em modo demonstração não há
 * Clerk nem API: o contexto cai nos valores de exemplo em vez de quebrar.
 */
export type Conta = {
  nome: string;
  iniciais: string;
  sair: () => void;
};

const CONTA_DEMO: Conta = {
  nome: "Marina Alves",
  iniciais: "MA",
  sair: () => {
    window.location.href = import.meta.env.BASE_URL || "/";
  },
};

const ContaContext = createContext<Conta>(CONTA_DEMO);

export function useConta(): Conta {
  return useContext(ContaContext);
}

function ContaClerk({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const conta = useMemo<Conta>(() => {
    const nome =
      user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || "Conta";
    const iniciais =
      nome
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte[0]?.toUpperCase())
        .join("") || "US";
    return {
      nome,
      iniciais,
      sair: () => void signOut({ redirectUrl: import.meta.env.BASE_URL || "/" }),
    };
  }, [signOut, user]);
  return <ContaContext.Provider value={conta}>{children}</ContaContext.Provider>;
}

export function ContaBoundary({ demo, children }: { demo: boolean; children: ReactNode }) {
  if (demo) return <ContaContext.Provider value={CONTA_DEMO}>{children}</ContaContext.Provider>;
  return <ContaClerk>{children}</ContaClerk>;
}
