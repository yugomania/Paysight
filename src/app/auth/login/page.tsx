"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

function PaySightAuthLogo() {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-base select-none bg-white text-[#111111]"
        aria-hidden="true"
      >
        P
      </div>
      <div>
        <span className="font-bold text-lg tracking-tight text-white">
          PaySight
        </span>
        <p className="text-xs text-[#A3A3A3] leading-tight">
          Merchant Intelligence
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      setError("");

      // Basic validation
      if (!email.trim()) {
        setError("Email is required.");
        return;
      }
      if (!password) {
        setError("Password is required.");
        return;
      }

      setLoading(true);
      try {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authError) {
          if (
            authError.message.toLowerCase().includes("invalid") ||
            authError.message.toLowerCase().includes("credentials") ||
            authError.message.toLowerCase().includes("wrong")
          ) {
            setError(
              "Incorrect email or password. Please check your credentials."
            );
          } else if (authError.message.toLowerCase().includes("confirm")) {
            setError(
              "Please confirm your email address before signing in. Check your inbox."
            );
          } else {
            setError(authError.message);
          }
          return;
        }

        // Redirect to dashboard — middleware validates the session
        router.push("/dashboard");
      } catch {
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, loading, supabase.auth, router]
  );

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <PaySightAuthLogo />

        <div className="bg-[#111827] border border-[#1E2D40] rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-[#8B9AB5] mb-6">
            Sign in to your PaySight account
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 p-3.5 rounded-lg bg-[#1F0E0E] border border-[#7F1D1D] text-sm text-[#FCA5A5]"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#8B9AB5] mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                placeholder="merchant@example.com"
                className="w-full bg-[#0A0F1E] border border-[#1E2D40] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-[#4A5568] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#8B9AB5] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  placeholder="Enter your password"
                  className="w-full bg-[#0A0F1E] border border-[#1E2D40] rounded-lg px-3.5 py-2.5 pr-11 text-sm text-white placeholder:text-[#4A5568] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#8B9AB5] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3B82F6] focus:ring-offset-[#111827] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#1E2D40] text-center text-sm text-[#8B9AB5]">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-[#60A5FA] hover:text-[#93C5FD] font-medium transition-colors"
            >
              Create one
            </Link>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-[#4A5568]">
          <Link
            href="/"
            className="hover:text-[#8B9AB5] transition-colors"
          >
            ← Back to PaySight
          </Link>
        </p>
      </div>
    </div>
  );
}
