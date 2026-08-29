import nodemailer from "nodemailer";
import type { AppDatabase } from "./database.js";

export interface OperationRecord {
  fecha_operacion: string;
  id_operacion: string | null;
  cuenta_emisora: string | null;
  cuenta_receptora: string | null;
  monto_total: number;
  porcentaje_ganancia: number;
  ganancia: number;
  tipo_operacion: string;
}

export interface SmtpOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
}

export interface ReportMailer {
  send(input: { to: string; subject: string; text: string; html: string; csv: string; period: string }): Promise<void>;
}

export interface ReportFigures {
  count: number;
  totalAmount: number;
  totalGain: number;
  averagePercentage: number;
  byType: Array<{ tipo_operacion: string; count: number; amount: number; gain: number }>;
}

export interface BuiltReport {
  period: string;
  subject: string;
  text: string;
  html: string;
  csv: string;
  figures: ReportFigures;
  operations: readonly OperationRecord[];
}

const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";
const DEFAULT_REPORT_HOUR = 8;

function formatMoney(value: number): string {
  return `$${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return capitalize(label);
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function csvValue(value: string | null | undefined): string {
  const text = value ?? "";
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(operations: readonly OperationRecord[]): string {
  const header = ["Fecha", "ID", "Emisora", "Receptora", "Monto", "Porcentaje", "Tipo", "Ganancia"];
  const rows = operations.map((operation) =>
    [
      csvValue(operation.fecha_operacion),
      csvValue(operation.id_operacion),
      csvValue(operation.cuenta_emisora),
      csvValue(operation.cuenta_receptora),
      csvValue(operation.monto_total.toFixed(2)),
      csvValue(operation.porcentaje_ganancia.toFixed(2)),
      csvValue(operation.tipo_operacion),
      csvValue(operation.ganancia.toFixed(2)),
    ].join(";"),
  );
  return `\uFEFF${[header.join(";"), ...rows].join("\r\n")}\r\n`;
}

export function computeFigures(operations: readonly OperationRecord[]): ReportFigures {
  const byType = new Map<string, { count: number; amount: number; gain: number }>();
  let totalAmount = 0;
  let totalGain = 0;
  for (const operation of operations) {
    totalAmount += operation.monto_total;
    totalGain += operation.ganancia;
    const bucket = byType.get(operation.tipo_operacion) ?? { count: 0, amount: 0, gain: 0 };
    bucket.count += 1;
    bucket.amount += operation.monto_total;
    bucket.gain += operation.ganancia;
    byType.set(operation.tipo_operacion, bucket);
  }
  return {
    count: operations.length,
    totalAmount,
    totalGain,
    averagePercentage: totalAmount > 0 ? (totalGain / totalAmount) * 100 : 0,
    byType: [...byType].map(([tipo_operacion, values]) => ({ tipo_operacion, ...values })),
  };
}

export function buildMonthlyReport(period: string, operations: readonly OperationRecord[]): BuiltReport {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const from = `${period}-01`;
  const to = `${period}-${String(lastDay).padStart(2, "0")}`;
  const label = monthLabel(year, month);
  const figures = computeFigures(operations);

  const byTypeLines = figures.byType
    .map(
      (entry) =>
        `- ${entry.tipo_operacion}: ${entry.count} operación(es) — ${formatMoney(entry.amount)} — ganancia ${formatMoney(entry.gain)}`,
    )
    .join("\n");

  const detailLines = operations.length === 0
    ? "No hubo operaciones en este período."
    : operations
        .map(
          (operation, index) =>
            `${index + 1}. ${formatDate(operation.fecha_operacion)} — ${formatMoney(operation.monto_total)} al ${formatPercent(operation.porcentaje_ganancia)} — ${operation.tipo_operacion} — ganancia ${formatMoney(operation.ganancia)}` +
            (operation.id_operacion ? ` — ID ${operation.id_operacion}` : ""),
        )
        .join("\n");

  const text = [
    `Informe mensual de operaciones — ${label}`,
    `Período: ${formatDate(from)} al ${formatDate(to)}`,
    "",
    `Operaciones: ${figures.count}`,
    `Volumen total: ${formatMoney(figures.totalAmount)}`,
    `Ganancia total: ${formatMoney(figures.totalGain)}`,
    `Porcentaje promedio: ${formatPercent(figures.averagePercentage)}`,
    "",
    "Totales por tipo de operación:",
    byTypeLines || "- Sin operaciones",
    "",
    "Detalle:",
    detailLines,
    "",
    "Se adjunta el detalle completo en CSV.",
  ].join("\n");

  const summaryRows = [
    `<tr><td>Operaciones</td><td><strong>${figures.count}</strong></td></tr>`,
    `<tr><td>Volumen total</td><td><strong>${formatMoney(figures.totalAmount)}</strong></td></tr>`,
    `<tr><td>Ganancia total</td><td><strong>${formatMoney(figures.totalGain)}</strong></td></tr>`,
    `<tr><td>Porcentaje promedio</td><td><strong>${formatPercent(figures.averagePercentage)}</strong></td></tr>`,
  ].join("");

  const byTypeRows = figures.byType
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.tipo_operacion)}</td><td>${entry.count}</td><td>${formatMoney(entry.amount)}</td><td>${formatMoney(entry.gain)}</td></tr>`,
    )
    .join("");

  const operationRows = operations.length === 0
    ? '<tr><td colspan="8">No hubo operaciones en este período.</td></tr>'
    : operations
        .map(
          (operation) => `<tr>
            <td>${formatDate(operation.fecha_operacion)}</td>
            <td>${escapeHtml(operation.id_operacion)}</td>
            <td>${escapeHtml(operation.cuenta_emisora)}</td>
            <td>${escapeHtml(operation.cuenta_receptora)}</td>
            <td>${formatMoney(operation.monto_total)}</td>
            <td>${formatPercent(operation.porcentaje_ganancia)}</td>
            <td>${escapeHtml(operation.tipo_operacion)}</td>
            <td>${formatMoney(operation.ganancia)}</td>
          </tr>`,
        )
        .join("");

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(label)}</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6;">
    <div style="max-width: 720px; margin: 0 auto; background: #ffffff; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">Informe mensual de operaciones</h1>
      <p style="color: #6b7280; margin: 0 0 20px;">${label}<br />${formatDate(from)} al ${formatDate(to)}</p>
      <h2 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 20px 0 8px;">Resumen</h2>
      <table style="border-collapse: collapse; width: 100%;">
        ${summaryRows}
      </table>
      <h2 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 20px 0 8px;">Totales por tipo</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Tipo</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Operaciones</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Volumen</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Ganancia</th>
          </tr>
        </thead>
        <tbody>${byTypeRows}</tbody>
      </table>
      <h2 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 20px 0 8px;">Detalle</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Fecha</th>
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">ID</th>
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Emisora</th>
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Receptora</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Monto</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Porc.</th>
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Tipo</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Ganancia</th>
          </tr>
        </thead>
        <tbody>${operationRows}</tbody>
      </table>
    </div>
  </body>
