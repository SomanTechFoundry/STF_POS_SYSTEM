import { z } from "zod";
import { login } from "@/lib/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const payload = loginSchema.parse(await req.json());
    const data = await login(payload);
    await setSessionCookie(data.accessToken);
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
