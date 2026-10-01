import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENDPOINTS } from "animu-api";

import {
  clearProfileMedia,
  getCachedProfileMedia,
  syncProfileMedia,
} from "@/core/services/profile-media.service";

const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  remote: new Map<string, string>(),
  downloads: [] as { url: string; headers?: Record<string, string> }[],
  failDownload: false,
}));

vi.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | Directory)[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    get exists() {
      return true;
    }
    create() {}
    delete() {
      for (const key of [...fs.files.keys()]) {
        if (key.startsWith(`${this.uri}/`)) fs.files.delete(key);
      }
    }
    list() {
      return [...fs.files.keys()]
        .filter((key) => key.startsWith(`${this.uri}/`))
        .map((key) => new File(key));
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | Directory)[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/");
    }
    get name() {
      return this.uri.split("/").pop() as string;
    }
    get exists() {
      return fs.files.has(this.uri);
    }
    delete() {
      fs.files.delete(this.uri);
    }
    info() {
      return { md5: fs.files.get(this.uri) };
    }
    move(target: File) {
      fs.files.set(target.uri, fs.files.get(this.uri) as string);
      fs.files.delete(this.uri);
      this.uri = target.uri;
    }
    static async downloadFileAsync(
      url: string,
      dest: File,
      options: { headers?: Record<string, string> },
    ) {
      fs.downloads.push({ url, headers: options.headers });
      if (fs.failDownload || !fs.remote.has(url)) throw new Error("http 404");
      fs.files.set(dest.uri, fs.remote.get(url) as string);
      return dest;
    }
  }
  return { Directory, File, Paths: { cache: "file:///cache" } };
});

const AVATAR_URL = `${ENDPOINTS.auth}/me/avatar.php`;
const names = () =>
  [...fs.files.keys()].map((key) => key.split("/").pop()).sort();

beforeEach(() => {
  fs.files.clear();
  fs.remote.clear();
  fs.downloads.length = 0;
  fs.failDownload = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("syncProfileMedia", () => {
  it("saves the download under a content-hash name and sends the session header", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    const uri = await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");

    expect(uri).toBe("file:///cache/profile-media/avatar-7-aaa");
    expect(names()).toEqual(["avatar-7-aaa"]);
    expect(fs.downloads[0].headers).toEqual({ "X-Session-Id": "tok" });
    expect(getCachedProfileMedia("avatar", 7)).toBe(uri);
  });

  it("keeps the same URI when the bytes are unchanged", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    const first = await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");
    const second = await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");

    expect(second).toBe(first);
    expect(names()).toEqual(["avatar-7-aaa"]);
  });

  it("switches to a new URI and drops the old copy when the bytes change", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");
    fs.remote.set(AVATAR_URL, "bbb");
    const uri = await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");

    expect(uri).toBe("file:///cache/profile-media/avatar-7-bbb");
    expect(names()).toEqual(["avatar-7-bbb"]);
  });

  it("does not send the session to provider CDN urls", async () => {
    fs.remote.set("https://cdn.example/a.png", "ccc");
    await syncProfileMedia("avatar", 7, "https://cdn.example/a.png", "tok");
    expect(fs.downloads[0].headers).toBeUndefined();
  });

  it("keeps the saved copy when the download fails", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    const saved = await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");
    fs.failDownload = true;

    expect(await syncProfileMedia("avatar", 7, AVATAR_URL, "tok")).toBe(saved);
    expect(names()).toEqual(["avatar-7-aaa"]);
  });

  it("drops the saved copy when the account has no such media", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    await syncProfileMedia("banner", 7, AVATAR_URL, "tok");

    expect(await syncProfileMedia("banner", 7, null, "tok")).toBeNull();
    expect(names()).toEqual([]);
  });

  it("keeps avatars and banners of different users apart", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");
    await syncProfileMedia("avatar", 8, AVATAR_URL, "tok");
    await syncProfileMedia("banner", 7, AVATAR_URL, "tok");

    expect(names()).toEqual(["avatar-7-aaa", "avatar-8-aaa", "banner-7-aaa"]);
  });

  it("clearProfileMedia removes everything", async () => {
    fs.remote.set(AVATAR_URL, "aaa");
    await syncProfileMedia("avatar", 7, AVATAR_URL, "tok");
    clearProfileMedia();
    expect(names()).toEqual([]);
  });
});
