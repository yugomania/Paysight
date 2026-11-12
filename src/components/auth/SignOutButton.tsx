"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Client component sign-out button for use inside the existing Sidebar.
 */
export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      title="Sign out"
      aria-label="Sign out of PaySight"
      className="p-1.5 text-[#737373] hover:text-white hover:bg-[#242424] rounded-md transition-colors disabled:opacity-50"
    >
      <LogOut className="w-3.5 h-3.5" />
    </button>
  );
}
