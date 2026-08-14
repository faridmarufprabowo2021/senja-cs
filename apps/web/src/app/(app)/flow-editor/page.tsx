"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyFlowEditorPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/flows");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-xs text-slate-400">
      Mengalihkan ke Flow Builder...
    </div>
  );
}
