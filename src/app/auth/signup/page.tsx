"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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

export default function SignUpPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validate = useCallback((): string | null => {
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Please enter a valid email address.";
    if (!password) return "Password is required.";
    if (password.length < 8)
      return "Password must be at least 8 characters.";
    if (password !== confirmPassword)
      return "Passwords do not match.";
    return null;
  }, [email, password, confirmPassword]);

  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");
      setLoading(true);
      try {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (authError) {
          if (authError.message.toLowerCase().includes("already registered") ||
              authError.message.toLowerCase().includes("already exists") ||
              authError.message.toLowerCase().includes("user already")) {
            setError(
              "An account with this email already exists. Please sign in instead."
            );
          } else {
            setError(authError.message);
          }
          return;
        }

        // Show email confirmation message (Supabase default behavior)
        setSuccess(true);
      } catch {
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, loading, validate, supabase.auth]
  );

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <PaySightAuthLogo />
          <div className="bg-[#111827] border border-[#1E2D40] rounded-2xl p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-[#34D399]" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Check your inbox
            </h1>
            <p className="text-sm text-[#8B9AB5] mb-6">
              We sent a confirmation link to{" "}
              <span className="font-medium text-white">{email}</span>. Click
              the link in that email to activate your PaySight account.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <PaySightAuthLogo />

        <div className="bg-[#111827] border border-[#1E2D40] rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1">Create account</h1>
          <p className="text-sm text-[#8B9AB5] mb-6">
            Get started with PaySight merchant intelligence
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

          <form onSubmit={handleSignUp} noValidate className="space-y-4">
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
                Password{" "}
                <span className="text-[#4A5568] font-normal">
                  (min. 8 characters)
                </span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  placeholder="Create a strong password"
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

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-[#8B9AB5] mb-1.5"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  placeholder="Re-enter your password"
                  className="w-full bg-[#0A0F1E] border border-[#1E2D40] rounded-lg px-3.5 py-2.5 pr-11 text-sm text-white placeholder:text-[#4A5568] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#8B9AB5] transition-colors"
                  aria-label={
                    showConfirm ? "Hide confirm password" : "Show confirm password"
                  }
                  tabIndex={-1}
                >
                  {showConfirm ? (
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
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#1E2D40] text-center text-sm text-[#8B9AB5]">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-[#60A5FA] hover:text-[#93C5FD] font-medium transition-colors"
            >
              Sign in
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

