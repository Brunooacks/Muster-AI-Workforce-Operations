import path from "node:path";

export function resolveStaticWebRoot(value = process.env.WEB_STATIC_DIR): string | null {
  const normalized = value?.trim();
  return normalized ? path.resolve(normalized) : null;
}

export function shouldServeSpaNavigation(
  method: string,
  pathname: string,
  acceptHeader?: string,
): boolean {
  if (method.toUpperCase() !== "GET" || pathname === "/api" || pathname.startsWith("/api/")) {
    return false;
  }
  return (acceptHeader ?? "").toLowerCase().includes("text/html");
}
