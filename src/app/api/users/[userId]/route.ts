import { z } from "zod";
import { requireRoles, requireSession } from "@/lib/auth/session";
import { updateUser } from "@/lib/services/users.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const updateUserSchema = z
  .object({
    role: z.enum(["admin", "owner", "viewer"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Provide role or isActive",
  });

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin");
    const { userId } = paramsSchema.parse(await ctx.params);
    const payload = updateUserSchema.parse(await req.json());
    const data = await updateUser(userId, payload, { userId: session.userId });
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
