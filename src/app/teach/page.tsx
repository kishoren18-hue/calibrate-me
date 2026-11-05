import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui";
import { supabaseConfigured } from "@/lib/supabase/env";
import { getServerClient, getUser } from "@/lib/supabase/server";

import { NewClassForm } from "./new-class-form";

export const metadata = { title: "For teachers" };
export const dynamic = "force-dynamic";

type ClassRow = { id: string; name: string; code: string; created_at: string; cm_sessions: { count: number }[] };

export default async function TeachPage() {
  if (!supabaseConfigured) redirect("/login?next=/teach");
  const user = await getUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl font-semibold">Use it with a class</h1>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-lg">
          <li>Create a class and get a 6-character code.</li>
          <li>Students join with the code and a nickname. No student accounts or emails.</li>
          <li>Watch results arrive live: each student&apos;s calibration, the class curve, and the questions that fooled the most people.</li>
        </ul>
        <Link href="/login?next=/teach" className="mt-8 inline-block rounded-lg bg-accent px-5 py-3 font-medium text-accent-ink">
          Sign in to create a class
        </Link>
      </main>
    );
  }
  const supabase = (await getServerClient())!;
  const { data } = await supabase
    .from("cm_classes")
    .select("id,name,code,created_at,cm_sessions(count)")
    .order("created_at", { ascending: false });
  const classes = (data ?? []) as ClassRow[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">Your classes</h1>
      <NewClassForm />
      {classes.length === 0 ? (
        <p className="mt-8 text-muted">No classes yet. Create one above, then share its code with students.</p>
      ) : (
        <div className="mt-8 grid gap-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/teach/${c.id}`}>
              <Card className="flex items-center gap-4 hover:border-ink">
                <span className="rounded-md bg-surface-2 px-2.5 py-1 font-mono tracking-[0.2em]">{c.code}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                <span className="text-sm text-muted">{c.cm_sessions?.[0]?.count ?? 0} rounds played</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
