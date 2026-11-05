"use client";

import { useState } from "react";

import { Game } from "@/components/game";
import { Alert, Button, Input, Label } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/client";

export function JoinFlow({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState("");
  const [className, setClassName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = getBrowserClient();

  if (className) {
    return <Game classCode={code} className={className} nickname={nickname.trim()} />;
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("cm_class_name", { p_code: code });
    setBusy(false);
    if (err) return setError("Couldn't reach the server. Try again.");
    if (!data) return setError("No class has that code. Check it with your teacher.");
    setClassName(data as string);
  }

  return (
    <div className="max-w-md">
      <h1 className="font-serif text-4xl font-semibold">Join a class</h1>
      <p className="mt-2 text-muted">Enter the code your teacher shared. You don&apos;t need an account or an email.</p>
      {!supabase ? (
        <Alert tone="warn" className="mt-6">
          Classes aren&apos;t set up on this deployment yet. You can still play on your own from the home page.
        </Alert>
      ) : (
        <form onSubmit={join} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="code">Class code</Label>
            <Input
              id="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC234"
              autoComplete="off"
              className="font-mono text-lg tracking-[0.3em]"
              pattern="[A-Z0-9]{6}"
            />
          </div>
          <div>
            <Label htmlFor="nick">Nickname</Label>
            <Input id="nick" required maxLength={24} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="First name or initials" autoComplete="off" />
            <p className="mt-1 text-xs text-muted">Your teacher sees this with your scores. Please don&apos;t use your full name.</p>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" loading={busy} disabled={code.length !== 6 || !nickname.trim()}>
            Join
          </Button>
        </form>
      )}
    </div>
  );
}
