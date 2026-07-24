export function getSafeAuthRedirectPath(next: string | null | undefined) {
  if (
    next?.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }

  return "/dashboard";
}
