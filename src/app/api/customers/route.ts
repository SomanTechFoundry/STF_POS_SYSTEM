import { z } from "zod";
import { getLocale, requireRoles, requireSession } from "@/lib/auth/session";
import { createCustomer, listCustomers } from "@/lib/services/customers.service";
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

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const data = await listCustomers(session.businessId, getLocale(req));
    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    requireRoles(session, "admin", "owner");
    const payload = customerSchema.parse(await req.json());
    const data = await createCustomer(session.businessId, payload, getLocale(req));
    return successResponse(data, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
