import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
export const dataDir = resolve(projectRoot, "data");

const cache = new Map();

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, coerceValue(record[index] ?? "")])),
  );
}

export function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows, headers = Object.keys(rows[0] || {})) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function coerceValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export async function loadCsv(fileName) {
  if (cache.has(fileName)) return cache.get(fileName);
  const text = await readFile(resolve(dataDir, fileName), "utf8");
  const parsed = parseCsv(text);
  cache.set(fileName, parsed);
  return parsed;
}

export async function getCustomers() {
  return loadCsv("customers.csv");
}

export async function getResponders() {
  return loadCsv("responders.csv");
}

export async function getDisasterZones() {
  return loadCsv("disaster_zones.csv");
}

export async function getShelters() {
  return loadCsv("shelters.csv");
}

export async function getHistoricalCases() {
  return loadCsv("historical_cases.csv");
}

export async function getIncomingSignals() {
  return loadCsv("incoming_signals.csv");
}

export function clearDataCache() {
  cache.clear();
}
