import { NextResponse } from "next/server";

export interface DeletedAccessResult {
  errorResponse?: NextResponse;
  includeDeleted: boolean;
  onlyDeleted: boolean;
}

/**
 * Validates whether the current user is authorized to view soft-deleted records.
 * Per requirement: "Only Super Admin can view or restore deleted records."
 * If a non-Super Admin requests `deleted=true` or `includeDeleted=true`,
 * returns a 403 Forbidden error response.
 */
export function validateDeletedAccess(user: any, searchParams: URLSearchParams): DeletedAccessResult {
  const includeDeletedParam = searchParams.get("includeDeleted") === "true";
  const onlyDeletedParam = searchParams.get("deleted") === "true" || searchParams.get("showDeleted") === "true";

  if (includeDeletedParam || onlyDeletedParam) {
    const role = (user?.role || "").toLowerCase().trim();
    const isSuperAdmin = role === "super admin" || role === "super_admin";

    if (!isSuperAdmin) {
      return {
        errorResponse: NextResponse.json(
          { success: false, message: "Forbidden: Only Super Admin can view or restore deleted records." },
          { status: 403 }
        ),
        includeDeleted: false,
        onlyDeleted: false,
      };
    }

    return {
      includeDeleted: true,
      onlyDeleted: onlyDeletedParam,
    };
  }

  return {
    includeDeleted: false,
    onlyDeleted: false,
  };
}
