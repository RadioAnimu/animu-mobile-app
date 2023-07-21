import { Audio } from "expo-av";
import { Sound } from "expo-av/build/Audio";

const BITRATES = {
    320: {
        category: "MP3",
        kbps: 320,
        url: "https://cast.animu.com.br:9079/stream",
    },
    192: {
        category: "MP3",
        kbps: 192,
        url: "https://cast.animu.com.br:9089/stream",
    },
    64: {
        category: "AAC+",
        kbps: 64,
        url: "https://cast.animu.com.br:9069/stream",
    }
};

const DEFAULT_BITRATE: keyof typeof BITRATES = 320;

const CONFIG = {
    BITRATES,
};


export interface MyPlayerProps {
    CONFIG: typeof CONFIG;
    player: Sound | null;
    curretnBitrate: keyof typeof BITRATES | null;
    _loaded: boolean;
    _paused: boolean;
    loadStream: (streamUrl: string) => Promise<void>;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    unloadStream: () => Promise<void>;
    changeBitrate: (bitrate: keyof typeof BITRATES) => Promise<void>;
}

export const myPlayer = (): MyPlayerProps => ({
    CONFIG,
    player: null,
    curretnBitrate: null,
    _loaded: false,
    _paused: true,
    async loadStream(streamUrl: string) {
        if (this._loaded && this.player) { 
            this.player.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync(
            { uri: streamUrl },
            { shouldPlay: false }
        );
        this.player = sound;
        this._loaded = true;
    },
    async play() {
        console.log("Play");
        if (this.player && this._loaded && this._paused) {
            console.log("Playing");
            this._paused = false;
            await this.player.playAsync();
        } else {
            await this.changeBitrate(this.curretnBitrate || DEFAULT_BITRATE);
        }
    },
    async pause() {
        if (this.player && this._loaded && !this._paused) {
            this._paused = true;
            await this.player.pauseAsync();
            // await this.player.stopAsync();
        }
    },
    async unloadStream() {
        if (this.player && this._loaded) {
            this._paused = true;
            this._loaded = false;
            await this.player.stopAsync();
            await this.player.unloadAsync();
            this.player = null;
        }
    },
    async changeBitrate(bitrate: keyof typeof BITRATES = DEFAULT_BITRATE) {
        if (!this._loaded) {
            this.curretnBitrate = bitrate;
            await this.loadStream(BITRATES[this.curretnBitrate].url);
            await this.play();
        } else {
            if (this.curretnBitrate !== bitrate) {
                this.curretnBitrate = bitrate;
                await this.unloadStream();
                console.log("Changing bitrate");
                await this.loadStream(BITRATES[this.curretnBitrate].url);
                await this.play();
            } else {
                await this.play();
            }
        }
    }
});
