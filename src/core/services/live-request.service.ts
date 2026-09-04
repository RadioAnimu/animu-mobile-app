import type { LiveRequest } from "../domain/live-request";
import { ValidationError } from "animu-api";
import { animuApi } from "../../api/client";

class LiveRequestService {
  private isSubmitting = false;

  async submitRequest(request: LiveRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    // Prevent double submission
    if (this.isSubmitting) {
      return { success: false, error: "Request already in progress" };
    }

    try {
      this.isSubmitting = true;

      // The client validates client-side (throws ValidationError before any
      // network call) and returns `true` only on a server-confirmed `"1"`.
      const success = await animuApi.submitLiveRequest(request);

      return {
        success,
        error: success ? undefined : "Failed to submit request",
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "Failed to submit request" };
    } finally {
      this.isSubmitting = false;
    }
  }
}

export const liveRequestService = new LiveRequestService();
