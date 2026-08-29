import { access, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { verifyPassword } from "./auth.js";
import { AppDatabase } from "./database.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_COOKIE = "pubius_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_ATTEMPTS = 5;

function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateSchema = z.string().refine(isValidDate, "Fecha inválida");

const operationSchema = z.object({
  fecha_operacion: dateSchema,
  id_operacion: z.string().max(200).nullable().optional(),
  cuenta_emisora: z.string().max(200).nullable().optional(),
  cuenta_receptora: z.string().max(200).nullable().optional(),
  monto_total: z.number().finite().nonnegative().max(1_000_000_000),
  porcentaje_ganancia: z.number().finite().nonnegative().max(100),
  tipo_operacion: z.string().min(1).max(100),
});

const expenseSchema = z.object({
  nombre_gasto: z.string().trim().min(1).max(200),
  monto: z.number().finite().nonnegative().max(1_000_000_000),
  fecha: dateSchema,
  categoria: z.enum(["Comidas", "Viajes", "Servicios", "Personal"]),
});

export interface AppOptions {
  databasePath: string;
  authEmail: string;
  authPasswordHash: string;
  cookieSecret: string;
  cookieSecure: boolean;
  openAiApiKey?: string;
  staticDirectory?: string;
  backupDirectory?: string;
  backupIntervalHours?: number;
  backupRetention?: number;
  logger?: boolean;
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    reply.code(400).send({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors });
    return null;
  }
  return parsed.data;
}

