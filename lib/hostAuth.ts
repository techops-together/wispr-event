import { NextRequest } from "next/server";

export function hostAuthorized(req: NextRequest): boolean {
  const expected = process.env.HOST_KEY;
  if (!expected) return true; // local dev without a key configured
  const provided =
    req.nextUrl.searchParams.get("key") ?? req.headers.get("x-host-key") ?? "";
  return provided === expected;
}
