// src/services/metricsService.ts
import fs from "fs";
import path from "path";
import { prisma } from "../db/client";
import { log, logError } from "../utils/logger";

const METRICS_FILE = path.join(process.cwd(), "logs", "metrics.json");
const MAX_LATENCY_SAMPLES = 500;

// Track server start time for uptime calculation
let serverStartTime: number = Date.now();

type StoredMetrics = {
  total_rewrites: number;
  rewrites_by_day: Record<string, number>; // YYYY-MM-DD -> count
  errors_total: number;
  errors_by_day: Record<string, number>;
  latency_samples: number[]; // ms
  tones: Record<string, number>;
  total_input_chars: number;
  total_output_chars: number;
};

const DEFAULT: StoredMetrics = {
  total_rewrites: 0,
  rewrites_by_day: {},
  errors_total: 0,
  errors_by_day: {},
  latency_samples: [],
  tones: {},
  total_input_chars: 0,
  total_output_chars: 0,
};

function ensureLogsDir() {
  const dir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

function readFile(): StoredMetrics {
  try {
    ensureLogsDir();
    if (!fs.existsSync(METRICS_FILE)) {
      fs.writeFileSync(METRICS_FILE, JSON.stringify(DEFAULT, null, 2));
      return { ...DEFAULT };
    }
    const raw = fs.readFileSync(METRICS_FILE, "utf8");
    return JSON.parse(raw) as StoredMetrics;
  } catch (err) {
    logError(`metricsService: readFile error: ${(err as Error).message}`);
    return { ...DEFAULT };
  }
}

function writeFile(data: StoredMetrics) {
  try {
    ensureLogsDir();
    fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logError(`metricsService: writeFile error: ${(err as Error).message}`);
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordRewrite(opts: {
  latencyMs: number;
  inputChars?: number;
  outputChars?: number;
  tone?: string;
}) {
  try {
    const m = readFile();
    m.total_rewrites = (m.total_rewrites || 0) + 1;
    const day = todayKey();
    m.rewrites_by_day[day] = (m.rewrites_by_day[day] || 0) + 1;

    // latency samples (keep rolling)
    m.latency_samples.push(Math.round(opts.latencyMs));
    if (m.latency_samples.length > MAX_LATENCY_SAMPLES) {
      m.latency_samples.shift();
    }

    if (opts.tone) {
      m.tones[opts.tone] = (m.tones[opts.tone] || 0) + 1;
    }

    if (opts.inputChars) m.total_input_chars += opts.inputChars;
    if (opts.outputChars) m.total_output_chars += opts.outputChars;

    writeFile(m);
  } catch (err) {
    logError(`recordRewrite error: ${(err as Error).message}`);
  }
}

export async function recordError() {
  try {
    const m = readFile();
    m.errors_total = (m.errors_total || 0) + 1;
    const day = todayKey();
    m.errors_by_day[day] = (m.errors_by_day[day] || 0) + 1;
    writeFile(m);
  } catch (err) {
    logError(`recordError error: ${(err as Error).message}`);
  }
}

function percentile(arr: number[], fraction: number) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor(fraction * s.length));
  return s[idx];
}

export async function getMetrics() {
  // read stored metrics
  const m = readFile();

  // prepare latency stats
  const latencySamples = m.latency_samples || [];
  const avgLatency =
    latencySamples.length === 0
      ? 0
      : Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length);
  const p95 = percentile(latencySamples, 0.95);
  const p50 = percentile(latencySamples, 0.5);
  const peakLatency = latencySamples.length === 0 ? 0 : Math.max(...latencySamples);

  // today's counts from file
  const today = todayKey();
  const rewrites_today = m.rewrites_by_day[today] || 0;
  const errors_today = m.errors_by_day[today] || 0;

  // use Prisma for user/payment statistics
  const totalUsers = await prisma.user.count();
  const premiumUsers = await prisma.user.count({ where: { isPremium: true } });

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const start30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const activeToday = await prisma.user.count({
    where: { lastUsedAt: { gte: startToday } },
  });
  const active7d = await prisma.user.count({ where: { lastUsedAt: { gte: start7 } } });
  const active30d = await prisma.user.count({ where: { lastUsedAt: { gte: start30 } } });

  // payments in DB
  const paymentsTotal = await prisma.payment.count();
  const payments24h = await prisma.payment.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  // история оплат (последние 30 дней, группировка по дням)
  const paymentsHistory = await prisma.payment.findMany({
    where: {
      createdAt: { gte: start30 },
      status: "succeeded", // только успешные платежи
    },
    select: {
      createdAt: true,
      amount: true,
      currency: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // группировка по дням
  const paymentsByDay: Record<string, { count: number; totalAmount: number }> = {};
  paymentsHistory.forEach((payment) => {
    const day = payment.createdAt.toISOString().slice(0, 10);
    if (!paymentsByDay[day]) {
      paymentsByDay[day] = { count: 0, totalAmount: 0 };
    }
    paymentsByDay[day].count += 1;
    paymentsByDay[day].totalAmount += payment.amount;
  });

  // rewrites total from storage
  const totalRewrites = m.total_rewrites || 0;

  // tones popularity
  const toneCounts = m.tones || {};

  // average lengths
  const avgInputLength =
    m.total_rewrites && m.total_input_chars
      ? Math.round(m.total_input_chars / Math.max(1, totalRewrites))
      : 0;
  const avgOutputLength =
    m.total_rewrites && m.total_output_chars
      ? Math.round(m.total_output_chars / Math.max(1, totalRewrites))
      : 0;

  // errors
  const errorsTotal = m.errors_total || 0;

  // queue metrics: get from rewriteQueue
  let queueLength = null;
  let concurrentTasks = null;
  try {
    const { rewriteQueue } = await import("../services/rewrite/rewriteQueue.js");
    if (rewriteQueue) {
      queueLength = rewriteQueue.queueLength ?? null;
      concurrentTasks = rewriteQueue.concurrentTasks ?? null;
    }
  } catch {
    queueLength = null;
    concurrentTasks = null;
  }

  // Calculate uptime in seconds
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

  return {
    users: {
      total: totalUsers,
      active_today: activeToday,
      active_7d: active7d,
      active_30d: active30d,
      premium: premiumUsers,
    },
    usage: {
      total_rewrites: totalRewrites,
      rewrites_today,
      avg_input_length: avgInputLength,
      avg_output_length: avgOutputLength,
      tones: toneCounts,
    },
    payments: {
      total_payments: paymentsTotal,
      new_payments_24h: payments24h,
      history_30d: paymentsByDay, // история оплат за 30 дней
    },
    errors: {
      total_errors: errorsTotal,
      errors_today,
    },
    system: {
      queue_length: queueLength,
      concurrent_tasks: concurrentTasks,
      latency_avg_ms: avgLatency,
      latency_p50_ms: p50,
      latency_p95_ms: p95,
      latency_peak_ms: peakLatency,
      latency_samples: latencySamples.length,
      uptime_seconds: uptimeSeconds,
    },
  };
}