export async function buildApp(options: AppOptions) {
  if (options.cookieSecret.length < 20) {
    throw new Error("SESSION_SECRET must contain at least 20 characters");
  }

  const app = Fastify({ logger: options.logger ?? false, trustProxy: true });
  const database = new AppDatabase(options.databasePath);
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  await app.register(cookie, { secret: options.cookieSecret });
  await app.register(multipart, {
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
  });

  app.addHook("onClose", async () => database.close());

  if (options.backupDirectory) {
    const intervalHours = options.backupIntervalHours ?? 24;
    const retention = options.backupRetention ?? 7;
    if (!Number.isFinite(intervalHours) || intervalHours <= 0 || !Number.isInteger(retention) || retention < 1) {
      throw new Error("Backup interval must be positive and retention must be at least 1");
    }
    const createBackup = async () => {
      const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      await database.backup(join(options.backupDirectory!, `pubius-${timestamp}.sqlite`));
      const files = (await readdir(options.backupDirectory!))
        .filter((name) => name.startsWith("pubius-") && name.endsWith(".sqlite"))
        .sort()
        .reverse();
      await Promise.all(files.slice(retention).map((name) => unlink(join(options.backupDirectory!, name))));
    };
    await createBackup();
    const backupTimer = setInterval(() => {
      void createBackup().catch((error) => app.log.error(error, "SQLite backup failed"));
    }, intervalHours * 60 * 60 * 1_000);
    backupTimer.unref();
    app.addHook("onClose", async () => clearInterval(backupTimer));
  }

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?", 1)[0];
    if (!path.startsWith("/api") || path === "/api/health" || path === "/api/auth/login") {
      return;
    }

    const cookieValue = request.cookies[SESSION_COOKIE];
    const session = cookieValue ? request.unsignCookie(cookieValue) : null;
    const [email, expiresAt] = session?.valid && session.value ? session.value.split("|") : [];
    if (!session?.valid || email !== options.authEmail || Number(expiresAt) <= Date.now()) {
      return reply.code(401).send({ error: "No autenticado" });
    }
  });

  app.get("/api/health", async (_request, reply) => {
    if (!database.isHealthy()) {
      return reply.code(503).send({ status: "error" });
    }
    return { status: "ok" };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const now = Date.now();
    const attempts = loginAttempts.get(request.ip);
    if (attempts && attempts.resetAt > now && attempts.count >= LOGIN_ATTEMPTS) {
      return reply.code(429).send({ error: "Demasiados intentos. Probá nuevamente en un minuto" });
    }
    if (attempts && attempts.resetAt <= now) {
      loginAttempts.delete(request.ip);
    }

    const credentials = parseBody(
      z.object({ email: z.string().email(), password: z.string().min(1).max(500) }),
      request.body,
      reply,
    );
    if (!credentials) return;

    const emailMatches = credentials.email.trim().toLowerCase() === options.authEmail.toLowerCase();
    const passwordMatches = verifyPassword(credentials.password, options.authPasswordHash);
    if (!emailMatches || !passwordMatches) {
      const current = loginAttempts.get(request.ip);
      loginAttempts.set(request.ip, {
        count: (current?.count ?? 0) + 1,
        resetAt: current?.resetAt ?? now + LOGIN_WINDOW_MS,
      });
      return reply.code(401).send({ error: "Email o contraseña incorrectos" });
    }

    loginAttempts.delete(request.ip);
    reply.setCookie(SESSION_COOKIE, `${options.authEmail}|${now + SESSION_MAX_AGE_SECONDS * 1_000}`, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: options.cookieSecure,
      signed: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return { user: { email: options.authEmail } };
  });

  app.get("/api/auth/session", async () => ({ user: { email: options.authEmail } }));

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/api/operations", async (request, reply) => {
    const query = parseBody(
      z.object({ from: dateSchema.optional(), to: dateSchema.optional() }),
      request.query,
      reply,
    );
    if (!query) return;
    return database.listOperations(query.from, query.to);
  });

  app.post("/api/operations", async (request, reply) => {
    const input = parseBody(operationSchema, request.body, reply);
    if (!input) return;
    return reply.code(201).send(database.createOperation(input));
  });

  app.patch<{ Params: { id: string } }>("/api/operations/:id", async (request, reply) => {
    const update = parseBody(operationSchema.partial().refine((value) => Object.keys(value).length > 0), request.body, reply);
    if (!update) return;
    const operation = database.updateOperation(request.params.id, update);
    return operation ?? reply.code(404).send({ error: "Operación no encontrada" });
  });

  app.delete<{ Params: { id: string } }>("/api/operations/:id", async (request, reply) => {
    if (!database.deleteOperation(request.params.id)) {
      return reply.code(404).send({ error: "Operación no encontrada" });
    }
    return reply.code(204).send();
  });

  app.get("/api/expenses", async () => database.listExpenses());

  app.post("/api/expenses", async (request, reply) => {
    const input = parseBody(expenseSchema, request.body, reply);
    if (!input) return;
    return reply.code(201).send(database.createExpense(input));
  });

  app.patch<{ Params: { id: string } }>("/api/expenses/:id", async (request, reply) => {
    const update = parseBody(expenseSchema.partial().refine((value) => Object.keys(value).length > 0), request.body, reply);
    if (!update) return;
    const expense = database.updateExpense(request.params.id, update);
    return expense ?? reply.code(404).send({ error: "Egreso no encontrado" });
  });

  app.delete<{ Params: { id: string } }>("/api/expenses/:id", async (request, reply) => {
    if (!database.deleteExpense(request.params.id)) {
      return reply.code(404).send({ error: "Egreso no encontrado" });
    }
    return reply.code(204).send();
  });

  app.post("/api/binance-p2p", async (request, reply) => {
    const input = parseBody(
      z.object({
        tradeType: z.enum(["BUY", "SELL"]).default("BUY"),
        fiat: z.string().default("USD"),
        asset: z.string().default("USDT"),
        rows: z.number().int().min(1).max(50).default(20),
        page: z.number().int().min(1).default(1),
        payTypes: z.array(z.string()).optional(),
      }),
      request.body,
      reply,
    );
    if (!input) return;

    let response: Response;
    try {
      response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, publisherType: null }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      request.log.error(error, "Binance API request failed");
      return reply.code(502).send({ error: "No se pudieron obtener cotizaciones" });
    }
    if (!response.ok) {
      request.log.error({ status: response.status }, "Binance API request failed");
      return reply.code(502).send({ error: "No se pudieron obtener cotizaciones" });
    }

    const result = await response.json() as { data?: Array<{ advertiser?: Record<string, unknown>; adv?: Record<string, unknown> }> };
    const ads = (result.data ?? []).map(({ advertiser = {}, adv = {} }) => ({
      advertiserName: advertiser.nickName ?? "Unknown",
      price: adv.price ?? "0",
      minLimit: adv.minSingleTransAmount ?? "0",
      maxLimit: adv.dynamicMaxSingleTransAmount ?? adv.maxSingleTransAmount ?? "0",
      available: adv.surplusAmount ?? "0",
      paymentMethods: Array.isArray(adv.tradeMethods)
        ? adv.tradeMethods.map((method) => {
            const value = method as Record<string, unknown>;
            return value.tradeMethodName ?? value.identifier;
          }).filter(Boolean)
        : [],
      completionRate: (Number(advertiser.monthFinishRate ?? 0) * 100).toFixed(1),
      orderCount: Number(advertiser.monthOrderCount ?? 0),
      tradeType: input.tradeType,
    }));

    return { ads, success: true };
  });

  app.post("/api/transcriptions", async (request, reply) => {
    if (!options.openAiApiKey) {
      return reply.code(503).send({ error: "La transcripción de voz no está configurada" });
    }
    const audio = await request.file();
    if (!audio) {
      return reply.code(400).send({ error: "No se recibió audio" });
    }

    const form = new FormData();
    form.append("file", new Blob([await audio.toBuffer()], { type: audio.mimetype }), audio.filename || "audio.webm");
    form.append("model", "whisper-1");
    form.append("language", "es");
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${options.openAiApiKey}` },
        body: form,
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      request.log.error(error, "OpenAI transcription failed");
      return reply.code(502).send({ error: "No se pudo transcribir el audio" });
    }
    if (!response.ok) {
      request.log.error({ status: response.status }, "OpenAI transcription failed");
      return reply.code(502).send({ error: "No se pudo transcribir el audio" });
    }
    const result = await response.json() as { text?: string };
    return { text: result.text ?? "" };
  });

  if (options.staticDirectory) {
    const staticRoot = resolve(options.staticDirectory);
    await access(staticRoot);
    await app.register(fastifyStatic, { root: staticRoot });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Ruta no encontrada" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
