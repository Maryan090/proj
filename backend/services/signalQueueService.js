import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { dataDir, getIncomingSignals, toCsv } from "./dataService.js";
import { buildSignalEvent } from "./signalLookupService.js";

const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const signalQueue = [];
let eventCounter = 1;
let initialized = false;

const SIGNAL_HEADERS = [
  "event_id",
  "signal_id",
  "customer_id",
  "incident_type",
  "first_received_at",
  "last_seen_at",
  "signal_count",
  "source_gateway",
  "device_latitude",
  "device_longitude",
  "battery_level",
  "signal_strength",
  "status",
  "processed_at",
  "priority_score",
  "priority_level",
  "escalation_probability",
  "escalation_required",
  "recommended_responder_profession",
  "assigned_responder_id",
];

export async function ingestSignal({
  signal_id,
  incident_type = "power_outage",
  source_gateway = "local_gateway",
  device_latitude = null,
  device_longitude = null,
  battery_level = null,
  signal_strength = "unknown",
} = {}) {
  await ensureQueueLoaded();
  const signalEvent = await buildSignalEvent(signal_id, incident_type);
  const now = new Date();
  const existing = findRecentActiveSignal(signalEvent.signal_id, now);

  if (existing) {
    existing.last_seen_at = now.toISOString();
    existing.signal_count += 1;
    existing.status = "active";
    existing.battery_level = battery_level ?? existing.battery_level;
    existing.signal_strength = signal_strength || existing.signal_strength;
    existing.device_latitude = device_latitude ?? existing.device_latitude;
    existing.device_longitude = device_longitude ?? existing.device_longitude;
    await persistQueue();
    return { signal_event: existing, deduplicated: true };
  }

  const queuedSignal = {
    event_id: nextEventId(),
    signal_id: signalEvent.signal_id,
    customer_id: signalEvent.customer_id,
    incident_type,
    first_received_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    signal_count: 1,
    source_gateway,
    device_latitude,
    device_longitude,
    battery_level,
    signal_strength,
    status: "queued",
    processed_at: null,
    priority_score: null,
    priority_level: null,
    escalation_probability: null,
    escalation_required: null,
    recommended_responder_profession: null,
    assigned_responder_id: null,
    customer: signalEvent.customer,
  };

  signalQueue.unshift(queuedSignal);
  await persistQueue();
  return { signal_event: queuedSignal, deduplicated: false };
}

export async function listSignals({ status } = {}) {
  await ensureQueueLoaded();
  return signalQueue.filter((signal) => !status || signal.status === status);
}

export async function getSignalEvent(eventId) {
  await ensureQueueLoaded();
  return signalQueue.find((signal) => signal.event_id === eventId);
}

export async function markSignalProcessing(eventId) {
  const signal = await getSignalEvent(eventId);
  if (!signal) {
    throw Object.assign(new Error(`No signal event found for ${eventId}`), { statusCode: 404 });
  }
  signal.status = "processing";
  await persistQueue();
  return signal;
}

export async function markSignalProcessed(eventId, dispatchResult) {
  const signal = await getSignalEvent(eventId);
  if (!signal) {
    throw Object.assign(new Error(`No signal event found for ${eventId}`), { statusCode: 404 });
  }

  signal.status = "prioritized";
  signal.processed_at = new Date().toISOString();
  signal.priority_score = dispatchResult.prediction?.priority_score ?? null;
  signal.priority_level = dispatchResult.prediction?.priority_level ?? null;
  signal.escalation_probability = dispatchResult.prediction?.escalation_probability
    ? Math.round(dispatchResult.prediction.escalation_probability * 100)
    : null;
  signal.escalation_required = dispatchResult.prediction?.escalation_required ?? null;
  signal.recommended_responder_profession = dispatchResult.prediction?.recommended_responder_profession ?? null;
  signal.assigned_responder_id = dispatchResult.responder_options?.[0]?.responder_id ?? null;
  await persistQueue();
  return signal;
}

export async function listResponderCases(responder) {
  const signals = await listSignals();
  return signals
    .filter((signal) => signal.recommended_responder_profession === responder.profession)
    .sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0));
}

async function ensureQueueLoaded() {
  if (initialized) return;
  const rows = await getIncomingSignals();
  signalQueue.splice(0, signalQueue.length, ...rows.map(normalizeSignalRow));
  const maxEventNumber = signalQueue.reduce((max, signal) => {
    const eventNumber = Number(String(signal.event_id).replace("EVT-", ""));
    return Number.isFinite(eventNumber) ? Math.max(max, eventNumber) : max;
  }, 0);
  eventCounter = maxEventNumber + 1;
  initialized = true;
}

async function persistQueue() {
  const rows = signalQueue.map((signal) =>
    Object.fromEntries(SIGNAL_HEADERS.map((header) => [header, signal[header] ?? ""])),
  );
  await writeFile(resolve(dataDir, "incoming_signals.csv"), toCsv(rows, SIGNAL_HEADERS), "utf8");
}

function normalizeSignalRow(row) {
  return {
    ...row,
    signal_count: Number(row.signal_count || 1),
    priority_score: row.priority_score === "" ? null : Number(row.priority_score),
    escalation_probability:
      row.escalation_probability === "" ? null : Number(row.escalation_probability),
    escalation_required:
      row.escalation_required === "" ? null : row.escalation_required === true || row.escalation_required === "true",
  };
}

function findRecentActiveSignal(signalId, now) {
  return signalQueue.find((signal) => {
    if (signal.signal_id !== signalId) return false;
    if (!["queued", "active", "processing", "prioritized"].includes(signal.status)) return false;
    const lastSeen = new Date(signal.last_seen_at);
    return now.getTime() - lastSeen.getTime() <= DEDUPE_WINDOW_MS;
  });
}

function nextEventId() {
  const id = `EVT-${String(eventCounter).padStart(6, "0")}`;
  eventCounter += 1;
  return id;
}
