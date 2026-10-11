// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestBottomSheet } from "@/components/RequestBottomSheet";
import { trackSource } from "@/components/RequestBottomSheet/track-source";
import type { MusicRequest } from "@/core/domain/music-request";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("react-native-keyboard-controller", async () =>
  (await import("@/__tests__/keyboard-controller-mock")).createKeyboardControllerMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("expo-image", () => ({ Image: () => <img alt="" /> }));
vi.mock("@/assets/success_haruka.webp", () => ({ default: 1 }));
vi.mock("@/components/Sheet", () => ({
  Sheet: ({
    visible,
    children,
    chip,
  }: {
    visible: boolean;
    children: ReactNode;
    chip?: { message: string; variant: string } | null;
  }) =>
    visible ? (
      <div>
        {chip && <p data-variant={chip.variant}>{chip.message}</p>}
        {children}
      </div>
    ) : null,
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast }),
}));
vi.mock("@/contexts/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: null }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: () => <i /> }));
vi.mock("@/components/Cover", () => ({ Cover: () => <i /> }));
vi.mock("@/utils/haptics", () => ({
  haptics: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    INFO_REQUEST: "Leave a note?",
    FORM_LABEL_REQUEST: "Message",
    OPTIONAL_LABEL: "optional",
    SEND_REQUEST_PLACEHOLDER: "Your note",
    SEND_REQUEST_BUTTON_TEXT: "Send",
    ERROR_RETRY: "Try again",
    REQUEST_ERROR: "Failed to send",
    REQUEST_SUCCESS: "Sent!",
    OK_BUTTON: "OK",
    A11Y_CLEAR_INPUT: "Clear field",
  }),
}));

const track = {
  id: "t1",
  song: "Unravel",
  anime: "Tokyo Ghoul",
  artist: "TK",
  album: "",
  genre: "",
} as never;
const user = { username: "Haru", handle: "haru", avatarUrl: "" } as never;

const setup = (
  onSubmit = vi.fn().mockResolvedValue({ success: true, message: "ok" }),
  requester: unknown = user,
) => {
  const props = {
    visible: true,
    track,
    user: requester as never,
    onClose: vi.fn(),
    onSubmit,
    onRequestSuccess: vi.fn(),
  };
  render(<RequestBottomSheet {...props} />);
  return props;
};

const sent = () =>
  waitFor(() => expect(toast).toHaveBeenCalledWith("Sent!", "success"));

afterEach(() => {
  cleanup();
  toast.mockClear();
});

describe("trackSource", () => {
  const request = (overrides: Partial<MusicRequest>): MusicRequest => ({
    id: "1",
    raw: "",
    song: "Value",
    anime: "",
    artist: "Ado",
    album: "",
    genre: "",
    artwork: "",
    requestable: true,
    ...overrides,
  });

  it("is the anime when there is one", () => {
    expect(trackSource(request({ anime: "Tokyo Ghoul", album: "Unravel" }))).toBe("Tokyo Ghoul");
  });

  it("falls back to the album for a song from no anime", () => {
    expect(trackSource(request({ song: "Hummingbird", album: "Ryuusei Record" }))).toBe("Ryuusei Record");
  });

  it("skips an album named after the song, taking the genre (Value by Ado)", () => {
    expect(trackSource(request({ album: "Value", genre: "J-Pop" }))).toBe("J-Pop");
  });

  it("is empty when nothing is tagged, hiding the chip", () => {
    expect(trackSource(request({}))).toBe("");
  });
});

describe("RequestBottomSheet", () => {
  it("shows the track, the requester and the optional message field", () => {
    setup();

    expect(screen.getByText("Unravel")).toBeTruthy();
    expect(screen.getByText("Haru (@haru)")).toBeTruthy();
    expect(screen.getByLabelText("Message")).toBeTruthy();
  });

  it("hides the chip and the artist line when the catalogue has neither", () => {
    render(
      <RequestBottomSheet
        visible
        track={{ id: "t2", song: "Adolescence", anime: "", artist: "", album: "", genre: "" } as never}
        user={user}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onRequestSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Adolescence")).toBeTruthy();
    expect(screen.queryByText("Unknown Anime")).toBeNull();
    expect(screen.queryByText("Unknown Artist")).toBeNull();
  });

  it("shows just the name when the requester has no handle", () => {
    setup(undefined, { username: "Haru", avatarUrl: "" });

    expect(screen.getByText("Haru")).toBeTruthy();
  });

  it("submits the message, closes the sheet and flashes a success chip", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "hi!" },
    });

    fireEvent.click(screen.getByLabelText("Send"));
    await sent();

    expect(props.onSubmit).toHaveBeenCalledWith("hi!");
    expect(props.onRequestSuccess).toHaveBeenCalledWith("t1");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the server's reason as an error chip and keeps the message on failure", async () => {
    const props = setup(
      vi.fn().mockResolvedValue({ success: false, message: "Too recent" }),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "hi!" },
    });

    fireEvent.click(screen.getByLabelText("Send"));
    const chip = await screen.findByText("Too recent");

    expect(chip.getAttribute("data-variant")).toBe("error");
    expect(props.onRequestSuccess).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Message") as HTMLInputElement).value).toBe(
      "hi!",
    );
    expect(screen.getByLabelText("Try again")).toBeTruthy();
  });

  it("falls back to the generic message when the submit throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setup(vi.fn().mockRejectedValue(new Error("boom")));

    fireEvent.click(screen.getByLabelText("Send"));

    expect(await screen.findByText("Failed to send")).toBeTruthy();
  });

  it("returns the button to Send once the user edits the message", async () => {
    setup(vi.fn().mockResolvedValue({ success: false, message: "Too recent" }));
    fireEvent.click(screen.getByLabelText("Send"));
    await screen.findByText("Too recent");

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "x" },
    });

    expect(screen.getByLabelText("Send")).toBeTruthy();
  });

  it("retries from the error state", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ success: false, message: "Too recent" })
      .mockResolvedValueOnce({ success: true, message: "ok" });
    setup(onSubmit);
    fireEvent.click(screen.getByLabelText("Send"));
    await screen.findByText("Too recent");

    fireEvent.click(screen.getByLabelText("Try again"));
    await sent();

    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
