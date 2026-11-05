"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Input } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/client";

export function NewClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: err } = await getBrowserClient()!.rpc("cm_create_class", { p_name: name });
    setBusy(false);
    if (err) return setError(err.message);
    router.push(`/teach/${(data as { id: string }).id}`);
  }

  return (
    <form onSubmit={create} className="mt-6 flex flex-wrap gap-2">
      <label htmlFor="cname" className="sr-only">
        Class name
      </label>
      <Input id="cname" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Period 3 Biology" className="min-w-56 flex-1" />
      <Button type="submit" loading={busy} disabled={!name.trim()}>
        Create class
      </Button>
      {error && <Alert tone="danger" className="w-full">{error}</Alert>}
    </form>
  );
}
