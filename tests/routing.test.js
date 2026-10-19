import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_SECTION_PATHS,
  USER_SECTION_PATHS,
  getAdminPath,
  getAdminSection,
  getUserPath,
  getUserSection,
  isAdminPath,
  resolveAdminRoute,
  resolveUserRoute,
} from "../src/routing.js";

test("user routes resolve to the expected user sections", () => {
  for (const [section, path] of Object.entries(USER_SECTION_PATHS)) {
    assert.equal(getUserSection(path), section, path);
    assert.equal(getUserPath(section), path, section);
  }
});

test("user auth routes select the correct auth mode", () => {
  assert.equal(resolveUserRoute("/login").authMode, "login");
  assert.equal(resolveUserRoute("/register").authMode, "signup");
  assert.equal(resolveUserRoute("/forgot-password").authMode, "reset");
});

test("unknown user paths are explicitly marked unknown", () => {
  assert.equal(resolveUserRoute("/not-a-user-page").known, false);
  assert.equal(getUserSection("/not-a-user-page"), "Overview");
});

test("admin routes resolve independently of user routes", () => {
  for (const [section, path] of Object.entries(ADMIN_SECTION_PATHS)) {
    assert.equal(getAdminSection(path), section, path);
    assert.equal(getAdminPath(section), path, section);
  }
  assert.equal(getAdminSection("/admin/login"), "Dashboard");
});

test("admin paths are identifiable and unknown admin routes fail closed at the route contract", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/users"), true);
  assert.equal(isAdminPath("/dashboard"), false);
  assert.equal(resolveAdminRoute("/admin/not-a-page").known, false);
});

test("the route contracts do not overlap across user and admin shells", () => {
  const userPaths = new Set(Object.values(USER_SECTION_PATHS));
  for (const path of Object.values(ADMIN_SECTION_PATHS)) {
    assert.equal(userPaths.has(path), false, path);
  }
});
