import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "./database.js";
import { buildMonthlyReport, computeFigures, duePeriod, runDueReports, timePartsInZone, type OperationRecord, type ReportMailer } from "./report.js";

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  csv: string;
  period: string;
}

const mails: Mail[] = [];
let failNext = false;
const mailer: ReportMailer = {
  send: async (input) => {
    if (failNext) {
      failNext = false;
      throw new Error("SMTP unavailable");
    }
    mails.push(input);
  },
};

const databases: AppDatabase[] = [];

function createDatabase() {
  const database = new AppDatabase(":memory:");
  databases.push(database);
  return database;
}

function operation(fecha_operacion: string, monto_total: number, porcentaje_ganancia: number, tipo_operacion = "Zelle"): OperationRecord {
  return {
    fecha_operacion,
    id_operacion: null,
    cuenta_emisora: null,
    cuenta_receptora: null,
    monto_total,
    porcentaje_ganancia,
    ganancia: monto_total * (porcentaje_ganancia / 100),
    tipo_operacion,
  };
}

afterEach(() => {
  mails.length = 0;
  failNext = false;
  databases.forEach((database) => database.close());
  databases.length = 0;
});

describe("duePeriod", () => {
  it("waits until the configured hour on the 1st", () => {
    expect(duePeriod(new Date("2026-09-01T10:59:00Z"), "America/Argentina/Buenos_Aires", 8, new Set())).toBeNull();
    expect(duePeriod(new Date("2026-09-01T12:00:00Z"), "America/Argentina/Buenos_Aires", 8, new Set())).toBe("2026-08");
  });

  it("reports the previous calendar month and supports custom hours", () => {
    expect(duePeriod(new Date("2026-09-01T11:59:00Z"), "America/Argentina/Buenos_Aires", 9, new Set())).toBeNull();
    expect(duePeriod(new Date("2026-09-01T12:00:00Z"), "America/Argentina/Buenos_Aires", 9, new Set())).toBe("2026-08");
    expect(duePeriod(new Date("2026-09-01T12:00:00Z"), "America/Argentina/Buenos_Aires", 9, new Set(["2026-08"]))).toBeNull();
  });

  it("catches up when the server was down on the 1st and crosses year boundaries", () => {
    expect(duePeriod(new Date("2026-09-04T15:00:00Z"), "America/Argentina/Buenos_Aires", 8, new Set())).toBe("2026-08");
    expect(duePeriod(new Date("2027-01-15T12:00:00Z"), "America/Argentina/Buenos_Aires", 8, new Set())).toBe("2026-12");
  });

  it("resolves local time using the configured time zone", () => {
    const parts = timePartsInZone(new Date("2026-09-01T02:59:00Z"), "America/Argentina/Buenos_Aires");
    expect(parts).toEqual({ year: 2026, month: 8, day: 31, hour: 23 });
  });
});

describe("buildMonthlyReport", () => {
  it("computes totals, grouping by type and the weighted average percentage", () => {
    const operations = [
      operation("2026-08-01", 100, 1),
      operation("2026-08-10", 200, 2),
      operation("2026-08-20", 300, 1, "Paypal"),
    ];
    const figures = computeFigures(operations);
    expect(figures.count).toBe(3);
    expect(figures.totalAmount).toBe(600);
    expect(figures.totalGain).toBe(8);
    expect(figures.averagePercentage).toBeCloseTo((8 / 600) * 100, 6);
    expect(figures.byType).toEqual([
      { tipo_operacion: "Zelle", count: 2, amount: 300, gain: 5 },
      { tipo_operacion: "Paypal", count: 1, amount: 300, gain: 3 },
    ]);
  });

  it("builds subject, plain text, HTML and CSV content with escaping", () => {
    const report = buildMonthlyReport("2026-08", [
      {
        fecha_operacion: "2026-08-05",
        id_operacion: 'A; "x"',
        cuenta_emisora: "Cuenta 1",
        cuenta_receptora: "Cuenta 2",
        monto_total: 1234.5,
        porcentaje_ganancia: 2.5,
        ganancia: 30.86,
        tipo_operacion: "Zelle",
      },
    ]);
    expect(report.subject).toContain("Agosto de 2026");
    expect(report.text).toContain("Volumen total: $1234,50");
    expect(report.text).toContain("Ganancia total: $30,86");
    expect(report.text).toContain("05/08/2026");
    expect(report.html).toContain("A; &quot;x&quot;");
    expect(report.html).toContain("$1234,50");
    expect(report.csv.startsWith("\uFEFF")).toBe(true);
    expect(report.csv.slice(1).split("\r\n")[0]).toBe("Fecha;ID;Emisora;Receptora;Monto;Porcentaje;Tipo;Ganancia");
    expect(report.csv.slice(1).split("\r\n")[1]).toBe('2026-08-05;"A; ""x""";Cuenta 1;Cuenta 2;1234.50;2.50;Zelle;30.86');
  });

  it("handles an empty month", () => {
    const report = buildMonthlyReport("2026-08", []);
    expect(report.figures.count).toBe(0);
    expect(report.text).toContain("No hubo operaciones");
    expect(report.html).toContain("No hubo operaciones");
    expect(report.csv).toContain("Fecha;ID;Emisora;Receptora;Monto;Porcentaje;Tipo;Ganancia");
  });
});

