import Link from "next/link";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Sign Up — PawPin" };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-800">Join PawPin</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create an account to report sightings, follow cases, and help stray cats.
        </p>
      </div>
      <Card>
        <SignUpForm />
      </Card>
      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
