import { AnimuApiError } from "./errors.js";

/** Per-call overrides for {@link HttpClient} requests. */
export interface RequestOptions {
  /** Query parameters appended to the URL. */
  params?: Record<string, string | number | boolean>;
  /** Extra headers merged over the client defaults. */
  headers?: Record<string, string>;
  /** Timeout override in ms; falls back to the client default. */
  timeout?: number;
  /** `"text"` returns the raw body; `"json"` (default) tries JSON first. */
  responseType?: "json" | "text";
  /** Bypass the GET micro-cache for this call. */
  noCache?: boolean;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

/**
 * Minimal fetch wrapper: timeout via AbortController, short-lived GET
 * micro-cache (protects against rapid-poll stampedes), FormData handling
 * and uniform {@link AnimuApiError} wrapping. Zero dependencies — works in
 * browsers, Node >= 18 and React Native.
 */
export class HttpClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheDuration = 2500;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout: number;

  /**
   * @param userAgent - Sent as the User-Agent header on every request.
   * @param timeout - Default per-request timeout in ms.
   */
  constructor(userAgent: string, timeout: number) {
    this.defaultHeaders = {
      "User-Agent": userAgent,
      "Content-Type": "application/json",
    };
    this.defaultTimeout = timeout;
  }

  /** Appends `params` as a query string; returns the URL untouched when empty. */
  private buildUrl(
    url: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    if (!params || Object.keys(params).length === 0) return url;
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.append(key, String(value));
    }
    return `${url}?${searchParams.toString()}`;
  }

  /**
   * Parses the body according to `responseType`. JSON parsing failures fall
   * back to the raw text — many Animu endpoints echo plain strings.
   */
  private parseBody<T>(text: string, responseType?: "json" | "text"): T {
    if (responseType === "text") return text as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** Core request: applies headers/timeout, normalizes all failures to {@link AnimuApiError}. */
  private async request<T>(
    method: "GET" | "POST",
    url: string,
    body?: BodyInit,
    options?: RequestOptions,
  ): Promise<T> {
    const fullUrl = this.buildUrl(url, options?.params);
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout ?? this.defaultTimeout,
    );

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options?.headers,
    };
    if (body instanceof FormData) {
      delete headers["Content-Type"]; // let fetch set the boundary
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AnimuApiError(
          `HTTP error ${response.status}`,
          response.status,
          { method, url: fullUrl },
        );
      }

      return this.parseBody<T>(await response.text(), options?.responseType);
    } catch (error) {
      if (error instanceof AnimuApiError) throw error;
      const isAbort =
        error instanceof DOMException && error.name === "AbortError";
      const message = isAbort
        ? `Request timed out after ${options?.timeout ?? this.defaultTimeout}ms`
        : error instanceof Error
          ? error.message
          : "Unknown error";
      throw new AnimuApiError(message, 0, { method, url: fullUrl });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * GET with a 2.5s micro-cache: identical URLs within the window return the
   * cached response without hitting the network. Pass `noCache` to force a
   * fresh fetch.
   */
  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    const fullUrl = this.buildUrl(url, options?.params);
    const cacheKey = `GET:${fullUrl}`;
    const cached = this.cache.get(cacheKey);
    if (!options?.noCache && cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data as T;
    }

    const data = await this.request<T>("GET", url, undefined, options);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /** POST — never cached. FormData bodies are sent as-is (boundary set by fetch). */
  async post<T>(
    url: string,
    body?: BodyInit,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("POST", url, body, options);
  }

  /** Drops every cached response. */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Converts a flat object to `multipart/form-data`.
 * `null`/`undefined` values are skipped; nested objects are JSON-stringified;
 * everything else is stringified (booleans become `"true"`/`"false"`).
 */
export function toFormData(input: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
}
