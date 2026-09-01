/**
 * SECURITY_CENTER_UX_SPEC.md's screens read from `Session`,
 * `AuthenticationEvent`, and both `AUDIT_EVENT_CATALOG.md` streams — none
 * of which exist as schema yet (LOGISTICS_IMPLEMENTATION_READINESS.md's
 * P5 built the Booking/Approval engine, not this). Rather than leave the
 * screen unbuilt or fake a "real" backing that doesn't exist, this follows
 * the same bootstrap this app used for its first five screens (see the
 * project history — fixtures shipped before the DB layer did): named,
 * clearly-labeled fixture rows a real Session/AuthenticationEvent table
 * will replace once P3's schema is designed and authorized, unchanged in
 * shape from what SECURITY_CENTER_UX_SPEC.md §2-3 already specifies.
 */

export interface FixtureSession {
  id: string;
  deviceLabel: string;
  location: string;
  lastActiveAt: string;
}

export const FIXTURE_OTHER_SESSIONS: FixtureSession[] = [
  { id: "sess_iphone", deviceLabel: "iPhone · Safari", location: "Mumbai, IN", lastActiveAt: "2 hours ago" },
  { id: "sess_windows", deviceLabel: "Chrome on Windows", location: "Delhi, IN", lastActiveAt: "3 days ago" },
];

export interface FixtureLoginEvent {
  id: string;
  event: "auth.login_success" | "auth.login_failure" | "auth.new_device";
  deviceLabel: string;
  location: string;
  occurredAt: string;
}

export const FIXTURE_LOGIN_HISTORY: FixtureLoginEvent[] = [
  { id: "evt_1", event: "auth.login_success", deviceLabel: "Chrome on macOS", location: "Mumbai, IN", occurredAt: "Today, 9:14 AM" },
  { id: "evt_2", event: "auth.new_device", deviceLabel: "iPhone · Safari", location: "Mumbai, IN", occurredAt: "Yesterday, 6:02 PM" },
  { id: "evt_3", event: "auth.login_failure", deviceLabel: "Unknown device", location: "Unknown", occurredAt: "3 days ago, 11:41 PM" },
  { id: "evt_4", event: "auth.login_success", deviceLabel: "Chrome on Windows", location: "Delhi, IN", occurredAt: "3 days ago, 8:20 AM" },
];

/**
 * A canned example of the exact shape `evaluateAuthorization()`
 * (packages/auth/src/authorize.ts, P1b) already returns today — this is
 * not invented text, it is that function's real `AuthorizationDecision`
 * reason strings, reproduced here since no screen calls it live yet.
 */
export const FIXTURE_EXPLAIN_EXAMPLES = [
  {
    subject: "Priya Sharma",
    action: "budget.view_detail",
    resource: "Wardrobe department budget",
    allowed: true,
    reason: 'Granted "budget.view_detail" via Department Head assignment for department "dept_wardrobe" — not the Coordinator role bundle. See packages/auth/src/authorize.ts: departments.manage/assign_hod-adjacent permissions are only ever sourced from department_head_assignments, never a flat role.',
  },
  {
    subject: "Rohan Das",
    action: "departments.assign_hod",
    resource: "Wardrobe department",
    allowed: false,
    reason: 'No grant includes permission "departments.assign_hod" — Rohan Das is a Department Member, not the Wardrobe Head of Department, and this permission is never granted by any role bundle.',
  },
] as const;
