import { NextRequest, NextResponse } from "next/server";

/**
 * Garde serveur : les espaces authentifiés exigent la présence du cookie de
 * session. Le rôle est revérifié côté API à chaque requête (requireAuth /
 * requireStaff côté backend, rôle embarqué dans le JWT et comparé à la base).
 */
const PROTECTED = ["/backoffice", "/mes-formations", "/mes-sessions", "/apprendre"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("token");
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/backoffice/:path*",
    "/mes-formations",
    "/mes-sessions",
    "/apprendre/:path*",
  ],
};
