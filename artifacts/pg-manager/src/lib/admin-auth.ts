export const ADMIN_SESSION_QUERY_KEY = ["admin-session"] as const;

export type AdminSession = {
  admin: {
    id: number;
    email: string;
    role: "super_admin" | "staff";
    createdAt: string;
  };
};

export class AdminAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

async function adminAuthRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const data = await parseJson<{ error?: string }>(response);
      message = data?.error || message;
    } catch {
      // Ignore non-JSON error bodies.
    }

    throw new AdminAuthError(message, response.status);
  }

  return parseJson<T>(response);
}

export async function fetchAdminSession(): Promise<AdminSession> {
  return adminAuthRequest<AdminSession>("/api/admin/session");
}

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  return adminAuthRequest<AdminSession>("/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutAdmin(): Promise<void> {
  await adminAuthRequest("/api/admin/logout", {
    method: "POST",
  });
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AdminAuthError && (error.status === 401 || error.status === 403);
}
