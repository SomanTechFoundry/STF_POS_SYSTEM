import { z } from "zod";
import { getLocale, requireRoles, requireSession } from "@/lib/auth/session";
import { deleteCustomer, updateCustomer } from "@/lib/services/customers.service";
import { errorResponse, successResponse } from "@/lib/utils/api-response";

const optionalString = z.string().trim().optional().default("");

const customerSchema = z.object({
  name: z.string().trim().min(2),
  address: optionalString,
  mobile: optionalString.refine((value) => value === "" || (value.length >= 5 && value.length <= 15), {
    message: "Mobile number must be 5 to 15 characters",
  }),
  email: optionalString.refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    { message: "Invalid email address" },
  ),
});

const paramsSchema = z.object({
  customerId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ customerId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const { customerId } = paramsSchema.parse(await ctx.params);
    const payload = customerSchema.parse(await req.json());
    const data = await updateCustomer(session.businessId, customerId, payload, getLocale(req));
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const { customerId } = paramsSchema.parse(await ctx.params);
    const data = await deleteCustomer(session.businessId, customerId);
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
