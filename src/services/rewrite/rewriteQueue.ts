import { recordRewrite, recordError } from "../../services/metricsService";
import { rewriteWithOpenAI, RewriteCallOptions, RewriteResult } from "../openai/openai";

export interface RewriteJobOptions extends RewriteCallOptions {
  text: string;
  tone: string;
  telegramId?: string;
}

type QueueJob = {
  options: RewriteJobOptions;
  resolve: (value: RewriteResult) => void;
  reject: (reason?: any) => void;
};

class RewriteQueue {
  private concurrency: number;
  private running = 0;
  private queue: QueueJob[] = [];

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue(options: RewriteJobOptions) {
    return new Promise<RewriteResult>((resolve, reject) => {
      this.queue.push({ options, resolve, reject });
      this.process();
    });
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get concurrentTasks(): number {
    return this.running;
  }

  private async process() {
    if (this.running >= this.concurrency) return;
    const job = this.queue.shift();
    if (!job) return;

    this.running += 1;

    try {
      const result = await rewriteWithOpenAI(
        job.options.text,
        job.options.tone,
        job.options.telegramId
      );

      // сохранить метрику
      recordRewrite({
        latencyMs: result.latency,
        inputChars: job.options.text?.length || 0,
        outputChars: result.result?.length || 0,
        tone: job.options.tone,
      }).catch(() => {});

      job.resolve(result);
    } catch (err) {
      recordError().catch(() => {});

      job.reject(err);
    } finally {
      this.running -= 1;
      if (this.queue.length > 0) {
        setImmediate(() => this.process());
      }
    }
  }
}

const DEFAULT_CONCURRENCY = parseInt(process.env.REWRITE_MAX_CONCURRENCY || "3", 10);

export const rewriteQueue = new RewriteQueue(DEFAULT_CONCURRENCY);
