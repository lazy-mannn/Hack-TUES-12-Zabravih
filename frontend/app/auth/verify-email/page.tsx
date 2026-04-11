export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
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
