import { Player } from "react-native-airwave";
import { setServerSkewListener } from "@/api/client";
import { animuService } from "@/core/services/animu.service";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";
import { listenStatsService } from "@/core/services/listen-stats.service";
import { userSettingsService } from "@/core/services/user-settings.service";
import { CONFIG } from "@/utils/player.config";
import { PlayerService, type Ticker } from "@/core/player/player-service";
import { ArtworkResolver } from "@/core/player/storage/artwork";
import {
  CachedCoverLookup,
  CoverCacheSeeder,
  ExpoImageCoverDiskCache,
} from "@/core/player/storage/cover-image-cache";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import { HeardTrack } from "@/core/player/stream-playback/heard-track";
import { NowHearing } from "@/core/player/stream-playback/now-hearing";
import { NowPlayingRepository } from "@/core/player/stream-playback/now-playing.repository";
import { StreamPreferences } from "@/core/player/stream-playback/stream-preferences";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { createPumpedTimer, jsTimer } from "@/core/player/timer";
import { AudioSampler, WAVE_POINTS } from "@/core/player/visualizer/audio-sampler";

/** Foreground UI tick (store progress, polls). Never needed for playback. */
const createTicker = (): Ticker => {
  let id: ReturnType<typeof setInterval> | null = null;
  return {
    start(tick) {
      if (id == null) id = setInterval(tick, 1_000);
    },
    stop() {
      if (id != null) clearInterval(id);
      id = null;
    },
  };
};

let playerServiceInstance: PlayerService | null = null;

export const createPlayerService = (onDestroyed?: () => void): PlayerService => {
  const player = new Player({
    diagnostics: CONFIG.DEBUG,
    // The app publishes its own lock-screen metadata (anime / artist / cover
    // from the station API); the raw ICY title is only matched, never shown.
    metadata: { useStreamMetadataForNowPlaying: false },
    // Swiping the app away ends playback (the controls never outlive the app).
    android: { stopOnTaskRemoved: true },
    // Native-timer readings while playing: the audible clock's lag, and JS at
    // song boundaries where JS timers are frozen (Android background).
    progressInterval: 1_000,
  });
  const streamPreferences = new StreamPreferences();
  const repository = new NowPlayingRepository({
    fetchers: animuService,
    getCoverQuality: () => userSettingsService.getCurrentSettings().liveQualityCover,
    getDefaultCover: () => artwork.defaultCover,
    timer: jsTimer,
  });
  const heard = new HeardTrack({
    // The heard title may still be the previous song (history) or the one the
    // station just announced.
    candidates: () => [repository.currentTrack, ...repository.lastPlayedTracks],
    stationTrack: () => repository.currentTrack,
  });
  // The audible clock: the station's track on the measured lag (drives the
  // display when a stream has no ICY titles). Its boundary timer is also
  // pumped by the native progress readings.
  const sync = new StreamSyncEngine();
  const boundaryTimer = createPumpedTimer();
  const audible = new AudibleTrackResolver({
    getStationTrack: () => repository.currentTrack,
    sync,
    timer: boundaryTimer,
  });
  const hearing = new NowHearing({ heard, sync, audible, pump: () => boundaryTimer.pump() });
  // Station-time comparisons (tune-in, the clock): correct a grossly wrong device clock.
  setServerSkewListener((skewMs, rttMs) => hearing.setClockSkew(skewMs, rttMs));
  // Bridges the lock-screen cover with the in-app image cache (both directions).
  const coverDiskCache = new ExpoImageCoverDiskCache();
  const coverLookup = new CachedCoverLookup(coverDiskCache);
  const coverSeeder = new CoverCacheSeeder(coverDiskCache);
  const artwork = new ArtworkResolver({
    onResolved: (localUri, remoteUrl) => {
      // Attribute the download to the live surface while the remote URL is
      // still known (the UI renders the local file).
      if (userSettingsService.getCurrentSettings().cacheEnabled) {
        coverCacheRegistry.tag(remoteUrl, "live");
      }
      return coverSeeder.seed(localUri, remoteUrl);
    },
    findCachedCoverFile: coverLookup.find.bind(coverLookup),
  });
  const sampler = new AudioSampler({
    isSamplingSupported: true,
    setSamplingEnabled: (enabled) => {
      player.setAudioSampling({ enabled, points: WAVE_POINTS });
    },
    onSample: (handler) => player.on("audioSample", handler),
  });

  return new PlayerService({
    player,
    repository,
    streamPreferences,
    artwork,
    heard,
    hearing,
    sampler,
    stats: listenStatsService,
    ticker: createTicker(),
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
