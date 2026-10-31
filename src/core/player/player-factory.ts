import { Player, setCatalog, type PlayerOptions } from "react-native-anything-player";
import type { Stream } from "@/core/domain/stream";
import type { AudioPlayer } from "@/core/player/ports";
import { setServerSkewListener } from "@/api/client";
import { animuService } from "@/core/services/animu.service";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";
import { listenStatsService } from "@/core/services/listen-stats.service";
import { lyricsService } from "@/core/lyrics";
import { userSettingsService } from "@/core/services/user-settings.service";
import { CONFIG } from "@/utils/player.config";
import { PlayerService, streamSource, type Ticker } from "@/core/player/player-service";
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
      id ??= setInterval(tick, 1_000);
    },
    stop() {
      if (id != null) clearInterval(id);
      id = null;
    },
  };
};

let playerServiceInstance: PlayerService | null = null;

/**
 * The player's id. Voice requests and car picks play on it natively, even
 * before JavaScript runs (the catalog's player), and the app attaches to it.
 */
export const PLAYER_ID = "animu";

/** Also the catalog's: a player native code creates must behave as the app's. */
const playerOptions = (): Omit<PlayerOptions, "id"> => ({
  diagnostics: CONFIG.DEBUG,
  // The app publishes its own lock-screen metadata (anime / artist / cover
  // from the station API), which wins over the stream's. The ICY title shows
  // only while no JavaScript runs: a car or a voice request can start the
  // catalog's player natively, and the car then names the song, not just the
  // station (the station's ICY name fills the album line the app leaves empty).
  metadata: { useStreamMetadataForNowPlaying: true },
  // Swiping the app away ends playback (the controls never outlive the app).
  android: { stopOnTaskRemoved: true },
  // Native-timer readings while playing: the audible clock's lag, and JS at
  // song boundaries where JS timers are frozen (Android background).
  progressInterval: 1_000,
});

/**
 * One player per JavaScript runtime. A service created while the previous one
 * still holds it (Fast Refresh re-runs this module) takes it over: a second
 * `Player` with the same id is refused. Kept on the global object, which a
 * re-run module does not reset. A remount after a teardown creates a new one:
 * it comes a user action later, long after the native release
 * (react-native-anything-player#90 tracks a create racing a release).
 */
const holder = globalThis as { __animuPlayer?: { player: Player; owner: object } | null };

const acquirePlayer = (owner: object): AudioPlayer => {
  const held = holder.__animuPlayer;
  const player =
    held && !held.player.isReleased
      ? held.player
      : new Player({ id: PLAYER_ID, ...playerOptions() });
  holder.__animuPlayer = { player, owner };
  return {
    get status() {
      return player.status;
    },
    load: player.load.bind(player),
    play: player.play.bind(player),
    pause: player.pause.bind(player),
    selectQuality: player.selectQuality.bind(player),
    on: player.on.bind(player),
    getProgress: player.getProgress.bind(player),
    updateNowPlaying: player.updateNowPlaying.bind(player),
    setAudioSampling: player.setAudioSampling.bind(player),
    // Only the last service to take the player ends it.
    release: async () => {
      if (holder.__animuPlayer?.owner !== owner) return;
      holder.__animuPlayer = null;
      await player.release();
    },
  };
};

/**
 * The station for Siri, Google Assistant and cars (Android Auto; CarPlay waits
 * for Apple's entitlement, see app.json): every relay as a
 * rendition (the source the app loads itself, so a request while it plays
 * goes on without a gap), starting at the listener's quality.
 */
const publishCatalog = async (streams: Stream[], current: Stream): Promise<void> => {
  if (!streams.some((stream) => stream.id === current.id)) return;
  await setCatalog(
    [
      {
        id: "animu",
        title: "Rádio Animu",
        keywords: ["Animu", "Radio Animu", "Rádio Animu"],
        kind: "station",
        // Cars list folders at the root: one tab, the station.
        group: "Rádio Animu",
        artwork: CONFIG.DEFAULT_COVER,
        source: streamSource(streams, current),
        quality: current.id,
      },
    ],
    { playerId: PLAYER_ID, playerOptions: playerOptions() },
  );
};

export const createPlayerService = (onDestroyed?: () => void): PlayerService => {
  const player = acquirePlayer({});
  const streamPreferences = new StreamPreferences();
  const repository = new NowPlayingRepository({
    fetchers: animuService,
    getCoverQuality: () => userSettingsService.getCurrentSettings().liveQualityCover,
    getDefaultCover: () => artwork.defaultCover,
    // The track-end refresh is about the station's data: the live point (the
    // server's clock), not the audible one.
    getNow: () => Date.now() + sync.clockSkew,
    timer: jsTimer,
  });
  const heard = new HeardTrack({
    // The heard title may be the one the station just announced, or one it
    // already moved past: a recent on-air item (a jingle shorter than the
    // lag is replaced before it is heard) or an older song (history).
    candidates: () => [
      repository.currentTrack,
      ...repository.recentOnAirTracks,
      ...repository.lastPlayedTracks,
    ],
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
    onTrackAnnounced: (track) => lyricsService().prefetch(track),
    publishCatalog,
    // A live song the station gave no length for: LRCLIB's, from the same
    // lookup the header's lyrics button makes (shared memory, in-flight and
    // disk cache — no extra request).
    estimateDuration: (track) =>
      lyricsService()
        .lyricsFor(track)
        .then((lyrics) => lyrics?.source.durationMs ?? null),
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
