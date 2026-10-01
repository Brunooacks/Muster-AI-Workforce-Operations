import zlib from "node:zlib";
import dns from "node:dns/promises";
import { MAX_CONTENT_LENGTH } from "./analyze";
import { getGitHubAccessToken } from "./github-auth";

// Guardrails for remote source fetching. Kept conservative so a single import
// request stays well within model + request limits and can't be abused to pull
// huge or sensitive trees.
export const MAX_FETCH_FILES = 40;
export const MAX_FILE_BYTES = 256_000;
export const MAX_TOTAL_BYTES = MAX_CONTENT_LENGTH;
const FETCH_TIMEOUT_MS = 20_000;
// Hard caps applied while streaming the response body, BEFORE buffering the
// whole thing, so a malicious/huge endpoint can't exhaust memory.
const MAX_DOWNLOAD_BYTES = 20_000_000; // any single HTTP body (e.g. tarball)
const MAX_TAR_BYTES = 30_000_000; // decompressed tar size (zip-bomb guard)
const MAX_GENERIC_BYTES = 5_000_000; // a single web/raw page before trimming
const MAX_REDIRECTS = 5;

// File extensions we consider relevant to describe an agent (code, prompts,
// skill manifests, docs). Anything else (binaries, lockfiles, images) is skipped.
const RELEVANT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".cs",
  ".php",
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".prompt",
  ".tmpl",
  ".jinja",
  ".jinja2",
  ".env.example",
]);

// Directories that never hold agent-defining source and only bloat the import.
const IGNORED_DIR = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "build",
  "out",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".next",
  "coverage",
  "target",
  ".turbo",
  ".cache",
]);

// Files that are noise for analysis (locks, minified, generated).
const IGNORED_FILE = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "poetry.lock",
  "cargo.lock",
  "go.sum",
]);

export class FetchSourceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "FetchSourceError";
    this.status = status;
  }
}

export interface FetchedFile {
  path: string;
  bytes: number;
}

export interface FetchSourceResult {
  content: string;
  sourceType: "git" | "url";
  files: FetchedFile[];
  truncated: boolean;
}

function extname(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

function isRelevantPath(path: string): boolean {
  const segments = path.split("/");
  const file = segments[segments.length - 1] ?? "";
  if (!file || file.startsWith(".") && !RELEVANT_EXTENSIONS.has(extname(file)))
    return false;
  if (IGNORED_FILE.has(file.toLowerCase())) return false;
  if (segments.some((s) => IGNORED_DIR.has(s))) return false;
  return RELEVANT_EXTENSIONS.has(extname(file));
}

// Rank files so the most descriptive ones survive the size cap first.
function priority(path: string): number {
  const lower = path.toLowerCase();
  const file = lower.split("/").pop() ?? lower;
  const depth = path.split("/").length;
  let score = depth; // shallower files first
  if (file.startsWith("readme")) score -= 100;
  if (lower.includes("skill") || lower.includes("prompt")) score -= 60;
  if (lower.includes("agent") || lower.includes("system")) score -= 40;
  if (file.endsWith(".md") || file.endsWith(".mdx")) score -= 20;
  if (file === "package.json" || file === "pyproject.toml") score -= 10;
  return score;
}

// --- SSRF guardrails -------------------------------------------------------

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal"))
    return true;
  // IPv6 loopback / link-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd"))
    return true;
  // IPv4 literals in private / reserved ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchSourceError("URL inválida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchSourceError("Apenas URLs http(s) são suportadas.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new FetchSourceError("Esse endereço não é permitido.");
  }
  return url;
}

// Resolve the hostname and reject if any resolved address is private/reserved.
// Catches hostnames (and redirect targets) that point at internal IPs, which a
// literal-only check would miss. Best-effort against DNS-based SSRF.
async function assertResolvedHostSafe(hostname: string): Promise<void> {
  // IP literals are already covered by isBlockedHostname in assertSafeUrl.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return;
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch {
    throw new FetchSourceError("Não foi possível resolver o endereço.", 502);
  }
  for (const a of addrs) {
    if (isBlockedHostname(a.address)) {
      throw new FetchSourceError("Esse endereço não é permitido.");
    }
  }
}

