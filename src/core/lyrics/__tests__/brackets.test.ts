import { describe, expect, it } from "vitest";
import { bracketGroups, withoutBracketGroups } from "@/core/lyrics/brackets";
import { queryTitle } from "@/core/lyrics/lyrics-service";
import { titleVariants } from "@/core/lyrics/text";

describe("bracketed song metadata", () => {
  it("preserves nested openers, mixed closing brackets, and unclosed suffixes", () => {
    const title = "Song (TV (Size)) 『Subtitle』 [unclosed";
    const groups = bracketGroups(title, "([『", ")]』");
    expect(groups.map((group) => group.text)).toEqual(["TV (Size", "Subtitle"]);
    expect(withoutBracketGroups(title, groups)).toBe("Song  )   [unclosed");
  });

  it("keeps unmatched metadata without quadratic matching on external titles", () => {
    const malformed = `Song ${"(".repeat(50_000)}`;
    expect(queryTitle(malformed)).toBe(malformed);
    expect(titleVariants(malformed)).toContain("song");
  });

  it("extracts multilingual subtitles and removes qualifiers from search queries", () => {
    expect(queryTitle("Sanctuary 【Opening】 ~TV Size~")).toBe("Sanctuary");
    expect(titleVariants("Rude-α 『LIFE』")).toContain("life");
  });
});
