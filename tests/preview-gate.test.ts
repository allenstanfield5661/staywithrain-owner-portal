import { describe, expect, it } from "vitest";
import { isPublicDemoPath, previewCookieMatches, previewDecision, previewToken } from "@/lib/preview-gate";

describe("preview gate", () => {
  it("stays open in local development until a password is set", () => {
    expect(previewDecision({ nodeEnv: "development", password: undefined, pathname: "/portal", cookieOk: false })).toBe(
      "allow",
    );
  });

  it("does not use the preview password in live mode", () => {
    expect(
      previewDecision({
        nodeEnv: "production",
        dataMode: "live",
        password: undefined,
        pathname: "/portal",
        cookieOk: false,
      }),
    ).toBe("allow");
  });

  it("locks a hosted mock build that has no preview password", () => {
    expect(previewDecision({ nodeEnv: "production", password: undefined, pathname: "/portal", cookieOk: false })).toBe(
      "locked",
    );
    expect(previewDecision({ nodeEnv: "production", password: undefined, pathname: "/preview-gate", cookieOk: false })).toBe(
      "allow",
    );
  });

  it("sends everyone else to the gate until the cookie matches", () => {
    expect(previewDecision({ nodeEnv: "production", password: "secret", pathname: "/", cookieOk: false })).toBe("gate");
    expect(previewDecision({ nodeEnv: "production", password: "secret", pathname: "/api/auth/login", cookieOk: false })).toBe(
      "gate",
    );
    expect(previewDecision({ nodeEnv: "production", password: "secret", pathname: "/api/preview-gate", cookieOk: false })).toBe(
      "allow",
    );
    expect(previewDecision({ nodeEnv: "production", password: "secret", pathname: "/portal", cookieOk: true })).toBe(
      "allow",
    );
  });

  it("lets the public sample portal through without a preview cookie", () => {
    for (const pathname of ["/demo", "/demo/calendar", "/demo/reservations", "/demo/statements", "/demo/golf-cart"]) {
      expect(isPublicDemoPath(pathname)).toBe(true);
      expect(previewDecision({ nodeEnv: "production", password: "secret", pathname, cookieOk: false })).toBe("allow");
      expect(previewDecision({ nodeEnv: "production", password: undefined, pathname, cookieOk: false })).toBe("allow");
      expect(
        previewDecision({ nodeEnv: "production", dataMode: "live", password: undefined, pathname, cookieOk: false }),
      ).toBe("allow");
    }
    expect(isPublicDemoPath("/demonstration")).toBe(false);
    expect(isPublicDemoPath("/demo-extra")).toBe(false);
  });

  it("still gates the owner portal, admin, and dashboard when a preview password is set", () => {
    for (const pathname of ["/dashboard", "/admin", "/admin/owners", "/portal", "/api/calendar", "/api/admin"]) {
      expect(previewDecision({ nodeEnv: "production", password: "secret", pathname, cookieOk: false })).toBe("gate");
      expect(isPublicDemoPath(pathname)).toBe(false);
    }
  });

  it("accepts only the token for the configured password", async () => {
    process.env.SESSION_SECRET = "test-secret";
    const token = await previewToken("harbor-light");
    expect(await previewCookieMatches(token, "harbor-light")).toBe(true);
    expect(await previewCookieMatches(token, "other")).toBe(false);
    expect(await previewCookieMatches(undefined, "harbor-light")).toBe(false);
  });
});
