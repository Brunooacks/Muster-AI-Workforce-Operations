import { useMemo, useState } from "react";
import { useOrganization } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  AlertCircle,
  Building2,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { AgentDisc, Eyebrow, Pill } from "@/components/cohort";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type OrganizationRole = "owner" | "admin" | "member";
type ScopeType = "organization" | "area" | "team";

interface AccessControlMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  createdAt: string;
}

interface AccessControlPreset {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface AccessControlGroup {
  id: string;
  name: string;
  description: string;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeLabel: string;
  permissions: string[];
  memberCount: number;
  members: AccessControlMember[];
  createdAt: string;
  updatedAt: string;
}

interface AccessControlOverview {
  currentUser: {
    userId: string;
    orgRole: OrganizationRole;
    permissions: string[];
  };
  presets: AccessControlPreset[];
  groups: AccessControlGroup[];
  scopes: {
    areas: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string }>;
  };
}

interface ClerkMemberView {
  membershipId: string;
  userId: string | null;
  name: string;
  email: string | null;
  providerRole: string;
}

interface GroupFormState {
  id?: string;
  name: string;
  description: string;
  presetId: string;
  scopeType: ScopeType;
  scopeId: string;
  permissions: string[];
}

interface MemberAssignmentState {
  groupId: string;
  userId: string;
}

const OVERVIEW_QUERY_KEY = ["access-control", "overview"] as const;

const EMPTY_GROUP_FORM: GroupFormState = {
  name: "",
  description: "",
  presetId: "",
  scopeType: "organization",
  scopeId: "",
  permissions: [],
};

const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

const SCOPE_LABELS: Record<ScopeType, string> = {
  organization: "Organização inteira",
  area: "Área",
  team: "Equipe",
};

const PERMISSION_LABELS: Record<string, string> = {
  "agents:read": "Visualizar agentes",
  "agents:operate": "Operar agentes",
  "teams:manage": "Gerenciar equipes",
  "journeys:manage": "Gerenciar jornadas",
  "decisions:approve": "Aprovar decisões",
  "governance:manage": "Administrar governança",
  "reports:read": "Visualizar relatórios",
  "connectors:manage": "Gerenciar conectores",
  "members:manage": "Gerenciar membros",
};

