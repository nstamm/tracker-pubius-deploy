import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";

export interface OperationInput {
  fecha_operacion: string;
  id_operacion?: string | null;
  cuenta_emisora?: string | null;
  cuenta_receptora?: string | null;
  client_id?: string | null;
  account_holder_id?: string | null;
  monto_total: number;
  porcentaje_ganancia: number;
  tipo_operacion: string;
}

export type OperationUpdate = Partial<OperationInput>;

export interface ClientInput {
  title: string;
  email?: string | null;
  phone?: string | null;
}

export type ClientUpdate = Partial<ClientInput>;

export interface ExpenseInput {
  nombre_gasto: string;
  monto: number;
  fecha: string;
  categoria: string;
}

export type ExpenseUpdate = Partial<ExpenseInput>;

interface OperationRow {
  id: string;
  fecha_operacion: string;
  id_operacion: string | null;
  cuenta_emisora: string | null;
  cuenta_receptora: string | null;
  client_id: string | null;
  account_holder_id: string | null;
  monto_centavos: number;
  porcentaje_puntos: number;
  ganancia_centavos: number;
  tipo_operacion: string;
  created_at: string;
}

interface ClientRow {
  id: string;
  title: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface AccountHolderRow {
  id: string;
  name: string;
  bank: string;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  nombre_gasto: string;
  monto_centavos: number;
  fecha: string;
  categoria: string;
  created_at: string;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    fecha_operacion TEXT NOT NULL,
    id_operacion TEXT,
    cuenta_emisora TEXT,
    cuenta_receptora TEXT,
    client_id TEXT,
    account_holder_id TEXT,
    monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 0),
    porcentaje_puntos INTEGER NOT NULL CHECK (porcentaje_puntos >= 0),
    ganancia_centavos INTEGER NOT NULL CHECK (ganancia_centavos >= 0),
    tipo_operacion TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS operations_fecha_idx ON operations(fecha_operacion DESC);

  CREATE TABLE IF NOT EXISTS account_holders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    created_at TEXT NOT NULL
  );


  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    nombre_gasto TEXT NOT NULL,
    monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 0),
    fecha TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('Comidas', 'Viajes', 'Servicios', 'Personal')),
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS expenses_fecha_idx ON expenses(fecha DESC);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monthly_reports (
    period TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL
  );
