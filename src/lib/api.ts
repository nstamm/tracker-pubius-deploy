export interface Operation {
  id: string;
  fecha_operacion: string;
  id_operacion: string | null;
  cuenta_emisora: string | null;
  cuenta_receptora: string | null;
  client_id: string | null;
  account_holder_id: string | null;
  monto_total: number;
  porcentaje_ganancia: number;
  ganancia: number;
  tipo_operacion: string;
  created_at: string;
}

export interface AccountHolder {
  id: string;
  name: string;
  bank: string;
  created_at: string;
}

export interface Client {
  id: string;
  title: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  nombre_gasto: string;
  monto: number;
  fecha: string;
  categoria: "Comidas" | "Viajes" | "Servicios" | "Personal";
  created_at: string;
}

export type OperationInput = Omit<Operation, "id" | "ganancia" | "created_at" | "client_id" | "account_holder_id"> & { client_id?: string | null; account_holder_id?: string | null };
export type AccountHolderInput = { name: string; bank: string };
export type ClientInput = { title: string; email?: string | null; phone?: string | null };
export type ExpenseInput = Omit<Expense, "id" | "created_at">;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body === undefined || init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
    if (response.status === 401 && window.location.pathname !== "/auth") {
      window.location.assign("/auth");
    }
    throw new ApiError(body.error || body.message || "Error de comunicación", response.status);
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string) => request<{ user: { email: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
    session: () => request<{ user: { email: string } }>("/api/auth/session"),
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    changePassword: (currentPassword: string, newPassword: string) => request<void>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  },
  operations: {
    list: (filters: { from?: string; to?: string; clientId?: string; accountHolderId?: string } = {}) => {
      const query = new URLSearchParams(filters).toString();
      return request<Operation[]>(`/api/operations${query ? `?${query}` : ""}`);
    },
    create: (input: OperationInput) => request<Operation>("/api/operations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
    update: (id: string, input: Partial<OperationInput>) => request<Operation>(`/api/operations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
    remove: (id: string) => request<void>(`/api/operations/${id}`, { method: "DELETE" }),
  },
  accountHolders: {
    list: () => request<AccountHolder[]>("/api/account-holders"),
    create: (input: AccountHolderInput) => request<AccountHolder>("/api/account-holders", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: Partial<AccountHolderInput>) => request<AccountHolder>(`/api/account-holders/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => request<void>(`/api/account-holders/${id}`, { method: "DELETE" }),
  },
  clients: {
    list: () => request<Client[]>("/api/clients"),
    create: (input: ClientInput) => request<Client>("/api/clients", {
      method: "POST",
      body: JSON.stringify(input),
    }),
    update: (id: string, input: Partial<ClientInput>) => request<Client>(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
    remove: (id: string) => request<void>(`/api/clients/${id}`, { method: "DELETE" }),
  },
  expenses: {
    list: () => request<Expense[]>("/api/expenses"),
    create: (input: ExpenseInput) => request<Expense>("/api/expenses", {
      method: "POST",
      body: JSON.stringify(input),
    }),
    update: (id: string, input: Partial<ExpenseInput>) => request<Expense>(`/api/expenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
    remove: (id: string) => request<void>(`/api/expenses/${id}`, { method: "DELETE" }),
  },
  binanceP2P: (body: { tradeType: "BUY" | "SELL"; fiat: string; asset: string; rows: number }) =>
    request<{ success: boolean; ads: unknown[] }>("/api/binance-p2p", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  transcribe: (audio: Blob) => {
    const form = new FormData();
    form.append("audio", audio, "audio.webm");
    return request<{ text: string }>("/api/transcriptions", { method: "POST", body: form });
  },
};
