import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const dbUser = await getAuthenticatedUser();

    if (!dbUser) {
      return NextResponse.json(
        { authenticated: false, error: "Unauthenticated or session expired" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        phone: (dbUser as any).phone || "",
        photoUrl: (dbUser as any).photoUrl || "",
        brandLogo: (dbUser as any).brandLogo || "",
        customAppName: (dbUser as any).customAppName || "Coach",
      },
    });
  } catch (error) {
    console.error("Auth Session API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

