import { z } from "zod";
import { register } from "@/lib/services/auth.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const registerSchema = z.object({
  businessName: z.string().min(2),
  businessProfileId: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const payload = registerSchema.parse(await req.json());
    const data = await register(payload);
    return successResponse(data, 202);
  } catch (err) {
    return errorResponse(err);
  }
}
