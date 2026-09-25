import type { LiveRequest } from "@/core/domain/live-request";
import type { RequestSubmitResult } from "@/core/domain/request-result";
import { animuApi } from "@/api/client";

import { RequestSubmitGuard } from "@/core/services/request-submit-guard";
import { listenStatsService } from "@/core/services/listen-stats.service";

class LiveRequestService {
  private readonly guard = new RequestSubmitGuard();

  submitRequest(request: LiveRequest): Promise<RequestSubmitResult> {
    // The client validates client-side (throws ValidationError before any
    // network call) and returns `true` only on a server-confirmed `"1"`.
    // The raw boolean is returned as-is — `RequestSubmitGuard` normalizes
    // a `false` to `REQUEST_ERROR`.
    return this.guard.run(async () => {
      const accepted = await animuApi.submitLiveRequest(request);
      // Single choke point for shout-out stats — server-confirmed only.
      listenStatsService.onShoutSubmitted(accepted);
      return accepted;
    });
  }
}

export const liveRequestService = new LiveRequestService();
