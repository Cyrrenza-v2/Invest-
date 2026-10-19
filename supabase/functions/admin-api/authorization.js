export function adminAuthorizationFailure({ user, claims, profile, primaryAdminId, now = Date.now() }) {
  if (!user) return { status: 401, message: "Invalid or expired session" };

  const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : NaN;
  if (Number.isFinite(bannedUntil) && bannedUntil > now) {
    return { status: 403, message: "Administrator account is suspended" };
  }
  if (user.app_metadata?.role !== "admin") {
    return { status: 403, message: "Sole administrator permission required" };
  }
  if (claims?.aal !== "aal2") {
    return { status: 403, message: "Verified MFA (AAL2) is required" };
  }
  if (!profile || profile.account_status !== "active" || profile.approval_status !== "approved") {
    return { status: 403, message: "Active, approved administrator account required" };
  }
  if (!primaryAdminId) {
    return { status: 503, message: "The platform owner must assign the single primary administrator before admin operations can be used." };
  }
  if (primaryAdminId !== user.id) {
    return { status: 403, message: "This account is not the assigned primary administrator." };
  }
  return null;
}
