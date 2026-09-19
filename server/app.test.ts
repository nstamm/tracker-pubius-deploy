import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { hashPassword } from "./auth.js";
import type { ReportMailer } from "./report.js";

const apps: FastifyInstance[] = [];

async function createTestApp() {
  const app = await buildApp({
    databasePath: ":memory:",
    authEmail: "owner@example.com",
    authPasswordHash: hashPassword("correct-password"),
    cookieSecret: "test-secret-with-at-least-twenty-characters",
    cookieSecure: false,
  });
  apps.push(app);
  return app;
}

async function login(app: FastifyInstance) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "owner@example.com", password: "correct-password" },
  });
  expect(response.statusCode).toBe(200);
  const setCookie = response.headers["set-cookie"]!;
  return (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(";", 1)[0];
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("authentication", { timeout: 15_000 }, () => {
  it("protects application data and establishes a signed session", async () => {
    const app = await createTestApp();
    expect((await app.inject({ method: "GET", url: "/api/operations" })).statusCode).toBe(401);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@example.com", password: "wrong" },
    });
    expect(invalid.statusCode).toBe(401);

    const cookie = await login(app);
    const session = await app.inject({ method: "GET", url: "/api/auth/session", headers: { cookie } });
    expect(session.json()).toEqual({ user: { email: "owner@example.com" } });
  });

  it("rate limits repeated invalid logins", async () => {
    const app = await createTestApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "owner@example.com", password: "wrong" },
      });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@example.com", password: "correct-password" },
    });
    expect(blocked.statusCode).toBe(429);
  });

  it("clears the signed session on logout", async () => {
    const app = await createTestApp();
    const cookie = await login(app);
    const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });

    expect(logout.statusCode).toBe(204);
    const clearedCookie = logout.headers["set-cookie"]!;
    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie: (Array.isArray(clearedCookie) ? clearedCookie[0] : clearedCookie).split(";", 1)[0] },
    });
    expect(session.statusCode).toBe(401);
  });

  it("persists a changed password across app restarts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pubius-password-"));
    const databasePath = join(directory, "pubius.sqlite");
    const first = await buildApp({
      databasePath,
      authEmail: "owner@example.com",
      authPasswordHash: hashPassword("correct-password"),
      cookieSecret: "test-secret-with-at-least-twenty-characters",
      cookieSecure: false,
    });

    try {
      const cookie = await login(first);
      const change = await first.inject({
        method: "POST",
        url: "/api/auth/password",
        headers: { cookie },
        payload: { currentPassword: "correct-password", newPassword: "new-correct-password" },
      });
      expect(change.statusCode).toBe(204);
      await first.close();

      const second = await buildApp({
        databasePath,
        authEmail: "owner@example.com",
        authPasswordHash: hashPassword("deployment-password"),
        cookieSecret: "test-secret-with-at-least-twenty-characters",
        cookieSecure: false,
      });
      try {
        const loginWithChangedPassword = await second.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "owner@example.com", password: "new-correct-password" },
        });
        expect(loginWithChangedPassword.statusCode).toBe(200);

        const loginWithDeploymentPassword = await second.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "owner@example.com", password: "deployment-password" },
        });
        expect(loginWithDeploymentPassword.statusCode).toBe(401);
      } finally {
        await second.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("monthly report scheduling", () => {
  function appWithReport(now: () => Date, mailer: ReportMailer) {
    return buildApp({
      databasePath: ":memory:",
      authEmail: "owner@example.com",
      authPasswordHash: hashPassword("correct-password"),
      cookieSecret: "test-secret-with-at-least-twenty-characters",
      cookieSecure: false,
      reportMailer: mailer,
      reportNow: now,
    });
  }

  it("sends the previous month when the report becomes due", async () => {
    const received: Array<{ period: string; subject: string }> = [];
    const app = await appWithReport(
      () => new Date("2026-09-01T12:00:00Z"),
      { send: async (input) => {
        received.push({ period: input.period, subject: input.subject });
      } },
    );
    apps.push(app);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(received).toHaveLength(1);
    expect(received[0].period).toBe("2026-08");
  });

  it("waits for the scheduled hour", async () => {
    const received: Array<{ period: string }> = [];
    const app = await appWithReport(
      () => new Date("2026-09-01T10:55:00Z"),
      { send: async (input) => {
        received.push({ period: input.period });
      } },
    );
    apps.push(app);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(received).toHaveLength(0);
  });
});

describe("financial records", () => {
  it("manages clients, filters their operations and unlinks them on deletion", async () => {
    const app = await createTestApp();
    const cookie = await login(app);
    const createdClient = await app.inject({
      method: "POST",
      url: "/api/clients",
      headers: { cookie },
      payload: { title: "Acme Corp", email: "contact@acme.test" },
    });
    expect(createdClient.statusCode).toBe(201);
    expect(createdClient.json()).toMatchObject({ title: "Acme Corp", email: "contact@acme.test", phone: null });

    const clientId = createdClient.json().id;
    const updatedClient = await app.inject({
      method: "PATCH",
      url: `/api/clients/${clientId}`,
      headers: { cookie },
      payload: { phone: "+54 11 5555 0000" },
    });
    expect(updatedClient.json()).toMatchObject({ title: "Acme Corp", phone: "+54 11 5555 0000" });

    const createdOperation = await app.inject({
      method: "POST",
      url: "/api/operations",
      headers: { cookie },
      payload: {
        fecha_operacion: "2026-08-26",
        monto_total: 100,
        porcentaje_ganancia: 2,
        tipo_operacion: "Zelle",
        client_id: clientId,
      },
    });
    expect(createdOperation.statusCode).toBe(201);
    expect(createdOperation.json()).toMatchObject({ client_id: clientId });

    const filtered = await app.inject({ method: "GET", url: `/api/operations?clientId=${clientId}`, headers: { cookie } });
    expect(filtered.json()).toHaveLength(1);

    const invalidClient = await app.inject({
      method: "PATCH",
      url: `/api/operations/${createdOperation.json().id}`,
      headers: { cookie },
      payload: { client_id: "00000000-0000-4000-8000-000000000000" },
    });
    expect(invalidClient.statusCode).toBe(400);

    const deleted = await app.inject({ method: "DELETE", url: `/api/clients/${clientId}`, headers: { cookie } });
    expect(deleted.statusCode).toBe(204);
    const operations = await app.inject({ method: "GET", url: "/api/operations", headers: { cookie } });
    expect(operations.json()).toMatchObject([{ id: createdOperation.json().id, client_id: null }]);
  });

  it("adds the optional client link when opening an existing database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pubius-client-migration-"));
    const databasePath = join(directory, "pubius.sqlite");
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      CREATE TABLE operations (
        id TEXT PRIMARY KEY,
        fecha_operacion TEXT NOT NULL,
        id_operacion TEXT,
        cuenta_emisora TEXT,
        cuenta_receptora TEXT,
        monto_centavos INTEGER NOT NULL,
        porcentaje_puntos INTEGER NOT NULL,
        ganancia_centavos INTEGER NOT NULL,
        tipo_operacion TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    legacyDatabase.close();

    const app = await buildApp({
      databasePath,
      authEmail: "owner@example.com",
      authPasswordHash: hashPassword("correct-password"),
      cookieSecret: "test-secret-with-at-least-twenty-characters",
      cookieSecure: false,
    });
    try {
      const cookie = await login(app);
      const client = await app.inject({ method: "POST", url: "/api/clients", headers: { cookie }, payload: { title: "Legacy client" } });
      expect(client.statusCode).toBe(201);
      const operation = await app.inject({
        method: "POST",
        url: "/api/operations",
        headers: { cookie },
        payload: { fecha_operacion: "2026-08-26", monto_total: 1, porcentaje_ganancia: 1, tipo_operacion: "Zelle", client_id: client.json().id },
      });
      expect(operation.statusCode).toBe(201);
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("creates, recalculates and deletes operations without floating point storage errors", async () => {
    const app = await createTestApp();
    const cookie = await login(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/operations",
      headers: { cookie },
      payload: {
        fecha_operacion: "2026-08-26",
        monto_total: 123.45,
        porcentaje_ganancia: 2.5,
        tipo_operacion: "Zelle",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ monto_total: 123.45, porcentaje_ganancia: 2.5, ganancia: 3.09 });

    const id = created.json().id;
    const updated = await app.inject({
      method: "PATCH",
      url: `/api/operations/${id}`,
      headers: { cookie },
      payload: { tipo_operacion: "Comisión" },
    });
    expect(updated.json()).toMatchObject({ porcentaje_ganancia: 100, ganancia: 123.45 });

    const listed = await app.inject({ method: "GET", url: "/api/operations", headers: { cookie } });
    expect(listed.json()).toHaveLength(1);

    expect((await app.inject({ method: "DELETE", url: `/api/operations/${id}`, headers: { cookie } })).statusCode).toBe(204);
  });

  it("supports the complete expense lifecycle", async () => {
    const app = await createTestApp();
    const cookie = await login(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/expenses",
      headers: { cookie },
      payload: { nombre_gasto: "Internet", monto: 49.99, fecha: "2026-08-26", categoria: "Servicios" },
    });
    expect(created.statusCode).toBe(201);

    const id = created.json().id;
    const updated = await app.inject({
      method: "PATCH",
      url: `/api/expenses/${id}`,
      headers: { cookie },
      payload: { monto: 50.01 },
    });
    expect(updated.json()).toMatchObject({ monto: 50.01, categoria: "Servicios" });

    expect((await app.inject({ method: "DELETE", url: `/api/expenses/${id}`, headers: { cookie } })).statusCode).toBe(204);
  });

  it("validates calendar dates and filters operation boundaries", async () => {
    const app = await createTestApp();
    const cookie = await login(app);
    const baseOperation = {
      monto_total: 100,
      porcentaje_ganancia: 2,
      tipo_operacion: "Zelle",
    };

    const invalid = await app.inject({
      method: "POST",
      url: "/api/operations",
      headers: { cookie },
      payload: { ...baseOperation, fecha_operacion: "2026-02-30" },
    });
    expect(invalid.statusCode).toBe(400);

    for (const fecha_operacion of ["2026-08-01", "2026-08-15", "2026-09-01"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/operations",
        headers: { cookie },
        payload: { ...baseOperation, fecha_operacion },
      });
      expect(response.statusCode).toBe(201);
    }

    const filtered = await app.inject({
      method: "GET",
      url: "/api/operations?from=2026-08-01&to=2026-08-31",
      headers: { cookie },
    });
    expect(filtered.json().map((operation: { fecha_operacion: string }) => operation.fecha_operacion)).toEqual([
      "2026-08-15",
      "2026-08-01",
    ]);
  });
  it("keeps account holders separate from operation clients", async () => {
    const app = await createTestApp();
    const cookie = await login(app);
    const accountHolder = await app.inject({
      method: "POST",
      url: "/api/account-holders",
      headers: { cookie },
      payload: { name: "Ana", bank: "Mercury" },
    });
    expect(accountHolder.statusCode).toBe(201);
    const holderId = accountHolder.json().id;

    const created = await app.inject({
      method: "POST",
      url: "/api/operations",
      headers: { cookie },
      payload: { fecha_operacion: "2026-08-26", monto_total: 100, porcentaje_ganancia: 2, tipo_operacion: "Zelle", account_holder_id: holderId },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ account_holder_id: holderId, client_id: null });

    const filtered = await app.inject({
      method: "GET",
      url: `/api/operations?accountHolderId=${holderId}`,
      headers: { cookie },
    });
    expect(filtered.json()).toHaveLength(1);
  });


});
