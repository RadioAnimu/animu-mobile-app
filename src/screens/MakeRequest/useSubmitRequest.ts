import { useCallback, useState } from "react";

import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { musicRequestService } from "@/core/services/music-request.service";
import { getSubmissionErrorMessage } from "@/screens/MakeRequest/submissionErrorMessage";
import type {
  MusicRequest,
  MusicRequestSubmission,
} from "@/core/domain/music-request";

/**
 * The submission flow of the request sheet: the picked track and the handler
 * the sheet's form calls, which refuses a blocked or session-less user with
 * the banner's reason and maps a server rejection to a localized message.
 */
export function useSubmitRequest({
  blockedMessage,
}: Readonly<{ blockedMessage: string | undefined }>) {
  const { user } = useAuth();
  const dict = useDict();

  const [selectedTrack, setSelectedTrack] = useState<MusicRequest | undefined>(
    undefined,
  );

  const handleSubmitRequest = useCallback(
    async (message: string): Promise<{ success: boolean; message: string } | null> => {
      if (blockedMessage || !user?.sessionToken) {
        return {
          success: false,
          message: blockedMessage ?? dict.REQUEST_NEEDS_SIGN_IN,
        };
      }

      if (!selectedTrack) {
        return { success: false, message: dict.SELECT_ERROR };
      }

      const submission: MusicRequestSubmission = {
        trackId: selectedTrack.id,
        message,
        sessionId: user.sessionToken,
      };

      const result = await musicRequestService.submitRequest(submission, {
        title: selectedTrack.song,
        artist: selectedTrack.artist,
        anime: selectedTrack.anime,
        artwork: selectedTrack.artwork,
      });

      // A duplicate tap reached the service while the first submit runs:
      // that one owns the outcome.
      if (result.error === "IN_PROGRESS") return null;

      if (!result.success) {
        return {
          success: false,
          message: getSubmissionErrorMessage(dict, result.error, result.detail),
        };
      }

      return { success: true, message: dict.REQUEST_SUCCESS };
    },
    [selectedTrack, user, dict, blockedMessage],
  );

  return { user, selectedTrack, setSelectedTrack, handleSubmitRequest };
}