function permissionLabel(permission: string): string {
  if (PERMISSION_LABELS[permission]) return PERMISSION_LABELS[permission];
  return permission
    .split(":")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

function providerRoleLabel(role: string, roleName: string): string {
  if (roleName) return roleName;
  if (role === "org:admin") return "Administrador";
  if (role === "org:member") return "Membro";
  return role.replace(/^org:/, "").replaceAll("_", " ");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function requestJson<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<T> {
  return customFetch<T>(path, {
    method: options.method,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    responseType: "json",
  });
}

async function requestDelete(path: string): Promise<void> {
  await customFetch(path, {
    method: "DELETE",
    credentials: "include",
    responseType: "text",
  });
}

function GroupFormDialog({
  form,
  overview,
  isPending,
  onChange,
  onClose,
  onSubmit,
}: {
  form: GroupFormState;
  overview: AccessControlOverview;
  isPending: boolean;
  onChange: (form: GroupFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const permissionOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...overview.presets.flatMap((preset) => preset.permissions),
          ...form.permissions,
        ]),
      ).sort((left, right) => permissionLabel(left).localeCompare(permissionLabel(right), "pt-BR")),
    [form.permissions, overview.presets],
  );

  const availableScopes =
    form.scopeType === "area"
      ? overview.scopes.areas
      : form.scopeType === "team"
        ? overview.scopes.teams
        : [];
  const scopeIsValid = form.scopeType === "organization" || Boolean(form.scopeId);
  const canSubmit = Boolean(form.name.trim()) && form.permissions.length > 0 && scopeIsValid;

  function applyPreset(preset: AccessControlPreset) {
    onChange({
      ...form,
      name: form.id ? form.name : preset.name,
      description: form.id ? form.description : preset.description,
      presetId: preset.id,
      permissions: preset.permissions,
    });
  }

  function togglePermission(permission: string, checked: boolean) {
    onChange({
      ...form,
      permissions: checked
        ? Array.from(new Set([...form.permissions, permission]))
        : form.permissions.filter((item) => item !== permission),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar grupo de acesso" : "Criar grupo de acesso"}</DialogTitle>
          <DialogDescription>
            Combine um papel pronto com o escopo em que as permissões serão válidas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {overview.presets.length > 0 && (
            <div className="space-y-2">
              <Label>Comece por um papel</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {overview.presets.map((preset) => {
                  const selected = form.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/8 ring-1 ring-primary/20"
                          : "border-card-border bg-secondary/20 hover:bg-secondary/50",
                      )}
                    >
                      <div className="text-sm font-medium text-foreground">{preset.name}</div>
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {preset.description}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {preset.permissions.length} permissões
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access-group-name">Nome do grupo</Label>
              <Input
                id="access-group-name"
                value={form.name}
                onChange={(event) => onChange({ ...form, name: event.target.value })}
                placeholder="Ex.: Supervisores de suporte"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-group-scope">Escopo</Label>
              <Select
                value={form.scopeType}
                onValueChange={(value: ScopeType) =>
                  onChange({ ...form, scopeType: value, scopeId: "" })
                }
              >
                <SelectTrigger id="access-group-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organização inteira</SelectItem>
                  <SelectItem value="area">Uma área</SelectItem>
                  <SelectItem value="team">Uma equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.scopeType !== "organization" && (
            <div className="space-y-2">
              <Label htmlFor="access-group-scope-value">
                {form.scopeType === "area" ? "Área permitida" : "Equipe permitida"}
              </Label>
              <Select
                value={form.scopeId}
                onValueChange={(scopeId) => onChange({ ...form, scopeId })}
              >
                <SelectTrigger id="access-group-scope-value">
                  <SelectValue placeholder={`Selecione ${form.scopeType === "area" ? "uma área" : "uma equipe"}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableScopes.map((scope) => (
                    <SelectItem key={scope.id} value={scope.id}>
                      {scope.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableScopes.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhum escopo desse tipo está disponível. Cadastre-o antes de salvar o grupo.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="access-group-description">Descrição</Label>
            <Textarea
              id="access-group-description"
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder="Explique a responsabilidade e os limites deste grupo."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Permissões</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                O backend aplicará estas permissões somente dentro do escopo escolhido.
              </p>
            </div>
            {permissionOptions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {permissionOptions.map((permission) => {
                  const checked = form.permissions.includes(permission);
                  return (
                    <label
                      key={permission}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-card-border bg-secondary/20 p-3"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => togglePermission(permission, value === true)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {permissionLabel(permission)}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          {permission}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted-foreground">
                Nenhuma permissão foi disponibilizada pelo servidor.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {form.id ? "Salvar alterações" : "Criar grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberAssignmentDialog({
  state,
  groups,
  members,
  isPending,
  onChange,
  onClose,
  onSubmit,
}: {
  state: MemberAssignmentState | null;
  groups: AccessControlGroup[];
  members: ClerkMemberView[];
  isPending: boolean;
  onChange: (state: MemberAssignmentState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!state) return null;

  const selectedGroup = groups.find((group) => group.id === state.groupId);
  const eligibleMembers = members.filter(
    (member) =>
      member.userId && !selectedGroup?.members.some((groupMember) => groupMember.userId === member.userId),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir membro a um grupo</DialogTitle>
          <DialogDescription>
            O membro recebe as permissões do grupo somente no escopo configurado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="assignment-group">Grupo de acesso</Label>
            <Select
              value={state.groupId}
              onValueChange={(groupId) => {
                const group = groups.find((item) => item.id === groupId);
                const userAlreadyAssigned = group?.members.some(
                  (member) => member.userId === state.userId,
                );
                onChange({ groupId, userId: userAlreadyAssigned ? "" : state.userId });
              }}
            >
              <SelectTrigger id="assignment-group">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name} · {group.scopeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-member">Membro da organização</Label>
            <Select
              value={state.userId}
              onValueChange={(userId) => onChange({ ...state, userId })}
              disabled={!state.groupId || eligibleMembers.length === 0}
            >
              <SelectTrigger id="assignment-member">
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMembers.map((member) => (
                  <SelectItem key={member.membershipId} value={member.userId!}>
                    {member.name}{member.email ? ` · ${member.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.groupId && eligibleMembers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Todos os membros carregados já pertencem a este grupo.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!state.groupId || !state.userId || isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Atribuir membro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccessControlPanel({ onInvite }: { onInvite: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization, memberships, isLoaded: clerkIsLoaded } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true, pageSize: 100 },
  });
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [assignment, setAssignment] = useState<MemberAssignmentState | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<AccessControlGroup | null>(null);

  const overviewQuery = useQuery({
    queryKey: [...OVERVIEW_QUERY_KEY, organization?.id],
    queryFn: () => requestJson<AccessControlOverview>("/api/access-control/overview"),
    enabled: clerkIsLoaded && Boolean(organization),
    retry: false,
  });

  const overview = overviewQuery.data;
  const canManage = overview?.currentUser.orgRole === "owner" || overview?.currentUser.orgRole === "admin";

  const clerkMembers = useMemo<ClerkMemberView[]>(
    () =>
      (memberships?.data ?? []).map((membership) => {
        const publicUser = membership.publicUserData;
        const name = [publicUser?.firstName, publicUser?.lastName].filter(Boolean).join(" ");
        return {
          membershipId: membership.id,
          userId: publicUser?.userId ?? null,
          name: name || publicUser?.username || publicUser?.identifier || "Usuário",
          email: publicUser?.identifier ?? null,
          providerRole: providerRoleLabel(membership.role, membership.roleName),
        };
      }),
    [memberships?.data],
  );

  const invalidateOverview = () =>
    queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });

  const saveGroup = useMutation({
    mutationFn: async (form: GroupFormState) => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        scopeType: form.scopeType,
        scopeId: form.scopeType === "organization" ? null : form.scopeId,
        permissions: form.permissions,
      };
      return form.id
        ? requestJson<AccessControlGroup>(`/api/access-control/groups/${encodeURIComponent(form.id)}`, {
            method: "PATCH",
            body: payload,
          })
        : requestJson<AccessControlGroup>("/api/access-control/groups", {
            method: "POST",
            body: payload,
          });
    },
    onSuccess: async (_, form) => {
      await invalidateOverview();
      setGroupForm(null);
      toast({ title: form.id ? "Grupo atualizado" : "Grupo criado" });
    },
    onError: (error) =>
      toast({
        title: "Não foi possível salvar o grupo",
        description: errorMessage(error, "Revise os dados e tente novamente."),
        variant: "destructive",
      }),
  });

  const deleteGroup = useMutation({
    mutationFn: (groupId: string) =>
      requestDelete(`/api/access-control/groups/${encodeURIComponent(groupId)}`),
    onSuccess: async () => {
      await invalidateOverview();
      setGroupToDelete(null);
      toast({ title: "Grupo removido" });
    },
    onError: (error) =>
      toast({
        title: "Não foi possível remover o grupo",
        description: errorMessage(error, "Tente novamente."),
        variant: "destructive",
      }),
  });

  const addMember = useMutation({
    mutationFn: async (state: MemberAssignmentState) => {
      const member = clerkMembers.find((item) => item.userId === state.userId);
      if (!member) throw new Error("Membro não encontrado na organização ativa.");
      return requestJson<AccessControlMember>(
        `/api/access-control/groups/${encodeURIComponent(state.groupId)}/members`,
        {
          method: "POST",
          body: { userId: state.userId, userName: member.name, userEmail: member.email },
        },
      );
    },
    onSuccess: async () => {
      await invalidateOverview();
      setAssignment(null);
      toast({ title: "Membro atribuído ao grupo" });
    },
    onError: (error) =>
      toast({
        title: "Não foi possível atribuir o membro",
        description: errorMessage(error, "Tente novamente."),
        variant: "destructive",
      }),
  });

  const removeMember = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      requestDelete(
        `/api/access-control/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      ),
    onSuccess: async () => {
      await invalidateOverview();
      toast({ title: "Acesso do membro removido" });
    },
    onError: (error) =>
      toast({
        title: "Não foi possível remover o acesso",
        description: errorMessage(error, "Tente novamente."),
        variant: "destructive",
      }),
  });

  function openCreateGroup() {
    const firstPreset = overview?.presets[0];
    setGroupForm(
      firstPreset
        ? {
            ...EMPTY_GROUP_FORM,
            name: firstPreset.name,
            description: firstPreset.description,
            presetId: firstPreset.id,
            permissions: firstPreset.permissions,
          }
        : { ...EMPTY_GROUP_FORM },
    );
  }

  function openEditGroup(group: AccessControlGroup) {
    setGroupForm({
      id: group.id,
      name: group.name,
      description: group.description,
      presetId: "",
      scopeType: group.scopeType,
      scopeId: group.scopeId ?? "",
      permissions: group.permissions,
    });
  }

  function openAssignment(groupId = "", userId = "") {
    setAssignment({ groupId, userId });
  }

  if (clerkIsLoaded && !organization) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Nenhuma organização ativa</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Selecione uma organização no Clerk para carregar membros, grupos e permissões.
            </p>
          </div>
          <Button variant="outline" onClick={onInvite}>Abrir organizações</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>Organização ativa</Eyebrow>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-secondary/50">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {organization?.name ?? "Carregando organização"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Identidades pelo Clerk · acessos operacionais pelo Muster
                  </div>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onInvite}
              disabled={!canManage}
              title={!canManage ? "Apenas proprietários e administradores podem convidar" : undefined}
            >
              <UserPlus />
              Convidar membro
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <Eyebrow>Seu acesso</Eyebrow>
          {overviewQuery.isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : overview ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={canManage ? "sage" : "blue"}>
                  {ROLE_LABELS[overview.currentUser.orgRole]}
                </Pill>
                <span className="text-xs text-muted-foreground">
                  {overview.currentUser.permissions.length} permissões efetivas
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {canManage
                  ? "Você pode criar grupos, definir escopos e atribuir membros."
                  : "Acesso de leitura. Alterações exigem proprietário ou administrador."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Aguardando o contrato de acesso.</p>
          )}
        </Card>
      </div>

      {overviewQuery.isError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Não foi possível carregar grupos e permissões</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage(overviewQuery.error, "Verifique a API de controle de acesso.")}</span>
            <Button size="sm" variant="outline" onClick={() => overviewQuery.refetch()}>
              <RefreshCw />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-card-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>Membros da organização</Eyebrow>
            <p className="mt-1 text-xs text-muted-foreground">
              Papel do provedor e grupos operacionais aplicados a cada pessoa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="muted">{memberships?.count ?? clerkMembers.length} membros</Pill>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openAssignment()}
              disabled={!canManage || !overview?.groups.length || clerkMembers.length === 0}
            >
              <UserPlus />
              Atribuir grupo
            </Button>
          </div>
        </div>

        {!clerkIsLoaded || memberships?.isLoading ? (
          <div className="divide-y divide-card-border">
            {[1, 2, 3].map((item) => (
              <div key={item} className="px-5 py-4">
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        ) : memberships?.isError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Falha ao carregar membros do Clerk</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {memberships.error?.message ?? "Abra o painel da organização para revisar o acesso."}
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => memberships.revalidate()}>
              <RefreshCw />
              Recarregar membros
            </Button>
          </div>
        ) : clerkMembers.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <UsersRound className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Nenhum membro encontrado</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Convide pessoas pelo Clerk para depois atribuir grupos e permissões operacionais.
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={onInvite} disabled={!canManage}>
              <UserPlus />
              Convidar primeiro membro
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-card-border">
            {clerkMembers.map((member) => {
              const memberGroups =
                overview?.groups.filter((group) =>
                  member.userId
                    ? group.members.some((groupMember) => groupMember.userId === member.userId)
                    : false,
                ) ?? [];
              return (
                <div
                  key={member.membershipId}
                  className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentDisc name={member.name} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{member.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{member.email ?? "Sem e-mail público"}</div>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end">
                    <span className="rounded-full border border-card-border bg-secondary/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                      Clerk · {member.providerRole}
                    </span>
                    {memberGroups.map((group) => (
                      <span
                        key={group.id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                      >
                        {group.name}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-primary/10 disabled:opacity-50"
                          onClick={() =>
                            member.userId && removeMember.mutate({ groupId: group.id, userId: member.userId })
                          }
                          disabled={!canManage || removeMember.isPending}
                          aria-label={`Remover ${member.name} do grupo ${group.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {memberGroups.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sem grupo local</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAssignment("", member.userId ?? "")}
                      disabled={!canManage || !member.userId || !overview?.groups.length}
                    >
                      <Plus />
                      Grupo
                    </Button>
                  </div>
                </div>
              );
            })}
            {memberships?.hasNextPage && (
              <div className="px-5 py-3 text-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => memberships.fetchNext()}
                  disabled={memberships.isFetching}
                >
                  {memberships.isFetching && <Loader2 className="animate-spin" />}
                  Carregar mais membros
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-card-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>Grupos de acesso</Eyebrow>
            <p className="mt-1 text-xs text-muted-foreground">
              Permissões explícitas, limitadas por organização, área ou equipe.
            </p>
          </div>
          <Button size="sm" onClick={openCreateGroup} disabled={!canManage}>
            <Plus />
            Novo grupo
          </Button>
        </div>

        {overviewQuery.isLoading ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[1, 2].map((item) => <Skeleton key={item} className="h-48 w-full" />)}
          </div>
        ) : overview && overview.groups.length > 0 ? (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {overview.groups.map((group) => (
              <div key={group.id} className="rounded-xl border border-card-border bg-secondary/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                      <Pill tone={group.scopeType === "organization" ? "blue" : "sage"}>
                        {SCOPE_LABELS[group.scopeType]}
                      </Pill>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {group.description || "Sem descrição operacional."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEditGroup(group)}
                      disabled={!canManage}
                      aria-label={`Editar grupo ${group.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setGroupToDelete(group)}
                      disabled={!canManage}
                      aria-label={`Excluir grupo ${group.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  {group.scopeType === "organization" ? <Building2 /> : group.scopeType === "area" ? <Layers3 /> : <UsersRound />}
                  <span>{group.scopeLabel}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.permissions.map((permission) => (
                    <span
                      key={permission}
                      title={permission}
                      className="rounded-md border border-card-border bg-background/60 px-2 py-1 text-[10px] text-muted-foreground"
                    >
                      {permissionLabel(permission)}
                    </span>
                  ))}
                </div>

                <div className="mt-4 border-t border-card-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-foreground">
                      {group.memberCount} {group.memberCount === 1 ? "membro" : "membros"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAssignment(group.id)}
                      disabled={!canManage || clerkMembers.length === 0}
                    >
                      <UserPlus />
                      Adicionar
                    </Button>
                  </div>
                  {group.members.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.members.slice(0, 5).map((member) => (
                        <span
                          key={member.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground"
                        >
                          {member.userName}
                          <button
                            type="button"
                            onClick={() => removeMember.mutate({ groupId: group.id, userId: member.userId })}
                            disabled={!canManage || removeMember.isPending}
                            className="rounded-full p-0.5 hover:bg-background/60 disabled:opacity-50"
                            aria-label={`Remover ${member.userName} do grupo ${group.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {group.members.length > 5 && (
                        <span className="px-1 py-1 text-[11px] text-muted-foreground">
                          +{group.members.length - 5}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Nenhum membro atribuído.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : overview ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <ShieldCheck className="h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Nenhum grupo de acesso criado</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Use um preset para delegar trabalho sem conceder privilégios globais desnecessários.
            </p>
            <Button size="sm" className="mt-4" onClick={openCreateGroup} disabled={!canManage}>
              <Plus />
              Criar primeiro grupo
            </Button>
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Os grupos aparecerão quando a API de controle de acesso estiver disponível.
          </div>
        )}
      </Card>

      {!canManage && overview && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Somente proprietários e administradores podem alterar grupos, membros e permissões.
        </p>
      )}

      {groupForm && overview && (
        <GroupFormDialog
          form={groupForm}
          overview={overview}
          isPending={saveGroup.isPending}
          onChange={setGroupForm}
          onClose={() => setGroupForm(null)}
          onSubmit={() => saveGroup.mutate(groupForm)}
        />
      )}

      {assignment && overview && (
        <MemberAssignmentDialog
          state={assignment}
          groups={overview.groups}
          members={clerkMembers}
          isPending={addMember.isPending}
          onChange={setAssignment}
          onClose={() => setAssignment(null)}
          onSubmit={() => addMember.mutate(assignment)}
        />
      )}

      <AlertDialog open={Boolean(groupToDelete)} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo de acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O grupo “{groupToDelete?.name}” e suas atribuições serão removidos. Os membros continuarão na organização Clerk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGroup.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={!canManage || deleteGroup.isPending}
              onClick={() => groupToDelete && deleteGroup.mutate(groupToDelete.id)}
            >
              {deleteGroup.isPending && <Loader2 className="animate-spin" />}
              Excluir grupo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