`;

function toMinorUnits(value: number): number {
  return Math.round(value * 100);
}

function fromMinorUnits(value: number): number {
  return value / 100;
}

function operationFromRow(row: OperationRow) {
  return {
    id: row.id,
    fecha_operacion: row.fecha_operacion,
    id_operacion: row.id_operacion,
    cuenta_emisora: row.cuenta_emisora,
    cuenta_receptora: row.cuenta_receptora,
    client_id: row.client_id,
    account_holder_id: row.account_holder_id,
    monto_total: fromMinorUnits(row.monto_centavos),
    porcentaje_ganancia: fromMinorUnits(row.porcentaje_puntos),
    ganancia: fromMinorUnits(row.ganancia_centavos),
    tipo_operacion: row.tipo_operacion,
    created_at: row.created_at,
  };
}

function clientFromRow(row: ClientRow) {
  return {
    id: row.id,
    title: row.title,
    email: row.email,
    phone: row.phone,
    created_at: row.created_at,
  };
}

function expenseFromRow(row: ExpenseRow) {
  return {
    id: row.id,
    nombre_gasto: row.nombre_gasto,
    monto: fromMinorUnits(row.monto_centavos),
    fecha: row.fecha,
    categoria: row.categoria,
    created_at: row.created_at,
  };
}

export class AppDatabase {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (path !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL");
      this.db.exec("PRAGMA synchronous = NORMAL");
    }
    this.db.exec(SCHEMA);
    const operationColumns = this.db.prepare("PRAGMA table_info(operations)").all() as Array<{ name: string }>;
    if (!operationColumns.some((column) => column.name === "client_id")) {
      this.db.exec("ALTER TABLE operations ADD COLUMN client_id TEXT");
    }
    if (!operationColumns.some((column) => column.name === "account_holder_id")) {
      this.db.exec("ALTER TABLE operations ADD COLUMN account_holder_id TEXT");
    }
    this.db.exec("CREATE INDEX IF NOT EXISTS operations_client_idx ON operations(client_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS operations_account_holder_idx ON operations(account_holder_id)");
  }

  close(): void {
    this.db.close();
  }

  isHealthy(): boolean {
    return this.db.prepare("SELECT 1").get() !== undefined;
  }

  getAuthPasswordHash(fallbackHash: string): string {
    this.db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('auth_password_hash', ?)").run(fallbackHash);
    return (this.db.prepare("SELECT value FROM app_settings WHERE key = 'auth_password_hash'").get() as { value: string }).value;
  }

  setAuthPasswordHash(passwordHash: string): void {
    this.db.prepare("UPDATE app_settings SET value = ? WHERE key = 'auth_password_hash'").run(passwordHash);
  }

  listSentReportPeriods(): Set<string> {
    const rows = this.db.prepare("SELECT period FROM monthly_reports").all() as unknown as Array<{ period: string }>;
    return new Set(rows.map((row) => row.period));
  }

  markReportSent(period: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO monthly_reports (period, sent_at) VALUES (?, ?)")
      .run(period, new Date().toISOString());
  }

  async backup(destination: string): Promise<void> {
    mkdirSync(dirname(destination), { recursive: true });
    await backup(this.db, destination);
  }

  listOperations(from?: string, to?: string, clientId?: string, accountHolderId?: string) {
    const conditions: string[] = [];
    const params: Record<string, string> = {};
    if (from) {
      conditions.push("fecha_operacion >= @from");
      params.from = from;
    }
    if (to) {
      conditions.push("fecha_operacion <= @to");
      params.to = to;
    }
    if (clientId) {
      conditions.push("client_id = @clientId");
      params.clientId = clientId;
    }
    if (accountHolderId) {
      conditions.push("account_holder_id = @accountHolderId");
      params.accountHolderId = accountHolderId;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT * FROM operations ${where} ORDER BY fecha_operacion DESC`).all(params) as unknown as OperationRow[];
    return rows.map(operationFromRow);
  }

  getOperation(id: string) {
    const row = this.db.prepare("SELECT * FROM operations WHERE id = ?").get(id) as unknown as OperationRow | undefined;
    return row ? operationFromRow(row) : null;
  }

  createOperation(input: OperationInput) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const amount = toMinorUnits(input.monto_total);
    const percentage = input.tipo_operacion === "Comisión" ? 10_000 : toMinorUnits(input.porcentaje_ganancia);
    const gain = Math.round(amount * (percentage / 10_000));

    this.db.prepare(`
      INSERT INTO operations (
        id, fecha_operacion, id_operacion, cuenta_emisora, cuenta_receptora, client_id, account_holder_id,
        monto_centavos, porcentaje_puntos, ganancia_centavos, tipo_operacion, created_at
      ) VALUES (
        @id, @fecha_operacion, @id_operacion, @cuenta_emisora, @cuenta_receptora, @client_id, @account_holder_id,
        @monto_centavos, @porcentaje_puntos, @ganancia_centavos, @tipo_operacion, @created_at
      )
    `).run({
      id,
      fecha_operacion: input.fecha_operacion,
      id_operacion: input.id_operacion || null,
      cuenta_emisora: input.cuenta_emisora || null,
      cuenta_receptora: input.cuenta_receptora || null,
      client_id: input.client_id || null,
      account_holder_id: input.account_holder_id || null,
      monto_centavos: amount,
      porcentaje_puntos: percentage,
      ganancia_centavos: gain,
      tipo_operacion: input.tipo_operacion,
      created_at: createdAt,
    });

    return this.getOperation(id)!;
  }

  updateOperation(id: string, update: OperationUpdate) {
    const current = this.getOperation(id);
    if (!current) return null;

    const next: OperationInput = {
      fecha_operacion: update.fecha_operacion ?? current.fecha_operacion,
      id_operacion: "id_operacion" in update ? update.id_operacion ?? null : current.id_operacion,
      cuenta_emisora: "cuenta_emisora" in update ? update.cuenta_emisora ?? null : current.cuenta_emisora,
      cuenta_receptora: "cuenta_receptora" in update ? update.cuenta_receptora ?? null : current.cuenta_receptora,
      client_id: "client_id" in update ? update.client_id ?? null : current.client_id,
      account_holder_id: "account_holder_id" in update ? update.account_holder_id ?? null : current.account_holder_id,
      monto_total: update.monto_total ?? current.monto_total,
      porcentaje_ganancia: update.porcentaje_ganancia ?? current.porcentaje_ganancia,
      tipo_operacion: update.tipo_operacion ?? current.tipo_operacion,
    };
    const amount = toMinorUnits(next.monto_total);
    const percentage = next.tipo_operacion === "Comisión" ? 10_000 : toMinorUnits(next.porcentaje_ganancia);
    const gain = Math.round(amount * (percentage / 10_000));

    this.db.prepare(`
      UPDATE operations SET
        fecha_operacion = @fecha_operacion,
        id_operacion = @id_operacion,
        cuenta_emisora = @cuenta_emisora,
        cuenta_receptora = @cuenta_receptora,
        client_id = @client_id,
        account_holder_id = @account_holder_id,
        monto_centavos = @monto_centavos,
        porcentaje_puntos = @porcentaje_puntos,
        ganancia_centavos = @ganancia_centavos,
        tipo_operacion = @tipo_operacion
      WHERE id = @id
    `).run({
      id,
      fecha_operacion: next.fecha_operacion,
      id_operacion: next.id_operacion || null,
      cuenta_emisora: next.cuenta_emisora || null,
      cuenta_receptora: next.cuenta_receptora || null,
      client_id: next.client_id || null,
      account_holder_id: next.account_holder_id || null,
      monto_centavos: amount,
      porcentaje_puntos: percentage,
      ganancia_centavos: gain,
      tipo_operacion: next.tipo_operacion,
    });

    return this.getOperation(id)!;
  }

  deleteOperation(id: string): boolean {
    return this.db.prepare("DELETE FROM operations WHERE id = ?").run(id).changes > 0;
  }

  listAccountHolders() {
    const rows = this.db.prepare("SELECT * FROM account_holders ORDER BY name COLLATE NOCASE").all() as unknown as AccountHolderRow[];
    return rows;
  }

  getAccountHolder(id: string) {
    return this.db.prepare("SELECT * FROM account_holders WHERE id = ?").get(id) as unknown as AccountHolderRow | undefined;
  }

  createAccountHolder(input: { name: string; bank: string }) {
    const id = randomUUID();
    this.db.prepare("INSERT INTO account_holders (id, name, bank, created_at) VALUES (@id, @name, @bank, @created_at)").run({ id, name: input.name, bank: input.bank, created_at: new Date().toISOString() });
    return this.getAccountHolder(id)!;
  }

  updateAccountHolder(id: string, update: Partial<{ name: string; bank: string }>) {
    const current = this.getAccountHolder(id);
    if (!current) return null;
    const name = update.name ?? current.name;
    const bank = update.bank ?? current.bank;
    this.db.prepare("UPDATE account_holders SET name = @name, bank = @bank WHERE id = @id").run({ id, name, bank });
    return this.getAccountHolder(id)!;
  }

  deleteAccountHolder(id: string): boolean {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("UPDATE operations SET account_holder_id = NULL WHERE account_holder_id = ?").run(id);
      const deleted = this.db.prepare("DELETE FROM account_holders WHERE id = ?").run(id).changes > 0;
      this.db.exec("COMMIT");
      return deleted;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listClients() {
    const rows = this.db.prepare("SELECT * FROM clients ORDER BY title COLLATE NOCASE").all() as unknown as ClientRow[];
    return rows.map(clientFromRow);
  }

  getClient(id: string) {
    const row = this.db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as unknown as ClientRow | undefined;
    return row ? clientFromRow(row) : null;
  }

  createClient(input: ClientInput) {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO clients (id, title, email, phone, created_at)
      VALUES (@id, @title, @email, @phone, @created_at)
    `).run({
      id,
      title: input.title,
      email: input.email || null,
      phone: input.phone || null,
      created_at: new Date().toISOString(),
    });
    return this.getClient(id)!;
  }

  updateClient(id: string, update: ClientUpdate) {
    const current = this.getClient(id);
    if (!current) return null;
    const next: ClientInput = {
      title: update.title ?? current.title,
      email: "email" in update ? update.email ?? null : current.email,
      phone: "phone" in update ? update.phone ?? null : current.phone,
    };
    this.db.prepare(`
      UPDATE clients SET title = @title, email = @email, phone = @phone WHERE id = @id
    `).run({ id, title: next.title, email: next.email || null, phone: next.phone || null });
    return this.getClient(id)!;
  }

  deleteClient(id: string): boolean {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("UPDATE operations SET client_id = NULL WHERE client_id = ?").run(id);
      const deleted = this.db.prepare("DELETE FROM clients WHERE id = ?").run(id).changes > 0;
      this.db.exec("COMMIT");
      return deleted;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listExpenses() {
    const rows = this.db.prepare("SELECT * FROM expenses ORDER BY fecha DESC").all() as unknown as ExpenseRow[];
    return rows.map(expenseFromRow);
  }

  getExpense(id: string) {
    const row = this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as unknown as ExpenseRow | undefined;
    return row ? expenseFromRow(row) : null;
  }

  createExpense(input: ExpenseInput) {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO expenses (id, nombre_gasto, monto_centavos, fecha, categoria, created_at)
      VALUES (@id, @nombre_gasto, @monto_centavos, @fecha, @categoria, @created_at)
    `).run({
      id,
      nombre_gasto: input.nombre_gasto,
      monto_centavos: toMinorUnits(input.monto),
      fecha: input.fecha,
      categoria: input.categoria,
      created_at: new Date().toISOString(),
    });
    return this.getExpense(id)!;
  }

  updateExpense(id: string, update: ExpenseUpdate) {
    const current = this.getExpense(id);
    if (!current) return null;
    const next: ExpenseInput = {
      nombre_gasto: update.nombre_gasto ?? current.nombre_gasto,
      monto: update.monto ?? current.monto,
      fecha: update.fecha ?? current.fecha,
      categoria: update.categoria ?? current.categoria,
    };

    this.db.prepare(`
      UPDATE expenses SET
        nombre_gasto = @nombre_gasto,
        monto_centavos = @monto_centavos,
        fecha = @fecha,
        categoria = @categoria
      WHERE id = @id
    `).run({
      id,
      nombre_gasto: next.nombre_gasto,
      monto_centavos: toMinorUnits(next.monto),
      fecha: next.fecha,
      categoria: next.categoria,
    });
    return this.getExpense(id)!;
  }

  deleteExpense(id: string): boolean {
    return this.db.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0;
  }
}
