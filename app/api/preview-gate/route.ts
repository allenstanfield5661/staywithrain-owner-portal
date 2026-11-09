import { NextResponse } from "next/server";
import { passwordsMatch } from "@/lib/session";
import { cookiesAreSecure, PREVIEW_COOKIE, previewPassword, previewToken } from "@/lib/preview-gate";

export async function POST(request: Request) {
  const password = previewPassword();
  const form = await request.formData();
  const given = String(form.get("password") ?? "");
  const back = new URL("/preview-gate", request.url);
  if (!password || !passwordsMatch(given, password)) {
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, 303);
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(PREVIEW_COOKIE, await previewToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookiesAreSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
