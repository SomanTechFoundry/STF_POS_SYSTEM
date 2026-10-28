import { NextResponse } from "next/server";
import { ApiError } from "@/lib/errors";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { success: false, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: "Validation failed",
        details: err.flatten(),
      },
      { status: 400 },
    );
  }

  console.error("[api-error]", err);
  return NextResponse.json(
    { success: false, message: "Internal server error", details: null },
    { status: 500 },
  );
}
