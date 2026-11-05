import { Game } from "@/components/game";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-accent">A metacognition game</p>
      <h1 className="font-serif text-5xl font-semibold leading-[1.05] sm:text-6xl">
        Do you know
        <br />
        what you know?
      </h1>
      <p className="mt-5 max-w-2xl text-lg">
        Answer two-choice questions and say how sure you are each time. You don&apos;t need to get them all right. The goal is
        for your confidence to be <em>honest</em>: right about 70% of the time when you say 70%, and more confident on the
        answers you actually get right.
      </p>
      <p className="mb-8 mt-3 max-w-2xl text-muted">
        It uses the same measures cognitive scientists use to study confidence in people, and that AI researchers use to check
        whether a model knows when it&apos;s wrong.
      </p>
      <Game />
    </main>
  );
}
