// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PopUpProgram } from "@/components/PopUpProgram";
import type { Program } from "@/core/domain/program";
import { DICT } from "@/i18n";

// The real dictionaries (the shared setup stubs react-native-svg for them);
// only the providers the component reads from are faked.
const state = vi.hoisted(() => ({ language: "EN", program: null as Program | null }));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { selectedLanguage: state.language } }),
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => ({ currentProgram: state.program }),
}));
vi.mock("@/hooks/useResponsiveLayout", () => ({ useResponsiveLayout: () => ({ landscape: false }) }));
vi.mock("@/components/Sheet", () => ({ Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const program = (name: string) =>
  ({ name, info: "The station's own text", theme: "", imageUrl: "https://cdn.test/p.png" }) as unknown as Program;

/** The tables are index-aligned; the station names programs as the PT table does. */
const entry = (language: keyof typeof DICT, stationName: string) =>
  DICT[language].PROGRAMS[DICT.PT.PROGRAMS.findIndex((p) => p.name === stationName)];

describe("PopUpProgram", () => {
  afterEach(() => {
    cleanup();
    state.language = "EN";
  });

  it("shows the program in the listener's language, matched by the station's name", () => {
    state.program = program("  jiyuu JIKAN ");
    render(<PopUpProgram visible handleClose={() => {}} />);
    expect(screen.getByText(entry("EN", "Jiyuu Jikan").information)).toBeTruthy();
    expect(screen.queryByText("The station's own text")).toBeNull();
  });

  it("names it in the listener's language too (Japanese renames it)", () => {
    state.language = "JN";
    state.program = program("Jiyuu Jikan");
    render(<PopUpProgram visible handleClose={() => {}} />);
    expect(screen.getByText(entry("JN", "Jiyuu Jikan").name)).toBeTruthy(); // 自由時間
  });

  it("falls back to the station's own text for a program the app does not know", () => {
    state.program = program("A Brand New Show");
    render(<PopUpProgram visible handleClose={() => {}} />);
    expect(screen.getByText("A Brand New Show")).toBeTruthy();
    expect(screen.getByText("The station's own text")).toBeTruthy();
  });
});
