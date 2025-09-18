const SESSION_URL = "https://api.fastmail.com/jmap/session";
const MASKED = "https://www.fastmail.com/dev/maskedemail";
const CORE = "urn:ietf:params:jmap:core";

export type FastmailSessionPick = {
  accountId: string;
  apiUrl: string;
};

export class FastmailError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?:
      | "auth"
      | "rate-limit"
      | "server"
      | "network"
      | "timeout"
      | "bad-json"
      | "unexpected"
      | "no-masked-capability",
  ) {
    super(message);
    this.name = "FastmailError";
  }
}

type RequestOpts = {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number): number {
  const base = 300 * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 150;
  return Math.min(5000, base + jitter);
}

// TODO Do we need this?
async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}

export async function jmapRequest<T>(
  url: string,
  token: string,
  payload?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  if (!token) throw new FastmailError("Missing token", undefined, "auth");

  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxRetries = Math.max(0, opts.retries ?? 3);

  let attempt = 0;

  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(opts.headers ?? {}),
    };
    const init: RequestInit = {
      method: payload === undefined ? "GET" : "POST",
      headers,
      signal: controller.signal,
    };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(payload);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      clearTimeout(timer);
      if (attempt <= maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      const isAbort = (e as any)?.name === "AbortError";
      throw new FastmailError(
        isAbort ? "Request timed out" : `Network error: ${String(e)}`,
        undefined,
        isAbort ? "timeout" : "network",
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) {
      throw new FastmailError("Unauthorized: token invalid or lacks permission", res.status, "auth");
    }

    if (res.status === 429) {
      if (attempt <= maxRetries) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "", 10);
        const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : backoffMs(attempt);
        await sleep(wait);
        continue;
      }
      throw new FastmailError("Rate limited by server", res.status, "rate-limit");
    }

    if (res.status >= 500 && res.status <= 599) {
      if (attempt <= maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new FastmailError(`Server error ${res.status}`, res.status, "server");
    }

    if (!res.ok) {
      const text = await safeText(res);
      throw new FastmailError(
        `Unexpected ${res.status}: ${text?.slice(0, 400) || "<no body>"}`,
        res.status,
        "unexpected",
      );
    }

    try {
      const json = (await res.json()) as T;
      return json;
    } catch {
      if (attempt <= maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new FastmailError("Malformed JSON response", res.status, "bad-json");
    }
  }
}

export async function fetchAPIData(token: string): Promise<FastmailSessionPick> {
  const session = await jmapRequest<any>(SESSION_URL, token, undefined);

  const accountId: unknown = session?.primaryAccounts?.[MASKED];
  const apiUrl: unknown = session?.apiUrl;

  // TODO Verify these failures
  if (typeof apiUrl !== "string" || !apiUrl) {
    throw new FastmailError("Session missing apiUrl", 200, "unexpected");
  }
  if (typeof accountId !== "string" || !accountId) {
    throw new FastmailError("Masked Email capability not available for this account", 200, "no-masked-capability");
  }

  return { accountId, apiUrl };
}

type JmapSetResponse = {
  methodResponses: [string, any, string][];
};

export async function createMaskedEmail(
  token: string,
  accountId: string,
  apiUrl: string,
  opts?: { description?: string; forDomain?: string },
): Promise<string> {
  const payload = {
    using: [CORE, MASKED],
    methodCalls: [
      [
        "MaskedEmail/set",
        {
          accountId,
          create: {
            new: {
              description: opts?.description || "",
              forDomain: opts?.forDomain || "",
            },
          },
        },
        "c1",
      ],
    ],
  };
  console.log("Creating masked email with payload:", payload);

  const resp = await jmapRequest<JmapSetResponse>(apiUrl, token, payload);

  const setResp = resp.methodResponses.find(([name]) => name === "MaskedEmail/set")?.[1];
  const created = setResp?.created?.new;

  if (!created || !created.email || !created.id) {
    const notCreated = JSON.stringify(setResp ?? resp);
    throw new FastmailError(
      `MaskedEmail creation failed or returned unexpected payload: ${notCreated}`,
      200,
      "unexpected",
    );
  }

  return created.email as string;
}
