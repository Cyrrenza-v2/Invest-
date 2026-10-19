export const USER_SECTION_PATHS = Object.freeze({
  Overview: "/dashboard",
  "My investments": "/investments",
  "My wallet": "/wallet",
  Profit: "/profit",
  Withdrawals: "/withdraw",
  Deposits: "/deposit",
  Transactions: "/transactions",
  Verification: "/kyc",
  Documents: "/documents",
  Notifications: "/notifications",
  "Support & complaints": "/support",
  Security: "/security",
});

export const ADMIN_SECTION_PATHS = Object.freeze({
  Dashboard: "/admin/dashboard",
  Users: "/admin/users",
  Investments: "/admin/investments",
  "Investment Plans": "/admin/investment-plans",
  "Profit Management": "/admin/returns",
  Deposits: "/admin/deposits",
  Withdrawals: "/admin/withdrawals",
  Treasury: "/admin/treasury",
  Compliance: "/admin/compliance",
  "AI Assistant": "/admin/ai",
  Reports: "/admin/reports",
  "Audit Logs": "/admin/audit",
  Settings: "/admin/settings",
});

const USER_PATH_SECTIONS = new Map(
  Object.entries(USER_SECTION_PATHS).map(([section, path]) => [path, section]),
);
const ADMIN_PATH_SECTIONS = new Map(
  Object.entries(ADMIN_SECTION_PATHS).map(([section, path]) => [path, section]),
);

export function resolveUserRoute(pathname = "/") {
  const path = normalizePath(pathname);
  if (path === "/login") return { section: "Overview", authMode: "login", known: true };
  if (path === "/register") return { section: "Overview", authMode: "signup", known: true };
  if (path === "/forgot-password") return { section: "Overview", authMode: "reset", known: true };
  if (path === "/" || path === "/dashboard") return { section: "Overview", authMode: null, known: true };
  const section = USER_PATH_SECTIONS.get(path);
  return section
    ? { section, authMode: null, known: true }
    : { section: "Overview", authMode: null, known: false };
}

export function getUserSection(pathname = "/") {
  return resolveUserRoute(pathname).section;
}

export function getUserPath(section) {
  return USER_SECTION_PATHS[section] || USER_SECTION_PATHS.Overview;
}

export function resolveAdminRoute(pathname = "/admin") {
  const path = normalizePath(pathname);
  if (path === "/admin" || path === "/admin/login") {
    return { section: "Dashboard", known: true };
  }
  const section = ADMIN_PATH_SECTIONS.get(path);
  return section
    ? { section, known: true }
    : { section: "Dashboard", known: false };
}

export function getAdminSection(pathname = "/admin") {
  return resolveAdminRoute(pathname).section;
}

export function getAdminPath(section) {
  return ADMIN_SECTION_PATHS[section] || ADMIN_SECTION_PATHS.Dashboard;
}

export function isAdminPath(pathname = "/") {
  const path = normalizePath(pathname);
  return path === "/admin" || path.startsWith("/admin/");
}

function normalizePath(pathname) {
  const path = String(pathname || "/").split("?")[0].split("#")[0];
  if (path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}
