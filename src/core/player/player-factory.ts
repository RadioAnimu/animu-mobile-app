import { Player, setCatalog, type PlayerOptions } from "react-native-anything-player";
import type { Stream } from "@/core/domain/stream";
import type { AudioPlayer } from "@/core/player/ports";
import { setServerSkewListener } from "@/api/client";
import { animuService } from "@/core/services/animu.service";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";
import { coverDiskStorage } from "@/core/services/cover-disk-storage.service";
import { listenStatsService } from "@/core/services/listen-stats.service";
import { lyricsService } from "@/core/lyrics";
import { userSettingsService } from "@/core/services/user-settings.service";
import { CONFIG } from "@/utils/player.config";
import { PlayerService, type Ticker } from "@/core/player/player-service";
import { streamSource } from "@/core/player/stream-playback/stream-source";
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
  // The app's lock-screen metadata wins over the stream's; the ICY title
  // shows until it lands (a car or voice request can start the player with
  // no JavaScript), and the ICY name fills the album line.
  metadata: { useStreamMetadataForNowPlaying: true },
  // Swiping the app away ends playback (the controls never outlive the app).
  android: { stopOnTaskRemoved: true },
  // Native-timer readings while playing: the audible clock's lag, and JS at
  // song boundaries where JS timers are frozen (Android background).
  progressInterval: 1_000,
});

/**
 * One player per JavaScript runtime, kept on the global object so a Fast
 * Refresh re-run takes it over (a second `Player` with the same id is
 * refused). `release()` frees the id at once (react-native-anything-player#93).
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
 * The station for Siri, Google Assistant and cars: every relay as a rendition
 * of the source the app loads itself, so a request while it plays has no gap.
 */
export const catalogFor = (streams: Stream[], current: Stream) => ({
  items: [
    {
      id: "animu",
      title: "Rádio Animu",
      keywords: ["Animu", "Radio Animu", "Rádio Animu"],
      kind: "station" as const,
      // Cars list folders at the root: one tab, the station.
      group: "Rádio Animu",
      artwork: CONFIG.DEFAULT_COVER,
      source: streamSource(streams, current),
      quality: current.id,
    },
  ],
  playerId: PLAYER_ID,
  playerOptions: playerOptions(),
});

const publishCatalog = async (streams: Stream[], current: Stream): Promise<void> => {
  if (!streams.some((stream) => stream.id === current.id)) return;
  const { items, ...options } = catalogFor(streams, current);
  await setCatalog(items, options);
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
    // The heard title may be one the station already moved past: a recent
    // on-air item (a jingle shorter than the lag) or an older song.
    candidates: () => [
      repository.currentTrack,
      ...repository.recentOnAirTracks,
      ...repository.lastPlayedTracks,
    ],
    stationTrack: () => repository.currentTrack,
    clockSkew: () => sync.clockSkew,
  });
  // The audible clock (the display when a stream has no ICY titles); native
  // progress readings pump its boundary timer.
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
      // Caching off keeps nothing: no attribution, no copy into the image cache.
      if (!userSettingsService.getCurrentSettings().cacheEnabled) return Promise.resolve();
      // Attributed while the remote URL is still known (the UI shows the file).
      coverCacheRegistry.tag(remoteUrl, "live");
      return coverSeeder.seed(localUri, remoteUrl);
    },
    findCachedCoverFile: coverLookup.find.bind(coverLookup),
  });
  // A cover-cache wipe also drops the lock-screen downloads, except the
  // heard track's cover the media session shows.
  const stopPruning = coverDiskStorage.subscribe(() => {
    if (!coverDiskStorage.isClearing) artwork.afterCacheWipe(hearing.track?.artwork);
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
    onDestroyed: () => {
      stopPruning();
      onDestroyed?.();
    },
    onTrackAnnounced: (track) => lyricsService().prefetch(track),
    publishCatalog,
    // A live song with no length: LRCLIB's, from the lyrics lookup already
    // made (shared cache, no extra request).
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
    // A late teardown of an older instance must not orphan its replacement.
    if (playerServiceInstance === instance) playerServiceInstance = null;
  });
  playerServiceInstance = instance;
  return instance;
};
