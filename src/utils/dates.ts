// src/utils/dates.ts
// Utilitários de datas usados em filtros (mapa/relatórios).
// Mantém helpers já existentes + adiciona lógica de intervalo máximo (3 meses) para Reports.

export type DaysBucket = "<70" | "70-90" | "90-180" | "180-360" | ">360";

export function daysAgoDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDateRangeForBucket(bucket: DaysBucket) {
  const now = new Date();
  if (bucket === "<70") return { start: daysAgoDate(70), end: now, mode: "range" as const };
  if (bucket === "70-90") return { start: daysAgoDate(90), end: daysAgoDate(70), mode: "range" as const };
  if (bucket === "90-180") return { start: daysAgoDate(180), end: daysAgoDate(90), mode: "range" as const };
  if (bucket === "180-360") return { start: daysAgoDate(360), end: daysAgoDate(180), mode: "range" as const };
  return { start: null, end: daysAgoDate(360), mode: "older" as const };
}

// ===============================
// Reports: datas obrigatórias + limite máximo de intervalo (por meses de calendário)
// ===============================

export function startOfCurrentMonth(now: Date = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfToday(now: Date = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export function toInputDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Soma meses respeitando calendário.
 * Ex.: 31/jan + 1 mês -> 28/fev (ou 29 em ano bissexto)
 */
export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  // ajusta o dia para o último dia do mês se necessário
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));

  return d;
}

/**
 * Retorna true se o range [start, end] estiver dentro de no máximo N meses
 * (comparação por calendário, não por "90 dias").
 *
 * Regra: end <= addMonths(start, maxMonths)
 */
export function isRangeWithinMaxMonths(start: Date, end: Date, maxMonths: number) {
  const maxEnd = addMonths(start, maxMonths);
  return end <= maxEnd;
}