// Fetch that validates EVERY hop. Redirects are followed manually so each
// Location target is re-checked (protocol, blocked host, resolved IP) — auto
// "follow" would let a public URL bounce to localhost/metadata and defeat the
// SSRF guard.
async function safeFetch(start: URL, init?: RequestInit): Promise<Response> {
  let url = start;
  const startHost = start.hostname;
  const baseHeaders: Record<string, string> = {
    "User-Agent": "Cohort-Discovery/1.0",
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeUrl(url.toString());
    await assertResolvedHostSafe(url.hostname);

    // Never forward an Authorization header to a different host. GitHub's
    // authenticated tarball endpoint 302s to codeload with its own signed
    // token, so leaking the bearer token to the redirect target (or any other
    // CDN) would be both unnecessary and unsafe.
    const headers = { ...baseHeaders };
    if (url.hostname !== startHost) {
      delete headers["Authorization"];
      delete headers["authorization"];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        ...init,
        signal: controller.signal,
        headers,
        redirect: "manual",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new FetchSourceError("Tempo de busca esgotado.", 504);
      }
      throw new FetchSourceError("Não foi possível acessar o endereço.", 502);
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location) return res;
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        throw new FetchSourceError("Redirecionamento inválido.", 502);
      }
      url = next;
      continue;
    }
    return res;
  }
  throw new FetchSourceError("Muitos redirecionamentos.", 502);
}

// Read a response body into a Buffer while enforcing a hard byte cap. Rejects
// early on an oversized content-length and aborts mid-stream if the cap is hit,
// so we never buffer an unbounded payload.
async function readCappedBuffer(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new FetchSourceError("O conteúdo é grande demais para importar.", 413);
  }
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new FetchSourceError("O conteúdo é grande demais para importar.", 413);
    }
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new FetchSourceError(
          "O conteúdo é grande demais para importar.",
          413,
        );
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

// --- GitHub -----------------------------------------------------------------

interface GitHubRef {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

function parseGitHubUrl(url: URL): GitHubRef | null {
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com")
    return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, "");
  let branch: string | undefined;
  let subPath: string | undefined;
  // /owner/repo/tree/<branch>/<subpath...>
  if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
    branch = parts[3];
    if (parts.length > 4) subPath = parts.slice(4).join("/");
  }
  return { owner, repo, branch, subPath };
}

interface GitLabRef {
  namespace: string; // group (possibly nested: group/subgroup)
  repo: string;
  branch?: string;
  subPath?: string;
}

// GitLab paths look like /<group>[/<subgroup>...]/<repo> and browse URLs append
// /-/tree/<branch>/<subpath> or /-/blob/<branch>/<file>. Everything before the
// "/-/" sentinel is the project path; the last segment is the repo, the rest is
// the (possibly nested) namespace.
function parseGitLabUrl(url: URL): GitLabRef | null {
  if (url.hostname !== "gitlab.com" && url.hostname !== "www.gitlab.com")
    return null;
  const path = url.pathname;
  const dashIdx = path.indexOf("/-/");
  const projectPath = dashIdx === -1 ? path : path.slice(0, dashIdx);
  const segs = projectPath.split("/").filter(Boolean);
  if (segs.length < 2) return null;
  const repo = segs[segs.length - 1]!.replace(/\.git$/, "");
  const namespace = segs.slice(0, -1).join("/");
  let branch: string | undefined;
  let subPath: string | undefined;
  if (dashIdx !== -1) {
    const rest = path
      .slice(dashIdx + 3)
      .split("/")
      .filter(Boolean);
    if ((rest[0] === "tree" || rest[0] === "blob") && rest.length >= 2) {
      branch = rest[1];
      if (rest.length > 2) subPath = rest.slice(2).join("/");
    }
  }
  return { namespace, repo, branch, subPath };
}

