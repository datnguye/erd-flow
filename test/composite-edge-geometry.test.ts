import { describe, expect, it } from "vitest";
import { avgY, bundlePath, bundlePoint, tailPath } from "../src/components/composite-edge/geometry";

describe("avgY", () => {
  it("averages the y of every point", () => {
    expect(avgY([{ x: 0, y: 10 }, { x: 0, y: 20 }, { x: 0, y: 30 }])).toBe(20);
  });

  it("returns the single point's y for a one-point list", () => {
    expect(avgY([{ x: 0, y: 42 }])).toBe(42);
  });
});

describe("bundlePoint", () => {
  it("sits BUNDLE_OFFSET past the card's right edge when the side faces right", () => {
    const p = bundlePoint({ x: 100, y: 200 }, 240, true, 250);
    expect(p).toEqual({ x: 100 + 240 + 40, y: 250 });
  });

  it("sits BUNDLE_OFFSET before the card's left edge when the side faces left", () => {
    const p = bundlePoint({ x: 100, y: 200 }, 240, false, 250);
    expect(p).toEqual({ x: 100 - 40, y: 250 });
  });

  it("is independent of table width on the side facing left", () => {
    const narrow = bundlePoint({ x: 100, y: 0 }, 100, false, 0);
    const wide = bundlePoint({ x: 100, y: 0 }, 400, false, 0);
    expect(narrow.x).toBe(wide.x);
  });
});

describe("tailPath / bundlePath", () => {
  it("tailPath starts and ends exactly at the given points", () => {
    const path = tailPath({ x: 0, y: 0 }, { x: 100, y: 50 });
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path.endsWith("100 50")).toBe(true);
  });

  it("bundlePath starts and ends exactly at the given points", () => {
    const path = bundlePath({ x: 10, y: 5 }, { x: 90, y: 60 }, true);
    expect(path.startsWith("M 10 5")).toBe(true);
    expect(path.endsWith("90 60")).toBe(true);
  });

  it("produces a flat horizontal path when both points share a y", () => {
    const path = tailPath({ x: 0, y: 20 }, { x: 80, y: 20 });
    expect(path).toBe("M 0 20 C 48 20, 32 20, 80 20");
  });
});
