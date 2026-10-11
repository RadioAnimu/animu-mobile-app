// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveRequestModal } from "@/components/LiveRequestModal";

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

const mocks = vi.hoisted(() => ({
  user: { id: "u1", nickname: "Haru", username: "haru" } as {
    id: string;
    nickname: string;
    username: string;
  } | null,
  submit: vi.fn(),
  toast: vi.fn(),
  haptics: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/auth/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));
vi.mock("@/core/services/live-request.service", () => ({
  liveRequestService: { submitRequest: mocks.submit },
}));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    LIVE_REQUEST_TITLE: "Live title",
    FORM_LABEL_NICK: "Nickname",
    FORM_LABEL_CITY: "City",
    FORM_LABEL_MUSIC: "Music",
    FORM_LABEL_ARTIST: "Artist",
    FORM_LABEL_ANIME: "Anime",
    FORM_LABEL_REQUEST: "Message",
    FORM_ERROR_REQUIRED: "Required",
    OPTIONAL_LABEL: "optional",
    SEND_REQUEST_BUTTON_TEXT: "Send",
    ERROR_RETRY: "Try again",
    REQUEST_ERROR: "Failed to send",
    REQUEST_SUCCESS: "Sent!",
    OK_BUTTON: "OK",
    A11Y_CLEAR_INPUT: "Clear field",
  }),
}));

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillRequired = () => {
  type("City", "Lisbon");
  type("Music", "Unravel");
  type("Artist", "TK");
  type("Anime", "Tokyo Ghoul");
};

const send = () => fireEvent.click(screen.getByLabelText("Send"));

const sent = () =>
  waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Sent!", "success"));

beforeEach(() => {
  mocks.user = { id: "u1", nickname: "Haru", username: "haru" };
  mocks.toast.mockClear();
});
afterEach(cleanup);

describe("LiveRequestModal", () => {
  it("prefills the nickname from the signed-in user", () => {
    render(<LiveRequestModal visible handleClose={vi.fn()} />);

    expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe(
      "Haru",
    );
  });

  it("flags blank required fields inline without calling the server", () => {
    render(<LiveRequestModal visible handleClose={vi.fn()} />);

    send();

    expect(screen.getAllByText("Required")).toHaveLength(4);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.haptics.error).toHaveBeenCalled();
  });

  it("clears a field's error as soon as it is filled", () => {
    render(<LiveRequestModal visible handleClose={vi.fn()} />);
    send();

    type("City", "Lisbon");

    expect(screen.getAllByText("Required")).toHaveLength(3);
  });

  it("sends trimmed values, closes the sheet and flashes a success chip", async () => {
    const handleClose = vi.fn();
    mocks.submit.mockResolvedValue({ success: true });
    render(<LiveRequestModal visible handleClose={handleClose} />);
    fillRequired();
    type("Music", "  Unravel  ");

    send();
    await sent();

    expect(mocks.submit).toHaveBeenCalledWith({
      name: "Haru",
      city: "Lisbon",
      music: "Unravel",
      artist: "TK",
      anime: "Tokyo Ghoul",
      request: "",
    });
    expect(mocks.haptics.success).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and offers Try again when the send fails", async () => {
    mocks.submit.mockResolvedValue({ success: false, error: "REQUEST_ERROR" });
    render(<LiveRequestModal visible handleClose={vi.fn()} />);
    fillRequired();

    send();
    const chip = await screen.findByText("Failed to send");

    expect(chip.getAttribute("data-variant")).toBe("error");
    expect(mocks.haptics.error).toHaveBeenCalled();
    expect((screen.getByLabelText("Music") as HTMLInputElement).value).toBe(
      "Unravel",
    );
    expect(screen.getByLabelText("Try again")).toBeTruthy();
  });

  it("retries successfully after a failure", async () => {
    mocks.submit
      .mockResolvedValueOnce({ success: false, error: "REQUEST_ERROR" })
      .mockResolvedValueOnce({ success: true });
    render(<LiveRequestModal visible handleClose={vi.fn()} />);
    fillRequired();
    send();
    await screen.findByText("Failed to send");

    fireEvent.click(screen.getByLabelText("Try again"));
    await sent();

    expect(mocks.submit).toHaveBeenCalledTimes(2);
  });

  it("returns the button to Send once the user edits a field", async () => {
    mocks.submit.mockResolvedValue({ success: false, error: "REQUEST_ERROR" });
    render(<LiveRequestModal visible handleClose={vi.fn()} />);
    fillRequired();
    send();
    await screen.findByText("Failed to send");

    type("Artist", "LiSA");

    expect(screen.getByLabelText("Send")).toBeTruthy();
  });

  it("treats a thrown submit as a failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.submit.mockRejectedValue(new Error("boom"));
    render(<LiveRequestModal visible handleClose={vi.fn()} />);
    fillRequired();

    send();

    expect(await screen.findByText("Failed to send")).toBeTruthy();
  });

  it("keeps an unsent draft across a close and reopen", () => {
    const { rerender } = render(
      <LiveRequestModal visible handleClose={vi.fn()} />,
    );
    type("City", "Lisbon");

    rerender(<LiveRequestModal visible={false} handleClose={vi.fn()} />);
    rerender(<LiveRequestModal visible handleClose={vi.fn()} />);

    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe(
      "Lisbon",
    );
  });

  it("opens a blank form after a successful send", async () => {
    mocks.submit.mockResolvedValue({ success: true });
    const { rerender } = render(
      <LiveRequestModal visible handleClose={vi.fn()} />,
    );
    fillRequired();
    send();
    await sent();

    rerender(<LiveRequestModal visible={false} handleClose={vi.fn()} />);
    rerender(<LiveRequestModal visible handleClose={vi.fn()} />);

    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe(
      "Haru",
    );
    await act(async () => {});
  });

  it("does not hand one session's draft to the next", () => {
    const { rerender } = render(
      <LiveRequestModal visible handleClose={vi.fn()} />,
    );
    type("City", "Lisbon");
    rerender(<LiveRequestModal visible={false} handleClose={vi.fn()} />);

    mocks.user = { id: "u2", nickname: "Yuki", username: "yuki" };
    rerender(<LiveRequestModal visible handleClose={vi.fn()} />);

    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe(
      "Yuki",
    );
  });
});
