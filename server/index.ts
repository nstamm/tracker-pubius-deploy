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

const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
if (smtpHost || smtpUser || smtpPassword) {
  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASSWORD are all required to enable monthly email reports");
  }
}
const smtpEnabled = Boolean(smtpHost && smtpUser && smtpPassword);
if (smtpEnabled) {
  const port = Number(process.env.SMTP_PORT ?? 465);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }
  const reportHour = process.env.REPORT_HOUR ? Number(process.env.REPORT_HOUR) : undefined;
  if (reportHour !== undefined && (!Number.isInteger(reportHour) || reportHour < 0 || reportHour > 23)) {
    throw new Error("REPORT_HOUR must be an integer between 0 and 23");
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
  smtp: smtpEnabled
    ? {
        host: smtpHost!,
        port: Number(process.env.SMTP_PORT ?? 465),
        user: smtpUser!,
        password: smtpPassword!,
        from: process.env.REPORT_FROM ?? smtpUser!,
        to: process.env.REPORT_RECIPIENT ?? smtpUser!,
      }
    : undefined,
  reportTimeZone: process.env.REPORT_TIMEZONE,
  reportHour: process.env.REPORT_HOUR ? Number(process.env.REPORT_HOUR) : undefined,
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
