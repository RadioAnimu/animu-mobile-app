import { AxiosRequestConfig, AxiosResponse } from "axios";

export class HttpRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly config?: AxiosRequestConfig,
    public readonly response?: AxiosResponse
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
