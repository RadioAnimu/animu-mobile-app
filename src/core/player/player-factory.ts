import NetInfo from "@react-native-community/netinfo";
import { setServerSkewListener } from "@/api/client";
import { animuService } from "@/core/services/animu.service";
import { backgroundService } from "@/core/services/background.service";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";
import { listenStatsService } from "@/core/services/listen-stats.service";
import { userSettingsService } from "@/core/services/user-settings.service";
import { CONFIG } from "@/utils/player.config";
import { ExpoAudioAdapter } from "@/core/player/adapters/expo-audio.adapter";
import { PlaybackControlsAdapter } from "@/core/player/adapters/playback-controls.adapter";
import { buildNowPlayingMetadata } from "@/core/player/media-session/now-playing.metadata";
import { PlayerService } from "@/core/player/player-service";
import {
  BASE_RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS,
} from "@/core/player/recovery-config";
import { ArtworkResolver } from "@/core/player/storage/artwork";
import {
  CachedCoverLookup,
  CoverCacheSeeder,
  ExpoImageCoverDiskCache,
} from "@/core/player/storage/cover-image-cache";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import { BackoffScheduler } from "@/core/player/stream-playback/backoff";
import { HeartbeatScheduler } from "@/core/player/stream-playback/heartbeat";
import {
  NetworkMonitor,
  type ConnectivitySubscribe,
} from "@/core/player/stream-playback/network-monitor";
import { NowPlayingRepository } from "@/core/player/stream-playback/now-playing.repository";
import { ProgressTicker } from "@/core/player/stream-playback/progress-ticker";
import { StreamPreferences } from "@/core/player/stream-playback/stream-preferences";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { TransportStateMachine } from "@/core/player/stream-playback/transport-state";
import { createPumpedTimer } from "@/core/player/timer";
import { createVisualizerSampler } from "@/core/player/visualizer";

/**
 * Composition root: wires the production adapters and units into a
 * `PlayerService` and owns the app-wide singleton. Kept apart from the
 * orchestrator so the dependency only points one way (factory → service).
 */

/** JS fallback heartbeat period (see `HeartbeatScheduler`). */
const HEARTBEAT_INTERVAL_MS = 1000;

const netInfoSubscribe: ConnectivitySubscribe = (handler) =>
  NetInfo.addEventListener((state) =>
    handler({
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    }),
  );

let playerServiceInstance: PlayerService | null = null;

/**
 * Builds a fully-wired PlayerService with production dependencies.
 * `onDestroyed` runs once the instance has torn down.
 */
