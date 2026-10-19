export function isApprovedAccount(profile) {
  return profile?.approval_status === "approved" && profile?.account_status === "active";
}

export function approvalAccessMessage(profile) {
  if (isApprovedAccount(profile)) return "approved";
  if (profile?.approval_status === "rejected") return "rejected";
  if (profile?.approval_status === "approved" && profile?.account_status !== "active") return "restricted";
  return "pending";
}
