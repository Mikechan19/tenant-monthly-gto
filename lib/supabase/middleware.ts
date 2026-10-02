import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGuestOnlyPath, isPublicPath, safeNext } from "@/lib/logic/team";

/** Redirect while keeping any auth cookies the session refresh just set. */
function redirectWith(from: NextResponse, url: URL) {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, skip the auth refresh and pass through.
  // Without this guard createServerClient throws "Your project's URL and Key
  // are required", crashing the edge middleware on every route (500
  // MIDDLEWARE_INVOCATION_FAILED). Pages then show the "not configured" error.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const { pathname, search } = request.nextUrl;
  let response = supabaseResponse;
  let signedIn = false;
  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // Refresh session so it doesn't expire while user is active
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } catch {
    // Never let an auth hiccup crash the entire edge middleware; treat as signed out.
    signedIn = false;
  }

  if (!signedIn && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const to = new URL("/login", request.url);
    if (pathname !== "/") to.searchParams.set("next", pathname + search);
    return redirectWith(response, to);
  }
  if (signedIn && isGuestOnlyPath(pathname)) {
    return redirectWith(response, new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
  }
  return response;
}
