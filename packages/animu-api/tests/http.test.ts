import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimuApiError } from "../src/errors";
import { HttpClient, toFormData } from "../src/http";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body),
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpClient.get", () => {
  it("returns parsed JSON and sends default headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hello: "world" }));
    const client = new HttpClient("TestAgent", 5000);

    const data = await client.get<{ hello: string }>("https://x.co/api");

    expect(data).toEqual({ hello: "world" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("TestAgent");
  });

  it("appends query params to the URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const client = new HttpClient("TestAgent", 5000);

    await client.get("https://x.co/api", {
      params: { a: 1, b: "two", c: true },
    });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://x.co/api?a=1&b=two&c=true");
  });

  it("caches identical GETs for the micro-cache window", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ n: 1 }));
    const client = new HttpClient("TestAgent", 5000);

    await client.get("https://x.co/api");
    await client.get("https://x.co/api");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cache keys differ per query params", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const client = new HttpClient("TestAgent", 5000);

    await client.get("https://x.co/api", { params: { a: 1 } });
    await client.get("https://x.co/api", { params: { a: 2 } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to raw text when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse("plain php echo"));
    const client = new HttpClient("TestAgent", 5000);

    const data = await client.get<string>("https://x.co/api");
    expect(data).toBe("plain php echo");
  });

  it("throws AnimuApiError with status on HTTP errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse("nope", 404));
    const client = new HttpClient("TestAgent", 5000);

    const error = (await client.get("https://x.co/api").catch((e) => e)) as AnimuApiError;

    expect(error).toBeInstanceOf(AnimuApiError);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ status: 404, url: "https://x.co/api", method: "GET" });
  });

  it("wraps network failures into AnimuApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const client = new HttpClient("TestAgent", 5000);

    await expect(client.get("https://x.co/api")).rejects.toMatchObject({
      name: "AnimuApiError",
      statusCode: 0,
    });
  });

  it("reports timeouts when fetch aborts", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    const client = new HttpClient("TestAgent", 20);

    await expect(client.get("https://x.co/api")).rejects.toThrow(/timed out after 20ms/);
  });

  it("bypasses the micro-cache when noCache is set", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ n: 1 }));
    const client = new HttpClient("TestAgent", 5000);

    await client.get("https://x.co/api");
    await client.get("https://x.co/api", { noCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache POSTs", async () => {
    fetchMock.mockResolvedValue(jsonResponse("1"));
    const client = new HttpClient("TestAgent", 5000);

    await client.post("https://x.co/api", new FormData());
    await client.post("https://x.co/api", new FormData());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("omits Content-Type on FormData bodies so fetch sets the boundary", async () => {
    fetchMock.mockResolvedValue(jsonResponse("ok"));
    const client = new HttpClient("TestAgent", 5000);

    await client.post("https://x.co/api", new FormData());

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(init?.body).toBeInstanceOf(FormData);
  });
});

describe("toFormData", () => {
  it("skips null/undefined, stringifies primitives and nested objects", () => {
    const form = toFormData({
      a: "1",
      b: 2,
      c: true,
      nested: { x: 1 },
      skipNull: null,
      skipUndefined: undefined,
    });

    const entries = Object.fromEntries(
      (form as unknown as { entries(): IterableIterator<[string, FormDataEntryValue]> }).entries(),
    );
    expect(entries).toEqual({
      a: "1",
      b: "2",
      c: "true",
      nested: '{"x":1}',
    });
  });
});
