import { useEffect, useState } from "react";
import type { AuthProfile } from "animu-api";
import type { User } from "@/core/domain/user";
import {
  getCachedProfileMedia,
  syncProfileMedia,
  type ProfileMediaKind,
} from "@/core/services/profile-media.service";

export interface ProfileMedia {
  /** Local `file://` URI of the saved avatar, or null until one exists. */
  avatar: string | null;
  /** Local `file://` URI of the saved banner, or null until one exists. */
  banner: string | null;
}

const EMPTY: ProfileMedia = { avatar: null, banner: null };

/**
 * Keeps the signed-in user's avatar and banner saved on disk. The saved copy
 * is shown immediately (also offline), then re-downloaded whenever the
 * account, its media URLs or `imageVersion` (every profile refresh / login /
 * upload) change, and swapped in only if the bytes actually differ.
 *
 * The banner waits for the profile: its URL is unknown before that, and "no
 * URL" would otherwise be mistaken for "no banner" and drop the saved copy.
 */
export function useProfileMedia(
  user: User | null,
  profile: AuthProfile | null,
  imageVersion: number,
): ProfileMedia {
  const [media, setMedia] = useState<ProfileMedia>(EMPTY);

  const userId = user?.id ?? null;
  const sessionToken = user?.sessionToken ?? null;
  const avatarUrl = user?.avatarUrl ?? null;
  const profileLoaded = profile != null;
  const bannerUrl = profile?.banner?.url ?? null;

  useEffect(() => {
    setMedia(
      userId == null
        ? EMPTY
        : {
            avatar: getCachedProfileMedia("avatar", userId),
            banner: getCachedProfileMedia("banner", userId),
          },
    );
  }, [userId]);

  useSync(
    "avatar",
    userId,
    sessionToken,
    avatarUrl,
    userId != null,
    imageVersion,
    setMedia,
  );
  useSync(
    "banner",
    userId,
    sessionToken,
    bannerUrl,
    userId != null && profileLoaded,
    imageVersion,
    setMedia,
  );

  return media;
}

function useSync(
  kind: ProfileMediaKind,
  userId: number | null,
  sessionToken: string | null,
  url: string | null,
  enabled: boolean,
  imageVersion: number,
  setMedia: React.Dispatch<React.SetStateAction<ProfileMedia>>,
) {
  useEffect(() => {
    if (!enabled || userId == null || !sessionToken) return undefined;
    let cancelled = false;
    void syncProfileMedia(kind, userId, url, sessionToken).then((uri) => {
      if (!cancelled)
        setMedia((prev) =>
          prev[kind] === uri ? prev : { ...prev, [kind]: uri },
        );
    });
    return () => {
      cancelled = true;
    };
  }, [kind, userId, sessionToken, url, enabled, imageVersion, setMedia]);
}
