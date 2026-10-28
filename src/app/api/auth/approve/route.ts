import { NextResponse } from "next/server";
import { z } from "zod";
import { approveSignupRequest } from "@/lib/services/auth.service";
import { appUrl, getEnv } from "@/lib/env";
import { errorResponse } from "@/lib/utils/api-response";

const approveSchema = z.object({
  token: z.string().min(20),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { token } = approveSchema.parse({ token: searchParams.get("token") });
    const env = getEnv();

    await approveSignupRequest(token, env.APPROVAL_TO_EMAIL || "approver");

    const redirectUrl = new URL("/login", appUrl());
    redirectUrl.searchParams.set("approved", "1");
    return NextResponse.redirect(redirectUrl, 302);
  } catch (err) {
    return errorResponse(err);
  }
}
