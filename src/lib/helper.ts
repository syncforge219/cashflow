import { getAuthenticatedUser } from "@/lib/auth";

export async function getUserFromCookies() {
  return await getAuthenticatedUser();
}

