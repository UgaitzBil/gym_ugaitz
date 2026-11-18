import { Dumbbell } from 'lucide-react'

function App() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 text-zinc-100">
      <section className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400">
          <Dumbbell size={32} strokeWidth={2.25} />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-purple-400">
          Método Bilbo
        </p>
        <h1 className="text-3xl font-black tracking-tight">Base PWA preparada</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Proyecto React, Tailwind, Supabase y modo offline configurados.
        </p>
      </section>
    </main>
  )
}

export default App
