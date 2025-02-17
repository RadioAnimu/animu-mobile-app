import { LiveRequest } from "../domain/live-request";
import { LiveRequestMapper } from "../../data/mappers/live-request.mapper";
import { animuApiClient as apiClient } from "../../data/http/animu.api";
import * as LiveRequestFormTools from "../../hooks/useLiveRequestForm";
import { HttpRequestError } from "../errors/http.error";

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

      // Validate request
      try {
        const validation = LiveRequestFormTools.isFormDataValid(request);
        if (!validation) {
          return { success: false, error: "Invalid request data" };
        }
      } catch (error) {
        if (error instanceof HttpRequestError) {
          return { success: false, error: error.message };
        } else {
          return { success: false, error: "Invalid request data" };
        }
      }

      // Submit request
      const dto = LiveRequestMapper.toDTO(request);
      const success = await apiClient.submitLiveRequest(dto);

      return {
        success,
        error: success ? undefined : "Failed to submit request",
      };
    } finally {
      this.isSubmitting = false;
    }
  }
}

export const liveRequestService = new LiveRequestService();
