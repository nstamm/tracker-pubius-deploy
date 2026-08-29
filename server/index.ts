import { buildApp } from "./app.js";

if (process.env.NODE_ENV !== "production") {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

const required = ["AUTH_EMAIL", "AUTH_PASSWORD_HASH", "SESSION_SECRET"] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required`);
  }
}

const app = await buildApp({
  databasePath: process.env.DATABASE_PATH ?? "./data/pubius.sqlite",
  authEmail: process.env.AUTH_EMAIL!,
  authPasswordHash: process.env.AUTH_PASSWORD_HASH!,
  cookieSecret: process.env.SESSION_SECRET!,
  cookieSecure: process.env.COOKIE_SECURE !== "false",
  openAiApiKey: process.env.OPENAI_API_KEY,
  staticDirectory: process.env.STATIC_DIRECTORY ?? (process.env.NODE_ENV === "production" ? "./dist" : undefined),
  backupDirectory: process.env.BACKUP_DIRECTORY,
  backupIntervalHours: Number(process.env.BACKUP_INTERVAL_HOURS ?? 24),
  backupRetention: Number(process.env.BACKUP_RETENTION ?? 7),
  logger: true,
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
});
