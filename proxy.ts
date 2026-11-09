import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { dataMode } from "@/lib/data-mode";
import { PREVIEW_COOKIE, previewCookieMatches, previewDecision, previewPassword } from "@/lib/preview-gate";

export async function proxy(request: NextRequest) {
  const password = previewPassword();
  const decision = previewDecision({
    nodeEnv: process.env.NODE_ENV,
    dataMode: dataMode(),
    password,
    pathname: request.nextUrl.pathname,
    cookieOk: password ? await previewCookieMatches(request.cookies.get(PREVIEW_COOKIE)?.value, password) : false,
  });
  if (decision === "allow") return NextResponse.next();
  if (decision === "locked") {
    return new NextResponse("This preview is locked.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/preview-gate";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
