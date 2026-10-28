"use client";

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h2 className="page-title">Access denied</h2>
      <p className="page-subtitle">
        Your role does not include this module. Contact an admin if you need access.
      </p>
      <Link href="/app" className="btn mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
