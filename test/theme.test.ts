import { describe, expect, it } from "vitest";
import { DEFAULT_RESOURCE_META, themeStyle } from "../src/theme";

describe("themeStyle", () => {
  it("returns an empty object when no theme is given", () => {
    expect(themeStyle(undefined)).toEqual({});
  });

  it("maps theme fields to their CSS custom properties", () => {
    const style = themeStyle({ accent: "#ff0", border: "#0af" }) as Record<string, string>;
    expect(style["--erd-accent"]).toBe("#ff0");
    expect(style["--erd-border"]).toBe("#0af");
  });

  it("omits unset tokens (so the CSS hex fallbacks apply)", () => {
    const style = themeStyle({ accent: "#ff0" }) as Record<string, string>;
    expect(style["--erd-border"]).toBeUndefined();
    expect(Object.keys(style)).toEqual(["--erd-accent"]);
  });
});

describe("DEFAULT_RESOURCE_META", () => {
  it("carries the dbt physical resource types", () => {
    expect(DEFAULT_RESOURCE_META.model.color).toBeTruthy();
    expect(DEFAULT_RESOURCE_META.source.color).toBeTruthy();
    expect(DEFAULT_RESOURCE_META.seed).toBeDefined();
    expect(DEFAULT_RESOURCE_META.snapshot).toBeDefined();
  });

  it("gives source a database icon and the rest a table icon", () => {
    expect(DEFAULT_RESOURCE_META.source.icon).toBe("database");
    expect(DEFAULT_RESOURCE_META.model.icon).toBe("table");
    expect(DEFAULT_RESOURCE_META.seed.icon).toBe("table");
    expect(DEFAULT_RESOURCE_META.snapshot.icon).toBe("table");
  });
});
