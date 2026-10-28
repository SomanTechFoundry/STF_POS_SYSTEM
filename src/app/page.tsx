import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Soman Tech Foundry
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          STF POS
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
          Clean retail and wholesale billing for fertilizer and paint businesses — products,
          inventory, customers, and reports in one place.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn">
            Log in
          </Link>
          <Link href="/register" className="btn-ghost">
            Register business
          </Link>
        </div>
      </div>
    </div>
  );
}
