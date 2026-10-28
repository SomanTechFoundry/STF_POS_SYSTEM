import { successResponse } from "@/lib/utils/api-response";

export async function GET() {
  return successResponse({ status: "ok", service: "stf-pos-system" });
}