interface BitbucketRef {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

// Bitbucket paths look like /<owner>/<repo> and browse URLs append
// /src/<branch>/<subpath>.
function parseBitbucketUrl(url: URL): BitbucketRef | null {
  if (url.hostname !== "bitbucket.org" && url.hostname !== "www.bitbucket.org")
    return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, "");
  let branch: string | undefined;
  let subPath: string | undefined;
  if (parts.length >= 4 && parts[2] === "src") {
    branch = parts[3];
    if (parts.length > 4) subPath = parts.slice(4).join("/");
  }
  return { owner, repo, branch, subPath };
}

// Refs tried (in order) when a host archive URL needs an explicit ref but the
// user didn't specify a branch. GitHub's codeload accepts HEAD directly, but
// GitLab/Bitbucket archive endpoints need a concrete ref, so we fall back
// through the common default branch names.
const DEFAULT_REF_CANDIDATES = ["HEAD", "main", "master"];

interface TarEntry {
  path: string;
  content: Buffer;
}

// Minimal gzip+tar reader for GitHub codeload archives. Avoids the GitHub REST
// API (which is rate-limited per IP) and any third-party tar dependency. Only
// reads regular-file entries; everything else (dirs, symlinks) is skipped.
function parseTarGz(gz: Buffer): TarEntry[] {
  const tar = zlib.gunzipSync(gz, { maxOutputLength: MAX_TAR_BYTES });
  const entries: TarEntry[] = [];
  let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.toString("utf8", off, off + 100).replace(/\0.*$/, "");
    if (!name) break; // end-of-archive (zero block)
    const prefix = tar.toString("utf8", off + 345, off + 500).replace(/\0.*$/, "");
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeStr = tar
      .toString("utf8", off + 124, off + 136)
      .replace(/\0.*$/, "")
      .trim();
    const size = parseInt(sizeStr, 8) || 0;
    const type = tar.toString("utf8", off + 156, off + 157);
    const dataStart = off + 512;
    if ((type === "0" || type === "") && size > 0) {
      entries.push({
        path: fullName,
        content: tar.subarray(dataStart, dataStart + size),
      });
    }
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

// Strip the GitHub archive's top-level "<repo>-<ref>/" wrapper directory.
function stripTopDir(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

// Download the GitHub repo archive. When a GitHub credential is available
// (GITHUB_TOKEN or a compatible environment variable) we use the authenticated
// REST tarball endpoint, which works for both public and private repos. Without
// a credential we fall back to the unauthenticated codeload path (public only).
async function downloadGitHubArchive(
  ref: GitHubRef,
  tokenOverride?: string | null,
): Promise<Response> {
  const token = tokenOverride?.trim() || await getGitHubAccessToken();

  if (token) {
    const refSegment = ref.branch ? `/${encodeURIComponent(ref.branch)}` : "";
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
      ref.owner,
    )}/${encodeURIComponent(ref.repo)}/tarball${refSegment}`;
    const res = await safeFetch(new URL(apiUrl), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.status === 401) {
      await res.body?.cancel().catch(() => {});
      throw new FetchSourceError(
        "A credencial do GitHub é inválida ou expirou. Reconecte sua conta GitHub e tente novamente.",
        403,
      );
    }
    if (res.status === 403) {
      const rateLimited = res.headers.get("x-ratelimit-remaining") === "0";
      await res.body?.cancel().catch(() => {});
      throw new FetchSourceError(
        rateLimited
          ? "Limite de requisições do GitHub atingido. Tente novamente em alguns minutos."
          : "Sua conta GitHub não tem acesso a este repositório. Verifique as permissões da conexão.",
        rateLimited ? 429 : 403,
      );
    }
    if (res.status === 404) {
      await res.body?.cancel().catch(() => {});
      throw new FetchSourceError(
        "Repositório, branch ou caminho não encontrado, ou sua conta GitHub não tem acesso a ele.",
        404,
      );
    }
    return res;
  }

  const refSegment = ref.branch
    ? `refs/heads/${encodeURIComponent(ref.branch)}`
    : "HEAD";
  const codeloadUrl = `https://codeload.github.com/${encodeURIComponent(
    ref.owner,
  )}/${encodeURIComponent(ref.repo)}/tar.gz/${refSegment}`;
  const res = await safeFetch(new URL(codeloadUrl));
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError(
      "Repositório, branch ou caminho não encontrado. Se o repositório for privado, conecte sua conta GitHub para importá-lo.",
      404,
    );
  }
  if (res.status === 429) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError(
      "Limite de requisições do GitHub atingido. Tente novamente em alguns minutos.",
      429,
    );
  }
  return res;
}

// Shared: turn a successful archive Response into a concatenated
// FetchSourceResult — gunzip + tar parse, filter relevant files, and join them.
// Used by every host importer once it has a usable archive Response.
async function extractArchive(
  res: Response,
  subPath: string | undefined,
): Promise<FetchSourceResult> {
  // An HTML response (any status) means a login/landing/error page was served
  // in place of an archive: GitLab/Bitbucket return one for a missing branch,
  // a private repo, or temporary anti-abuse throttling (e.g. 200, 403, 406).
  // Treat it as "not found or private" rather than a generic download failure.
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("html")) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError(
      "Repositório, branch ou caminho não encontrado (ou é privado).",
      404,
    );
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError("Falha ao baixar o repositório.", 502);
  }

  const gz = await readCappedBuffer(res, MAX_DOWNLOAD_BYTES);
  let entries: TarEntry[];
  try {
    entries = parseTarGz(gz);
  } catch (err) {
    if (err instanceof FetchSourceError) throw err;
    throw new FetchSourceError(
      "O repositório é grande demais ou ilegível.",
      413,
    );
  }

  const prefix = subPath ? subPath.replace(/\/$/, "") + "/" : "";
  const candidates = entries
    .map((e) => ({ ...e, path: stripTopDir(e.path) }))
    .filter((e) => (prefix ? e.path.startsWith(prefix) : true))
    .filter((e) => isRelevantPath(e.path))
    .filter((e) => e.content.length <= MAX_FILE_BYTES)
    .sort((a, b) => priority(a.path) - priority(b.path))
    .slice(0, MAX_FETCH_FILES);

  if (candidates.length === 0) {
    throw new FetchSourceError(
      "Nenhum arquivo de código ou skill relevante encontrado no repositório.",
      422,
    );
  }

  const files: FetchedFile[] = [];
  const chunks: string[] = [];
  let total = 0;
  let truncated = false;

  for (const entry of candidates) {
    if (total >= MAX_TOTAL_BYTES) {
      truncated = true;
      break;
    }
    let text = entry.content.toString("utf8");
    const remaining = MAX_TOTAL_BYTES - total;
    if (text.length > remaining) {
      text = text.slice(0, remaining);
      truncated = true;
    }
    total += text.length;
    files.push({ path: entry.path, bytes: text.length });
    chunks.push(`===== ${entry.path} =====\n${text}`);
  }

  return { content: chunks.join("\n\n"), sourceType: "git", files, truncated };
}

// Shared: download a gzipped tarball from one of the candidate archive URLs
// (the first non-404 wins) and extract it. Used by the GitLab/Bitbucket
// importers, which differ only in how they build the archive URL(s) and the
// host label shown on a rate-limit error.
async function fetchRepoArchive(
  candidateUrls: string[],
  subPath: string | undefined,
  hostLabel: string,
): Promise<FetchSourceResult> {
  let res: Response | null = null;
  for (const candidate of candidateUrls) {
    const r = await safeFetch(new URL(candidate));
    // 404 (missing repo/ref) or 401/403 (private repo — GitLab/Bitbucket
    // redirect such archive requests to a login page that resolves to 403
    // instead of a clean 404) → try the next candidate ref.
    if (r.status === 404 || r.status === 401 || r.status === 403) {
      await r.body?.cancel().catch(() => {});
      continue;
    }
    res = r;
    break;
  }
  if (!res) {
    throw new FetchSourceError(
      "Repositório, branch ou caminho não encontrado (ou é privado).",
      404,
    );
  }
  if (res.status === 429) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError(
      `Limite de requisições do ${hostLabel} atingido. Tente novamente em alguns minutos.`,
      429,
    );
  }
  return extractArchive(res, subPath);
}

async function fetchFromGitHub(
  ref: GitHubRef,
  tokenOverride?: string | null,
): Promise<FetchSourceResult> {
  const res = await downloadGitHubArchive(ref, tokenOverride);
  return extractArchive(res, ref.subPath);
}

// GitLab archive: /<namespace>/<repo>/-/archive/<ref>/<repo>-<ref>.tar.gz
// (the trailing filename is only used for naming, but must end in .tar.gz). The
// archive's top-level dir is "<repo>-<ref>/", stripped by stripTopDir.
async function fetchFromGitLab(ref: GitLabRef): Promise<FetchSourceResult> {
  const ns = ref.namespace.split("/").map(encodeURIComponent).join("/");
  const repo = encodeURIComponent(ref.repo);
  const refs = ref.branch ? [ref.branch] : DEFAULT_REF_CANDIDATES;
  const urls = refs.map((r) => {
    const enc = encodeURIComponent(r);
    return `https://gitlab.com/${ns}/${repo}/-/archive/${enc}/${repo}-${enc}.tar.gz`;
  });
  return fetchRepoArchive(urls, ref.subPath, "GitLab");
}

