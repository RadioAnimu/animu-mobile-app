import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { md5 } from "@/utils/md5";

const bytes = (text: string) => new TextEncoder().encode(text);
const reference = (data: Uint8Array) => createHash("md5").update(data).digest("hex");

describe("md5", () => {
  it("matches the RFC 1321 test suite", () => {
    expect(md5(bytes(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5(bytes("a"))).toBe("0cc175b9c0f1b6a831c399e269772661");
    expect(md5(bytes("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5(bytes("message digest"))).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(md5(bytes("abcdefghijklmnopqrstuvwxyz"))).toBe("c3fcd3d76192e4007dfb496cca67e13b");
    expect(md5(bytes("1234567890".repeat(8)))).toBe("57edf4a22be3c955ac49da2e2107b67a");
  });

  it("agrees with node's MD5 across every padding boundary", () => {
    for (let length = 0; length <= 200; length += 1) {
      const data = Uint8Array.from({ length }, (_, i) => (i * 31 + length) & 0xff);
      expect(md5(data)).toBe(reference(data));
    }
  });

  it("hashes binary input of dictionary size", () => {
    const data = Uint8Array.from({ length: 1_500_000 }, (_, i) => (i * 2654435761) >>> 24);
    expect(md5(data)).toBe(reference(data));
  });
});
