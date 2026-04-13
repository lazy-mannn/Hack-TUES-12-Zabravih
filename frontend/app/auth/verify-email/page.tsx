export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 text-center space-y-4" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)" }}>
        <div className="text-5xl">📬</div>
        <h1 className="text-2xl font-bold text-amber-900">Check your email</h1>
        <p className="text-gray-600">
          We sent a verification link to your email address.
          Click it to activate your account.
        </p>
        <p className="text-sm text-gray-400">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <a
          href="/auth/login"
          className="inline-block mt-2 text-sm text-amber-700 hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
