import { JoinFlow } from "./join-flow";

export const metadata = { title: "Join a class" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <JoinFlow initialCode={(code ?? "").toUpperCase().slice(0, 6)} />
    </main>
  );
}
