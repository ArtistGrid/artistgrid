import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LastFMModal } from "@/src/components/lastfm-modal";
import type { LastFMClientInfo } from "@/src/types";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: true, configurable: true });
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: false, configurable: true });
  });
});

const baseLastfm = (over: Partial<LastFMClientInfo> = {}): LastFMClientInfo => ({
  isAuthenticated: false,
  username: null,
  getAuthUrl: vi.fn(),
  completeAuth: vi.fn(),
  disconnect: vi.fn(),
  scrobble: vi.fn(),
  updateNowPlaying: vi.fn(),
  ...over,
});

describe("LastFMModal", () => {
  it("shows connect button when unauthenticated and no token", () => {
    render(<LastFMModal isOpen onClose={() => {}} lastfm={baseLastfm()} token={null} setToken={() => {}} />);
    expect(screen.getByText(/Connect your Last.fm account/)).toBeInTheDocument();
    expect(screen.getByText("Connect Last.fm")).toBeInTheDocument();
  });

  it("connects and opens popup", async () => {
    const setToken = vi.fn();
    const popup = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const lastfm = baseLastfm({ getAuthUrl: vi.fn().mockResolvedValue({ token: "t1", url: "https://lastfm/auth" }) });
    render(<LastFMModal isOpen onClose={() => {}} lastfm={lastfm} token={null} setToken={setToken} />);
    fireEvent.click(screen.getByText("Connect Last.fm"));
    await waitFor(() => expect(setToken).toHaveBeenCalledWith("t1"));
    expect(popup.location.href).toBe("https://lastfm/auth");
  });

  it("shows username when authenticated", () => {
    render(
      <LastFMModal isOpen onClose={() => {}} lastfm={baseLastfm({ isAuthenticated: true, username: "edideaur" })} token={null} setToken={() => {}} />
    );
    expect(screen.getByText(/Connected as/)).toBeInTheDocument();
    expect(screen.getByText("edideaur")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("disconnects when disconnect clicked", () => {
    const onClose = vi.fn();
    const lastfm = baseLastfm({ isAuthenticated: true, username: "edideaur", disconnect: vi.fn() });
    render(<LastFMModal isOpen onClose={onClose} lastfm={lastfm} token={null} setToken={() => {}} />);
    fireEvent.click(screen.getByText("Disconnect"));
    expect(lastfm.disconnect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("completes auth when token present", async () => {
    const onClose = vi.fn();
    const lastfm = baseLastfm({ completeAuth: vi.fn().mockResolvedValue({ success: true, username: "edideaur" }) });
    const setToken = vi.fn();
    render(<LastFMModal isOpen onClose={onClose} lastfm={lastfm} token="t1" setToken={setToken} />);
    fireEvent.click(screen.getByText("Complete Connection"));
    await waitFor(() => expect(lastfm.completeAuth).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(setToken).toHaveBeenCalledWith(null));
    expect(onClose).toHaveBeenCalled();
  });
});
