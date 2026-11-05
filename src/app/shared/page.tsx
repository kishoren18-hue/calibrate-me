"use client";

import { useEffect, useState } from "react";

import { ResultView } from "@/components/result-view";
import { ButtonLink } from "@/components/ui";
import { decodeResult, type SharedResult } from "@/lib/share";

export default function SharedPage() {
  const [s, setS] = useState<SharedResult | null | undefined>(undefined);
  useEffect(() => {
    const h = location.hash;
    setS(h.startsWith("#r=") ? decodeResult(h.slice(3)) : null);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {s === undefined ? null : s === null ? (
        <p className="text-muted">This share link is invalid or incomplete.</p>
      ) : (
        <ResultView s={s} title="A shared result" />
      )}
      <ButtonLink href="/" className="mt-8">
        Can you beat it? Play now
      </ButtonLink>
    </main>
  );
}