// Bitbucket archive: /<owner>/<repo>/get/<ref>.tar.gz. The archive's top-level
// dir is "<owner>-<repo>-<commit>/", stripped by stripTopDir.
async function fetchFromBitbucket(
  ref: BitbucketRef,
): Promise<FetchSourceResult> {
  const owner = encodeURIComponent(ref.owner);
  const repo = encodeURIComponent(ref.repo);
  const refs = ref.branch ? [ref.branch] : DEFAULT_REF_CANDIDATES;
  const urls = refs.map(
    (r) =>
      `https://bitbucket.org/${owner}/${repo}/get/${encodeURIComponent(r)}.tar.gz`,
  );
  return fetchRepoArchive(urls, ref.subPath, "Bitbucket");
}

// --- Generic URL ------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchFromUrl(url: URL): Promise<FetchSourceResult> {
  const res = await safeFetch(url);
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError(
      `O endereço respondeu com erro (${res.status}).`,
      res.status >= 400 && res.status < 500 ? 422 : 502,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (
    contentType &&
    !/^(text\/|application\/(json|xml|x-yaml|yaml|javascript|typescript))/.test(
      contentType,
    ) &&
    !contentType.includes("html")
  ) {
    await res.body?.cancel().catch(() => {});
    throw new FetchSourceError(
      "O endereço não retornou conteúdo de texto legível.",
      422,
    );
  }

  const raw = await readCappedBuffer(res, MAX_GENERIC_BYTES);
  let text = raw.toString("utf8");
  if (contentType.includes("html")) text = stripHtml(text);
  text = text.trim();

  let truncated = false;
  if (text.length > MAX_TOTAL_BYTES) {
    text = text.slice(0, MAX_TOTAL_BYTES);
    truncated = true;
  }
  if (!text) {
    throw new FetchSourceError("O endereço não retornou conteúdo útil.", 422);
  }

  const path = (url.pathname.split("/").filter(Boolean).pop() || url.hostname);
  return {
    content: text,
    sourceType: "url",
    files: [{ path, bytes: text.length }],
    truncated,
  };
}

export async function fetchAgentSourceFromUrl(
  raw: string,
  options?: { githubToken?: string | null },
): Promise<FetchSourceResult> {
  const url = assertSafeUrl(raw);
  const gitHubRef = parseGitHubUrl(url);
  if (gitHubRef) return fetchFromGitHub(gitHubRef, options?.githubToken);
  const gitLabRef = parseGitLabUrl(url);
  if (gitLabRef) return fetchFromGitLab(gitLabRef);
  const bitbucketRef = parseBitbucketUrl(url);
  if (bitbucketRef) return fetchFromBitbucket(bitbucketRef);
  return fetchFromUrl(url);
}
