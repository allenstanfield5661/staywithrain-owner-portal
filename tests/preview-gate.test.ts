import { describe, expect, it } from "vitest";
import { previewCookieMatches, previewDecision, previewToken } from "@/lib/preview-gate";

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

  it("accepts only the token for the configured password", async () => {
    process.env.SESSION_SECRET = "test-secret";
    const token = await previewToken("harbor-light");
    expect(await previewCookieMatches(token, "harbor-light")).toBe(true);
    expect(await previewCookieMatches(token, "other")).toBe(false);
    expect(await previewCookieMatches(undefined, "harbor-light")).toBe(false);
  });
});
