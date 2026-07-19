import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YouTubePlayer } from "@/src/components/youtube-player";
import { FloatingVideoPlayer } from "@/src/components/floating-video-player";

describe("YouTubePlayer", () => {
  it("renders iframe for valid youtube url", () => {
    render(<YouTubePlayer url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" onClose={() => {}} />);
    const iframe = screen.getByTitle("YouTube video") as HTMLIFrameElement;
    expect(iframe.src).toContain("dQw4w9WgXcQ");
  });

  it("returns null for invalid url", () => {
    const { container } = render(<YouTubePlayer url="not-a-url" onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("FloatingVideoPlayer", () => {
  it("renders a video element", () => {
    render(<FloatingVideoPlayer url="https://x.com/v.mp4" onClose={() => {}} />);
    const video = document.querySelector("video")!;
    expect(video).toBeTruthy();
    expect(video.getAttribute("src")).toBe("https://x.com/v.mp4");
  });
});
