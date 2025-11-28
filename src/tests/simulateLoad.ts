import { openaiClient } from "../services/openai/openaiClient";
import { log, logError } from "../utils/logger";

const TOTAL_USERS = 100;
const REQUESTS_PER_USER = 5;
const BATCH_SIZE = 10; // сколько запросов одновременно
const PAUSE_BETWEEN_BATCHES = 200; // мс
const RETRIES = 2;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeRequest(userId: number, reqIndex: number) {
  const text = `Load test sample from user ${userId}, request ${reqIndex}`;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a copywriter. Rewrite text in friendly tone. Make it natural and readable, but not overdecorated.",
      },
      { role: "user", content: `Rewrite this: ${text}` },
    ],
    max_tokens: 40,
  };

  let attempts = 0;
  const startedAt = Date.now();

  while (attempts <= RETRIES) {
    try {
      const res = await openaiClient.chat.completions.create(payload as any);
      const latency = Date.now() - startedAt;

      return {
        ok: true,
        latency,
        result: res.choices[0]?.message?.content ?? "",
      };
    } catch (e: any) {
      attempts++;
      if (attempts > RETRIES) {
        return { ok: false, error: e?.message ?? "Unknown error" };
      }
      await delay(200 * attempts);
    }
  }
}

async function simulateLoad() {
  log("🚀 Starting load test…");

  const totalRequests = TOTAL_USERS * REQUESTS_PER_USER;
  let completed = 0;
  let failed = 0;
  const latencies: number[] = [];

  const allJobs = [];

  for (let user = 0; user < TOTAL_USERS; user++) {
    for (let r = 0; r < REQUESTS_PER_USER; r++) {
      allJobs.push({ user, r });
    }
  }

  for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
    const batch = allJobs.slice(i, i + BATCH_SIZE);

    log(`▶️ Running batch ${i / BATCH_SIZE + 1}`);

    const results = await Promise.all(batch.map((job) => safeRequest(job.user, job.r)));

    for (const r of results) {
      if (r.ok) {
        completed++;
        latencies.push(r.latency);
      } else {
        failed++;
        logError(`❌ Failed: ${r.error}`);
      }
    }

    await delay(PAUSE_BETWEEN_BATCHES);
  }

  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b) / latencies.length)
      : 0;

  log("📊 Load test finished:");
  log(`Total: ${totalRequests}`);
  log(`Succeeded: ${completed}`);
  log(`Failed: ${failed}`);
  log(`Average latency: ${avgLatency} ms`);
}

simulateLoad();
