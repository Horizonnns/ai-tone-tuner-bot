import { log, logError } from "./logger";

const samples: number[] = [];
const MAX_SAMPLES = 200;
const ALERT_THRESHOLD_MS = parseInt(
  process.env.LATENCY_ALERT_THRESHOLD_MS || "10000",
  10
);

function percentile(values: number[], perc: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(perc * sorted.length));
  return sorted[idx];
}

export function recordLatencySample(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  samples.push(ms);
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }

  if (samples.length < 10 || samples.length % 10 !== 0) return;
  const avg = samples.reduce((sum, item) => sum + item, 0) / samples.length;
  const p95 = percentile(samples, 0.95);

  log(`Latency metrics: avg=${Math.round(avg)}ms, p95=${Math.round(p95)}ms`);

  if (p95 > ALERT_THRESHOLD_MS) {
    logError(
      `⚠️ Latency alert: p95=${Math.round(p95)}ms over last ${samples.length} samples`
    );
  }
}
