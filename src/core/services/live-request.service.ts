import type { LiveRequest } from "@/core/domain/live-request";
import type { RequestSubmitResult } from "@/core/domain/request-result";
import { animuApi } from "@/api/client";

import { RequestSubmitGuard } from "@/core/services/request-submit-guard";

class LiveRequestService {
  private readonly guard = new RequestSubmitGuard();

  submitRequest(request: LiveRequest): Promise<RequestSubmitResult> {
    // The client validates client-side (throws ValidationError before any
    // network call) and returns `true` only on a server-confirmed `"1"`.
    return this.guard.run(() => animuApi.submitLiveRequest(request));
  }
}

export const liveRequestService = new LiveRequestService();
