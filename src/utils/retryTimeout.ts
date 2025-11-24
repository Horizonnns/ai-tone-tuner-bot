import { logError } from "./logger";

export const DEFAULT_TIMEOUT = 60000; // 60 seconds
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000; // Start with 1 second

// Network error codes that can be retried
const RETRYABLE_CODES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
];

// HTTP status codes that can be retried
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

// OpenAI-specific error types that can be retried
const RETRYABLE_OPENAI_TYPES = ["rate_limit_error", "server_error", "timeout"];

export interface RetryableError {
  code?: string;
  status?: number;
  type?: string;
  message?: string;
  response?: {
    status?: number;
  };
}

/**
 * Checks if an error is retryable (network errors, timeouts, server errors)
 */
export function isRetryableError(error: RetryableError | null | undefined): boolean {
  if (!error) return false;

  const code = error.code || error.response?.status;
  const status = error.status || error.response?.status;
  const type = error.type || "";
  const message = (error.message || "").toLowerCase();

  return (
    RETRYABLE_CODES.includes(code as string) ||
    RETRYABLE_STATUSES.includes(status as number) ||
    RETRYABLE_STATUSES.includes(code as number) ||
    RETRYABLE_OPENAI_TYPES.includes(type) ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("rate limit")
  );
}

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Retry wrapper for async functions with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    delayMs = DEFAULT_RETRY_DELAY_MS,
    onRetry,
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt || !isRetryableError(error)) {
        throw error;
      }

      const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff

      if (onRetry) {
        onRetry(attempt, error);
      } else {
        logError(
          `Request failed (attempt ${attempt}/${maxRetries}): ${
            error.message || error.type || "Unknown error"
          }. Retrying in ${waitTime}ms...`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error("Retry loop completed without returning");
}
