import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";

export interface OperationInput {
  fecha_operacion: string;
  id_operacion?: string | null;
  cuenta_emisora?: string | null;
  cuenta_receptora?: string | null;
  monto_total: number;
  porcentaje_ganancia: number;
  tipo_operacion: string;
}

export type OperationUpdate = Partial<OperationInput>;

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
  monto_centavos: number;
  porcentaje_puntos: number;
  ganancia_centavos: number;
  tipo_operacion: string;
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
    monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 0),
    porcentaje_puntos INTEGER NOT NULL CHECK (porcentaje_puntos >= 0),
    ganancia_centavos INTEGER NOT NULL CHECK (ganancia_centavos >= 0),
    tipo_operacion TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS operations_fecha_idx ON operations(fecha_operacion DESC);

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    nombre_gasto TEXT NOT NULL,
    monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 0),
    fecha TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('Comidas', 'Viajes', 'Servicios', 'Personal')),
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS expenses_fecha_idx ON expenses(fecha DESC);
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
    monto_total: fromMinorUnits(row.monto_centavos),
    porcentaje_ganancia: fromMinorUnits(row.porcentaje_puntos),
    ganancia: fromMinorUnits(row.ganancia_centavos),
    tipo_operacion: row.tipo_operacion,
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
  }

  close(): void {
    this.db.close();
  }

  isHealthy(): boolean {
    return this.db.prepare("SELECT 1").get() !== undefined;
  }

  async backup(destination: string): Promise<void> {
    mkdirSync(dirname(destination), { recursive: true });
    await backup(this.db, destination);
  }

  listOperations(from?: string, to?: string) {
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
        id, fecha_operacion, id_operacion, cuenta_emisora, cuenta_receptora,
        monto_centavos, porcentaje_puntos, ganancia_centavos, tipo_operacion, created_at
      ) VALUES (
        @id, @fecha_operacion, @id_operacion, @cuenta_emisora, @cuenta_receptora,
        @monto_centavos, @porcentaje_puntos, @ganancia_centavos, @tipo_operacion, @created_at
      )
    `).run({
      id,
      fecha_operacion: input.fecha_operacion,
      id_operacion: input.id_operacion || null,
      cuenta_emisora: input.cuenta_emisora || null,
      cuenta_receptora: input.cuenta_receptora || null,
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
