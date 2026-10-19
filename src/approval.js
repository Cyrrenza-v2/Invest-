export function getAccountAccess(profile) {
  if (!profile) return { allowed: false, state: "missing", message: "We could not find your customer profile. Please contact support." };

  const approval = String(profile.approval_status ?? "pending").toLowerCase();
  const account = String(profile.account_status ?? "pending_kyc").toLowerCase();

  if (approval === "rejected") {
    return { allowed: false, state: "rejected", message: "Your account application was not approved. Please contact support if you believe this is incorrect." };
  }
  if (approval !== "approved") {
    return { allowed: false, state: "pending", message: "Your account was created successfully and is waiting for administrator approval." };
  }
  if (account !== "active") {
    return { allowed: false, state: "inactive", message: "Your account has been approved but is not active yet. Please contact support." };
  }
  return { allowed: true, state: "approved", message: "Your account is approved and active." };
}
