export interface RequestConfig {
  method?: string;
  url?: string;
  params?: Record<string, any>;
}

export interface RequestResponse {
  status?: number;
  data?: any;
}

export class HttpRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly config?: RequestConfig,
    public readonly response?: RequestResponse,
  ) {
    super(message);
    Object.setPrototypeOf(this, HttpRequestError.prototype);
  }

  get details() {
    return {
      status: this.statusCode,
      url: this.config?.url,
      method: this.config?.method,
      responseData: this.response?.data,
    };
  }
}
