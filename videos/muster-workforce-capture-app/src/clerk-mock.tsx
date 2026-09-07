import type { ReactNode } from "react";

const user = {
  fullName: "Bruno Oliveira",
  firstName: "Bruno",
  primaryEmailAddress: { emailAddress: "bruno@muster.local" },
  update: async () => user,
};

const organization = {
  id: "muster-demo",
  name: "Muster Labs",
  slug: "muster-labs",
  membersCount: 1,
  imageUrl: null,
};

export function useClerk() {
  return { signOut: async () => undefined };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user };
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    orgId: "muster-demo",
    userId: "bruno-demo",
    getToken: async () => null,
  };
}

export function useOrganization() {
  return {
    isLoaded: true,
    organization,
    membership: { role: "org:admin" },
  };
}

export function OrganizationSwitcher({ children }: { children?: ReactNode }) {
  return children ?? null;
}
