import { CONFIG } from "../../utils/player.config";
import { HttpRequestError } from "../../core/errors/http.error";

type LogLevel = "info" | "warn" | "error" | "debug";

const logger = {
  log: (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [HTTP Client] [${level.toUpperCase()}]`;
    const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : "";

    switch (level) {
      case "error":
        console.error(`${prefix} ${message}${metaStr}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}${metaStr}`);
        break;
      case "debug":
        console.debug(`${prefix} ${message}${metaStr}`);
        break;
      default:
        console.log(`${prefix} ${message}${metaStr}`);
    }
  },
};

interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: "json" | "text";
}

class FetchHttpClient {
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_DURATION = 2500;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout: number;

  constructor() {
    this.cache = new Map();
    this.defaultHeaders = {
      "User-Agent": CONFIG.USER_AGENT,
      "Content-Type": "application/json",
    };
    this.defaultTimeout = 20000;
  }

  private getCacheKey(method: string, url: string): string {
    return `${method}:${url}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

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

  async get<T = any>(
    url: string,
    options?: RequestOptions,
  ): Promise<{ data: T }> {
    const fullUrl = this.buildUrl(url, options?.params);
    const cacheKey = this.getCacheKey("GET", fullUrl);
    const cachedData = this.cache.get(cacheKey);

    if (cachedData && this.isCacheValid(cachedData.timestamp)) {
      return { data: cachedData.data };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout ?? this.defaultTimeout,
    );

    try {
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: { ...this.defaultHeaders, ...options?.headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        const level: LogLevel = response.status >= 500 ? "error" : "warn";
        logger.log(level, `Request failed`, {
          method: "GET",
          url: fullUrl,
          status: response.status,
          statusText: response.statusText,
        });
        throw new HttpRequestError(
          `HTTP error ${response.status}`,
          response.status,
          { method: "GET", url: fullUrl },
        );
      }

      let data: T;
      if (options?.responseType === "text") {
        data = (await response.text()) as any;
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text as any;
        }
      }

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return { data };
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.log("error", `Unexpected error in HTTP client`, { message });
      throw new HttpRequestError(message, 0, { method: "GET", url: fullUrl });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async post<T = any>(
    url: string,
    body?: any,
    options?: RequestOptions,
  ): Promise<{ data: T }> {
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
    let fetchBody: BodyInit | undefined;

    if (body instanceof FormData) {
      delete headers["Content-Type"]; // Let fetch set it with boundary
      fetchBody = body;
    } else if (body !== undefined) {
      fetchBody = JSON.stringify(body);
    }

    try {
      const response = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: fetchBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        const level: LogLevel = response.status >= 500 ? "error" : "warn";
        logger.log(level, `Request failed`, {
          method: "POST",
          url: fullUrl,
          status: response.status,
          statusText: response.statusText,
        });
        throw new HttpRequestError(
          `HTTP error ${response.status}`,
          response.status,
          { method: "POST", url: fullUrl },
        );
      }

      let data: T;
      if (options?.responseType === "text") {
        data = (await response.text()) as any;
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text as any;
        }
      }

      return { data };
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.log("error", `Unexpected error in HTTP client`, { message });
      throw new HttpRequestError(message, 0, { method: "POST", url: fullUrl });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

const api = new FetchHttpClient();
export { api };
