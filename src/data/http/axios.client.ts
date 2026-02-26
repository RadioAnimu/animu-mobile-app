import axios, { AxiosInstance, AxiosResponse } from "axios";
import { CONFIG } from "../../utils/player.config";
import { HttpRequestError } from "../../core/errors/http.error";
import { API } from "../../api";

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

class AxiosHttpClient {
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_DURATION = 2500;
  public readonly client: AxiosInstance;

  constructor() {
    this.cache = new Map();
    this.client = axios.create({
      baseURL: API.BASE_URL,
      timeout: 20000,
      headers: {
        "User-Agent": CONFIG.USER_AGENT,
        "Content-Type": "application/json",
      },
    });
    this.setupInterceptors();
  }

  private getCacheKey(config: any): string {
    return `${config.method}:${config.url}${JSON.stringify(config.params || {})}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const cacheKey = this.getCacheKey(config);
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && this.isCacheValid(cachedData.timestamp)) {
          // logger.log("debug", `Cache hit — returning cached response`, {
          //   cacheKey,
          //   cachedAt: new Date(cachedData.timestamp).toISOString(),
          //   expiresIn: `${this.CACHE_DURATION - (Date.now() - cachedData.timestamp)}ms`,
          // });
          return Promise.reject({ __cached: true, data: cachedData.data });
        }

        // logger.log("info", `Outgoing request`, {
        //   method: config.method?.toUpperCase(),
        //   url: `${config.baseURL}${config.url}`,
        //   params: config.params,
        // });

        return config;
      },
      (error) => {
        logger.log("error", `Request setup failed`, { error: error.message });
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        const cacheKey = this.getCacheKey(response.config);
        this.cache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now(),
        });

        // logger.log("info", `Response received`, {
        //   method: response.config.method?.toUpperCase(),
        //   url: `${response.config.baseURL}${response.config.url}`,
        //   status: response.status,
        //   statusText: response.statusText,
        // });

        return response;
      },
      (error) => {
        if (error.__cached) {
          return Promise.resolve({ data: error.data });
        }

        if (axios.isAxiosError(error)) {
          const status = error.response?.status || 500;
          const level: LogLevel = status >= 500 ? "error" : "warn";

          logger.log(level, `Request failed`, {
            method: error.config?.method?.toUpperCase(),
            url: `${error.config?.baseURL}${error.config?.url}`,
            status,
            statusText: error.response?.statusText,
            message: error.message,
            responseData: error.response?.data,
            // Omit params/headers if they may contain sensitive data
            params: error.config?.params,
          });

          return Promise.reject(
            new HttpRequestError(
              error.message,
              status,
              error.config,
              error.response,
            ),
          );
        }

        // Unexpected non-Axios error
        logger.log("error", `Unexpected error in HTTP client`, {
          message: error?.message,
          stack: error?.stack,
        });

        return Promise.reject(error);
      },
    );
  }
}

const { client: api } = new AxiosHttpClient();
export { api };
