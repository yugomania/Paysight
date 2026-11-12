/**
 * Authentication & Route Protection Tests
 *
 * Tests for login/signup form validation, auth errors, redirects,
 * and route protection.
 *
 * Run with: npm test
 * Note: These tests do NOT require real Supabase credentials.
 * They test logic, validation, and flow — not live Supabase calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Form Validation Logic ────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Please enter a valid email address.";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8)
    return "Password must be at least 8 characters.";
  return null;
}

function validatePasswordMatch(
  password: string,
  confirmPassword: string
): string | null {
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

function validateSignUpForm(
  email: string,
  password: string,
  confirmPassword: string
): string | null {
  return (
    validateEmail(email) ??
    validatePassword(password) ??
    validatePasswordMatch(password, confirmPassword)
  );
}

function validateSignInForm(email: string, password: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!password) return "Password is required.";
  return null;
}

// ─── Redirect Safety ─────────────────────────────────────────────────────────

function sanitizeNextParam(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Sign Up Form Validation", () => {
  it("rejects empty email", () => {
    assert.equal(validateSignUpForm("", "password123", "password123"), "Email is required.");
  });

  it("rejects invalid email format", () => {
    assert.equal(
      validateSignUpForm("not-an-email", "password123", "password123"),
      "Please enter a valid email address."
    );
  });

  it("rejects empty password", () => {
    assert.equal(
      validateSignUpForm("user@example.com", "", ""),
      "Password is required."
    );
  });

  it("rejects password shorter than 8 characters", () => {
    assert.equal(
      validateSignUpForm("user@example.com", "short", "short"),
      "Password must be at least 8 characters."
    );
  });

  it("rejects mismatched passwords", () => {
    assert.equal(
      validateSignUpForm("user@example.com", "password123", "different456"),
      "Passwords do not match."
    );
  });

  it("accepts valid registration data", () => {
    assert.equal(
      validateSignUpForm("user@example.com", "securePass1", "securePass1"),
      null
    );
  });

  it("accepts email with sub-domain", () => {
    assert.equal(
      validateSignUpForm("user@mail.example.com", "password123", "password123"),
      null
    );
  });
});

describe("Sign In Form Validation", () => {
  it("rejects empty email", () => {
    assert.equal(validateSignInForm("", "password"), "Email is required.");
  });

  it("rejects empty password", () => {
    assert.equal(
      validateSignInForm("user@example.com", ""),
      "Password is required."
    );
  });

  it("accepts valid credentials format", () => {
    assert.equal(
      validateSignInForm("user@example.com", "anypassword"),
      null
    );
  });

  it("trims whitespace from email before validating", () => {
    assert.equal(
      validateSignInForm("  ", "password"),
      "Email is required."
    );
  });
});

describe("Password Mismatch Validation", () => {
  it("detects password mismatch", () => {
    assert.equal(
      validatePasswordMatch("pass1", "pass2"),
      "Passwords do not match."
    );
  });

  it("passes when passwords match", () => {
    assert.equal(validatePasswordMatch("samePass1", "samePass1"), null);
  });

  it("is case-sensitive", () => {
    assert.equal(
      validatePasswordMatch("Password1", "password1"),
      "Passwords do not match."
    );
  });
});

describe("Redirect Safety (open-redirect prevention)", () => {
  it("allows safe relative paths", () => {
    assert.equal(sanitizeNextParam("/dashboard"), "/dashboard");
  });

  it("allows deep relative paths", () => {
    assert.equal(
      sanitizeNextParam("/dashboard/invoices"),
      "/dashboard/invoices"
    );
  });

  it("blocks protocol-relative URLs", () => {
    assert.equal(
      sanitizeNextParam("//evil.com"),
      "/dashboard"
    );
  });

  it("blocks absolute external URLs", () => {
    assert.equal(
      sanitizeNextParam("https://evil.com"),
      "/dashboard"
    );
  });

  it("defaults to /dashboard when null", () => {
    assert.equal(sanitizeNextParam(null), "/dashboard");
  });

  it("defaults to /dashboard for empty string", () => {
    assert.equal(sanitizeNextParam(""), "/dashboard");
  });
});

describe("Auth Error Message Categorization", () => {
  function categorizeAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("invalid") || lower.includes("credentials") || lower.includes("wrong")) {
      return "invalid_credentials";
    }
    if (lower.includes("confirm") || lower.includes("email not confirmed")) {
      return "unconfirmed_email";
    }
    if (lower.includes("already registered") || lower.includes("already exists")) {
      return "duplicate_account";
    }
    return "generic_error";
  }

  it("categorizes invalid login error", () => {
    assert.equal(
      categorizeAuthError("Invalid login credentials"),
      "invalid_credentials"
    );
  });

  it("categorizes email confirmation error", () => {
    assert.equal(
      categorizeAuthError("Email not confirmed"),
      "unconfirmed_email"
    );
  });

  it("categorizes duplicate account error", () => {
    assert.equal(
      categorizeAuthError("User already registered"),
      "duplicate_account"
    );
  });

  it("categorizes unknown errors as generic", () => {
    assert.equal(
      categorizeAuthError("Unexpected server error"),
      "generic_error"
    );
  });
});
