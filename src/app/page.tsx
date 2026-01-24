"use client";

import { useSession } from "next-auth/react";
import { Dashboard } from "@/components/dashboard";
import { LandingHero } from "@/components/landing-hero";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (session) {
    return <Dashboard />;
  }

  return <LandingHero />;
}