</html>`;

  return {
    period,
    subject: `Informe mensual de operaciones — ${label}`,
    text,
    html,
    csv: buildCsv(operations),
    figures,
    operations,
  };
}

export function timePartsInZone(now: Date, timeZone: string): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

function previousMonthPeriod(year: number, month: number): string {
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function duePeriod(
  now: Date,
  timeZone: string,
  reportHour: number,
  sent: ReadonlySet<string>,
): string | null {
  const { year, month, day, hour } = timePartsInZone(now, timeZone);
  if (day === 1 && hour < reportHour) return null;
  const period = previousMonthPeriod(year, month);
  return sent.has(period) ? null : period;
}

export async function runDueReports(
  database: AppDatabase,
  mailer: ReportMailer,
  to: string,
  options: { now?: Date; timeZone?: string; reportHour?: number } = {},
): Promise<{ period: string; count: number } | null> {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const reportHour = options.reportHour ?? DEFAULT_REPORT_HOUR;
  const sent = database.listSentReportPeriods();
  const period = duePeriod(now, timeZone, reportHour, sent);
  if (!period) return null;

  const [yearText, monthText] = period.split("-");
  const lastDay = new Date(Date.UTC(Number(yearText), Number(monthText), 0)).getUTCDate();
  const operations = database.listOperations(`${period}-01`, `${period}-${String(lastDay).padStart(2, "0")}`);
  const report = buildMonthlyReport(period, operations);
  await mailer.send({
    to,
    subject: report.subject,
    text: report.text,
    html: report.html,
    csv: report.csv,
    period,
  });
  database.markReportSent(period);
  return { period, count: operations.length };
}

export function createSmtpMailer(options: SmtpOptions): ReportMailer {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.port === 465,
    auth: { user: options.user, pass: options.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return {
    send: async ({ to, subject, text, html, csv, period }) => {
      await transporter.sendMail({
        from: { name: "Pubius Tracker", address: options.from },
        to,
        subject,
        text,
        html,
        attachments: [{ filename: `operaciones-${period}.csv`, content: csv, contentType: "text/csv; charset=utf-8" }],
      });
    },
  };
}