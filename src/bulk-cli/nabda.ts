import type { SendResult } from './types.js';

type NabdaConfig = {
  baseUrl: string;
  instanceId: string;
  token: string;
  maxAttempts?: number;
};

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  const base = 500;
  const exp = Math.min(10_000, base * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

export async function sendMessage(
  config: NabdaConfig,
  phoneWithoutPlus: string,
  message: string,
): Promise<SendResult> {
  const maxAttempts = config.maxAttempts ?? 5;
  const url = `${config.baseUrl.replace(/\/+$/, '')}/inst/${config.instanceId}/messages/send`;

  let lastError = 'Unknown error';
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({ phone: phoneWithoutPlus, message }),
      });

      const bodyText = await response.text();
      lastStatus = response.status;

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        return {
          success: false,
          status: 'failed',
          httpStatus: response.status,
          messageId: null,
          error: `Non-JSON response: ${bodyText.slice(0, 200)}`,
        };
      }

      if (response.ok) {
        const messageId =
          typeof parsed.messageId === 'string'
            ? parsed.messageId
            : typeof parsed.id === 'string'
              ? parsed.id
              : typeof parsed.message_id === 'string'
                ? parsed.message_id
                : null;

        return {
          success: true,
          status: 'sent',
          httpStatus: response.status,
          messageId,
          error: null,
        };
      }

      lastError = JSON.stringify(parsed).slice(0, 300);
      const isTransient = TRANSIENT_STATUS.has(response.status);

      if (!isTransient) {
        return {
          success: false,
          status: 'failed',
          httpStatus: response.status,
          messageId: null,
          error: `HTTP ${response.status}: ${lastError}`,
        };
      }

      if (attempt < maxAttempts) {
        await sleep(getBackoffDelay(attempt));
        continue;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) {
        await sleep(getBackoffDelay(attempt));
        continue;
      }
    }
  }

  return {
    success: false,
    status: 'failed',
    httpStatus: lastStatus,
    messageId: null,
    error: lastError,
  };
}
