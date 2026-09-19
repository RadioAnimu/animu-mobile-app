import type { LiveRequest } from "@/core/domain/live-request";
import type { RequestSubmitResult } from "@/core/domain/request-result";
import { ValidationError } from "animu-api";
import { animuApi } from "@/api/client";

class LiveRequestService {
  private isSubmitting = false;

  async submitRequest(request: LiveRequest): Promise<RequestSubmitResult> {
    // Prevent double submission
    if (this.isSubmitting) {
      return { success: false, error: "IN_PROGRESS" };
    }

    try {
      this.isSubmitting = true;

      // The client validates client-side (throws ValidationError before any
      // network call) and returns `true` only on a server-confirmed `"1"`.
      const success = await animuApi.submitLiveRequest(request);

      return success ? { success: true } : { success: false, error: "REQUEST_ERROR" };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: "VALIDATION", detail: error.message };
      }
      console.error("[LiveRequestService] Submit failed:", error);
      return { success: false, error: "REQUEST_ERROR" };
    } finally {
      this.isSubmitting = false;
    }
  }
}

export const liveRequestService = new LiveRequestService();
