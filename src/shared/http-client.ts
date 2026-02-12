// Thin fetch wrapper with configurable timeout via AbortController

const DEFAULT_TIMEOUT_MS = 30_000;

interface HttpRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

interface HttpResponse {
  status: number;
  body: string;
}

export async function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const { url, method = 'GET', headers, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      ...(headers !== undefined ? { headers } : {}),
      ...(body !== undefined ? { body } : {}),
      signal: controller.signal,
    });

    const responseBody = await response.text();

    return {
      status: response.status,
      body: responseBody,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
