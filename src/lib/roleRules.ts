/**
 * Role helpers with no server dependencies, so client components can import them.
 * (batchRules.ts re-exports these; it pulls in mongoose, so client code must import from here.)
 */

export const normalizeRole = (role: unknown) => String(role || "").toLowerCase().replace(/[\s_-]+/g, "");

export function isTeacherRole(role: unknown) {
  const r = normalizeRole(role);
  return (
    r === "teacher" ||
    r === "faculty" ||
    r === "instructor" ||
    r === "trainer" ||
    r.includes("teacher") ||
    r.includes("faculty") ||
    r.includes("instructor") ||
    r.includes("trainer")
  );
}