export const createPlayerService = (
  onDestroyed?: () => void,
): PlayerService => {
  const state = new TransportStateMachine();
  // One scheduling clock for every unit, pumped by native frames so its
  // deadlines survive Android's background JS-timer freeze.
  const timer = createPumpedTimer();
  // The audible station clock: turns the native live offset into the instant
  // the speaker is producing, so every station-timeline surface stays on the
  // audio the listener hears rather than the station's live point.
  const sync = new StreamSyncEngine();
  // Feed the engine the server-vs-device clock offset from every HTTP
  // response's `date` header (the app already makes these requests). Keeps
  // the station-timeline comparison valid on a device with a wrong clock.
  setServerSkewListener((skewMs, rttMs) => sync.setClockSkew(skewMs, rttMs));
  // The only two places the native libraries are touched live in these
  // adapters; the rest of the core depends on the ports.
  const audio = new ExpoAudioAdapter();
  const media = new PlaybackControlsAdapter();
  const sampler = createVisualizerSampler(audio);
  const streamPreferences = new StreamPreferences();
  const reconnect = new BackoffScheduler({
    baseMs: BASE_RECONNECT_DELAY_MS,
    maxMs: MAX_RECONNECT_DELAY_MS,
    timer,
    label: "stream-reconnect",
  });
  const repository = new NowPlayingRepository({
    fetchers: animuService,
    getCoverQuality: () =>
      userSettingsService.getCurrentSettings().liveQualityCover,
    getDefaultCover: () => artwork.defaultCover,
    timer,
    // Track-end refreshes fire on the audible timeline, not the station's.
    getNow: () => sync.now(),
  });
  const networkMonitor = new NetworkMonitor(netInfoSubscribe);
  // Bridges the media-session artwork with the in-app image cache: any
  // surface (search row, history, player frame) that already has a cover
  // on disk satisfies the resolver, and a fresh resolver download seeds
  // back for the reverse journey.
  const coverDiskCache = new ExpoImageCoverDiskCache();
  const coverLookup = new CachedCoverLookup(coverDiskCache);
  const coverSeeder = new CoverCacheSeeder(coverDiskCache);
  const artwork = new ArtworkResolver({
    onResolved: (localUri, remoteUrl) => {
      // Attribute the resolver's download to the live surface at the seam
      // where the remote URL is still known: the in-app player frame
      // renders the local `file://` URI and the registry only accepts
      // remote URLs, so display-time tagging can never see this cover —
      // the live partition would report 0 forever. The media session's
      // downloads are gated by the same cache setting as every other
      // surface's tags; the seed keeps its unconditional bridging role.
      if (userSettingsService.getCurrentSettings().cacheEnabled) {
        coverCacheRegistry.tag(remoteUrl, "live");
      }
      return coverSeeder.seed(localUri, remoteUrl);
    },
    findCachedCoverFile: coverLookup.find.bind(coverLookup),
  });
  // Holds the announced track back until the speaker reaches it, so the
  // title/cover/lock screen flip when the song is heard — not when the
  // station announces it.
  const audible = new AudibleTrackResolver({
    getStationTrack: () => repository.currentTrack,
    sync,
    timer,
  });
  const ticker = new ProgressTicker({
    repository,
    state,
    audio,
    media,
    sync,
    getTrack: () => audible.track,
    buildMetadata: () =>
      buildNowPlayingMetadata({
        // Local cover file when it exists — the patched native module
        // reads it in-process and publishes artworkData on Android.
        track: artwork.apply(audible.track),
        isLive: repository.currentProgram?.isLive ?? false,
        // Withhold the seek bar until the estimate settles (see `pushNowPlaying`).
        showProgress: repository.showProgress && sync.settled,
        defaultCover: artwork.defaultCover,
      }),
  });
  const heartbeat = new HeartbeatScheduler({
    repository,
    ticker,
    isPlayingIntent: () => state.isPlayingIntent,
    stateLabel: () => state.state,
    // Listen stats: every processed beat closes out one ~1s audible segment
    // while the transport is `playing`. Native status events keep beating
    // in the background, so backgrounded listening accrues too.
    onBeat: () => {
      if (state.state !== "playing") return;
      listenStatsService.onAudibleTick(Date.now());
    },
    debug: CONFIG.DEBUG,
  });

  return new PlayerService({
    state,
    audio,
    media,
    sampler,
    repository,
    streamPreferences,
    reconnect,
    networkMonitor,
    ticker,
    heartbeat,
    artwork,
    sync,
    audible,
    stats: listenStatsService,
    timer,
    heartbeatDriver: {
      start: (beat) =>
        backgroundService.startTask({
          id: "heartbeat",
          callback: async () => beat(),
          interval: HEARTBEAT_INTERVAL_MS,
        }),
      stop: () => backgroundService.stopTask("heartbeat"),
    },
    onDestroyed,
  });
};

/** App-wide singleton — recreated after `destroy()` (e.g. remounts). */
export const playerService = (): PlayerService => {
  if (playerServiceInstance) return playerServiceInstance;
  const instance = createPlayerService(() => {
    // Only the current singleton may clear the slot: a late teardown of an
    // older instance must not orphan its replacement.
    if (playerServiceInstance === instance) playerServiceInstance = null;
  });
  playerServiceInstance = instance;
  return instance;
};
