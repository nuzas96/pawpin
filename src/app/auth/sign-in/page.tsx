import { Suspense } from "react";
import Link from "next/link";
import { SignInForm } from "@/components/auth/SignInForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Sign In — PawPin" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-800">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to your PawPin account.</p>
      </div>
      <Card>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
          <SignInForm />
        </Suspense>
      </Card>
      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/auth/sign-up" className="font-medium text-brand-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
