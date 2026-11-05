"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/client";

export function ClassControls({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="rounded-xl border border-line bg-surface px-4 py-2 text-center">
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted">Class code</div>
        <div className="font-mono text-2xl font-semibold tracking-[0.25em]">{code}</div>
      </div>
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(`${location.origin}/join?code=${code}`).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy join link"}
      </Button>
      {confirming ? (
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await getBrowserClient()?.from("cm_classes").delete().eq("id", id);
            router.push("/teach");
            router.refresh();
          }}
        >
          Delete class and all results
        </Button>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}
    </div>
  );
}

export function SessionDelete({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="text-xs text-muted underline hover:text-danger disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await getBrowserClient()?.from("cm_sessions").delete().eq("id", id);
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
