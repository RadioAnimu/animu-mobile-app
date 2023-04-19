const BASE_URL = "https://api.animu.com.br/";
    export const API = {
    BASE_URL,
};

export interface AnimuInfoProps {
    listeners: number,
    rawtitle: string,
    track: TrackProps,
}

export interface TrackProps {
    rawtitle: string,
    anime: string,
    song: string,
    artist: string,
    artworks: {
        tiny?: string,
        medium?: string,
        large?: string
    },
    timestart: number,
    duration: number,
}
