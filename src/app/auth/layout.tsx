import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — PaySight",
};

/**
 * Layout for all /auth/* pages.
 * No server-side auth check here — middleware and individual pages handle redirects.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