describe("runDueReports", () => {
  it("sends exactly once per month and persists the sent period", async () => {
    const database = createDatabase();
    database.createOperation({ fecha_operacion: "2026-08-15", monto_total: 100, porcentaje_ganancia: 2, tipo_operacion: "Zelle" });
    database.createOperation({ fecha_operacion: "2026-07-31", monto_total: 50, porcentaje_ganancia: 5, tipo_operacion: "Paypal" });

    const first = await runDueReports(database, mailer, "info@pubiusmarketing.com", { now: new Date("2026-09-01T12:00:00Z") });
    expect(first).toEqual({ period: "2026-08", count: 1 });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("info@pubiusmarketing.com");
    expect(mails[0].period).toBe("2026-08");
    expect(mails[0].text).toContain("01/08/2026");
    expect(mails[0].text).toContain("31/08/2026");
    expect(mails[0].text).not.toContain("31/07/2026");

    const second = await runDueReports(database, mailer, "info@pubiusmarketing.com", { now: new Date("2026-09-01T12:00:00Z") });
    expect(second).toBeNull();
    expect(mails).toHaveLength(1);
  });

  it("keeps the period pending until the email succeeds", async () => {
    const database = createDatabase();
    database.createOperation({ fecha_operacion: "2026-08-15", monto_total: 100, porcentaje_ganancia: 2, tipo_operacion: "Zelle" });

    failNext = true;
    await expect(
      runDueReports(database, mailer, "owner@example.com", { now: new Date("2026-09-01T12:00:00Z") }),
    ).rejects.toThrow("SMTP unavailable");
    expect(mails).toHaveLength(0);

    const retry = await runDueReports(database, mailer, "owner@example.com", { now: new Date("2026-09-01T12:00:00Z") });
    expect(retry).toEqual({ period: "2026-08", count: 1 });
    expect(mails).toHaveLength(1);
  });

  it("does not resend across app restarts thanks to persistent storage", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pubius-report-"));
    const databasePath = join(directory, "pubius.sqlite");
    const open: AppDatabase[] = [];

    try {
      open.push(new AppDatabase(databasePath));
      open.at(-1)!.createOperation({ fecha_operacion: "2026-08-15", monto_total: 100, porcentaje_ganancia: 2, tipo_operacion: "Zelle" });
      open.pop()!.close();

      open.push(new AppDatabase(databasePath));
      await runDueReports(open.at(-1)!, mailer, "owner@example.com", { now: new Date("2026-09-01T12:00:00Z") });
      open.pop()!.close();

      open.push(new AppDatabase(databasePath));
      const afterRestart = await runDueReports(open.at(-1)!, mailer, "owner@example.com", { now: new Date("2026-09-01T12:00:00Z") });
      expect(afterRestart).toBeNull();
      expect(mails).toHaveLength(1);
      open.pop()!.close();
    } finally {
      open.forEach((instance) => instance.close());
      await rm(directory, { recursive: true, force: true });
    }
  });
});