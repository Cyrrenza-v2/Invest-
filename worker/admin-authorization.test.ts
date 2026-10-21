import { describe, expect, it } from "vitest";
import { adminAuthorizationFailure } from "../supabase/functions/admin-api/authorization.js";

const primaryAdminId = "4ace0490-62cc-4bce-a5a7-dcc5a0779c96";
const authorizedContext = {
  user: { id: primaryAdminId, app_metadata: { role: "admin" } },
  claims: { aal: "aal2" },
  profile: { account_status: "active", approval_status: "approved" },
  primaryAdminId,
};

describe("CEO-only administrator authorization", () => {
  it("allows only the assigned primary admin with verified MFA and an active approved profile", () => {
    expect(adminAuthorizationFailure(authorizedContext)).toBeNull();
  });

  it("rejects missing or invalid users", () => {
    expect(adminAuthorizationFailure({ ...authorizedContext, user: null })).toMatchObject({ status: 401 });
  });

  it("rejects users who do not have the server-managed admin role", () => {
    expect(adminAuthorizationFailure({
      ...authorizedContext,
      user: { ...authorizedContext.user, app_metadata: { role: "user" } },
    })).toMatchObject({ status: 403 });
  });

  it("requires verified MFA at assurance level AAL2", () => {
    expect(adminAuthorizationFailure({ ...authorizedContext, claims: { aal: "aal1" } })).toMatchObject({ status: 403 });
    expect(adminAuthorizationFailure({ ...authorizedContext, claims: {} })).toMatchObject({ status: 403 });
  });

  it("rejects inactive or unapproved administrator profiles", () => {
    expect(adminAuthorizationFailure({
      ...authorizedContext,
      profile: { account_status: "suspended", approval_status: "approved" },
    })).toMatchObject({ status: 403 });
    expect(adminAuthorizationFailure({
      ...authorizedContext,
      profile: { account_status: "active", approval_status: "pending" },
    })).toMatchObject({ status: 403 });
  });

  it("fails closed when the primary administrator is not configured", () => {
    expect(adminAuthorizationFailure({ ...authorizedContext, primaryAdminId: null })).toMatchObject({ status: 503 });
  });

  it("rejects a different administrator even if their token claims an admin role", () => {
    expect(adminAuthorizationFailure({
      ...authorizedContext,
      user: { ...authorizedContext.user, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    })).toMatchObject({ status: 403 });
  });

  it("rejects a suspended administrator session", () => {
    expect(adminAuthorizationFailure({
      ...authorizedContext,
      user: { ...authorizedContext.user, banned_until: new Date(Date.now() + 60_000).toISOString() },
    })).toMatchObject({ status: 403 });
  });
});
