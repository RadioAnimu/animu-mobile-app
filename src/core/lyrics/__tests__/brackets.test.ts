import { describe, expect, it } from "vitest";
import { bracketGroups, withoutGroups } from "@/core/lyrics/brackets";
import { queryTitle } from "@/core/lyrics/lyrics-service";
import { artistNames, titleVariants } from "@/core/lyrics/text";

describe("bracketGroups", () => {
  it("runs each opener to the first closer, of any kind", () => {
    const title = "Song (TV (Size)) 『Sub』 [open";
    const groups = bracketGroups(title, "([『", ")]』");

    expect(groups.map((group) => group.inner)).toEqual(["TV (Size", "Sub"]);
    expect(withoutGroups(title, groups)).toBe("Song  )   [open");
  });

  it("finds nothing without a closer", () => {
    expect(bracketGroups("((((", "(", ")")).toEqual([]);
    expect(withoutGroups("((((", [])).toBe("((((");
  });
});

describe("bracketed song metadata", () => {
  it("drops qualifiers from search queries", () => {
    expect(queryTitle("Sanctuary 【Opening】 ~TV Size~")).toBe("Sanctuary");
    expect(queryTitle("(Opening)")).toBe("(Opening)");
  });

  it("keeps bracketed subtitles as title variants", () => {
    expect(titleVariants("Rude-α 『LIFE』")).toContain("life");
  });

  it("credits a character's voice actor", () => {
    const names = artistNames("Hachiman Hikigaya (CV: Takuya Eguchi)");
    expect(names).toContain("takuya eguchi");
    expect(names).toContain("hachiman hikigaya");
  });

  // A bracket regex rescans to the end from every unclosed opener; these
  // would take seconds and time out if that came back.
  it("handles long unclosed titles in linear time", () => {
    const title = `Song ${"(".repeat(100_000)}`;

    expect(queryTitle(title)).toBe(title);
    expect(titleVariants(title)).toContain("song");
    expect(artistNames(`Artist ${"（".repeat(100_000)}`)).toContain("artist");
  });
});
