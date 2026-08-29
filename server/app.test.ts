import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { hashPassword } from "./auth.js";

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
});

describe("financial records", () => {
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
});
