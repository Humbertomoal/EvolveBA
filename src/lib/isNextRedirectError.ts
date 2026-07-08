// Server Actions that call redirect() throw a special error (digest starting
// with "NEXT_REDIRECT") to signal navigation. When a client component awaits
// such an action directly (not via a <form action>), that throw surfaces to
// the caller's try/catch — so callers that want to distinguish a real failure
// from a successful redirect need this check.
export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
