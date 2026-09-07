const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(?:authorization|cookie|credentials?|password|passphrase|secrets?|tokens?|api[_-]?key|client[_-]?secret|private[_-]?key)$/i;

export function redactConnectorMetadata<T>(value: T): T {
  return redactValue(value, new WeakSet<object>()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (Buffer.isBuffer(value)) return REDACTED;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redactValue(nested, seen),
    ]),
  );
}

function redactString(value: string): string {
  if (value.startsWith("mustercred:v1:")) return REDACTED;
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, REDACTED)
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, REDACTED)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, REDACTED)
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b/g, REDACTED);
}
