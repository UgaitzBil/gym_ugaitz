import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  CalendarDays,
  Dumbbell,
  LoaderCircle,
  LogOut,
  Mail,
  Target,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Tab = 'train' | 'calendar' | 'bilbo'

const tabs: Array<{
  id: Tab
  label: string
  icon: typeof Dumbbell
}> = [
  { id: 'train', label: 'Entrenar', icon: Dumbbell },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'bilbo', label: 'Bilbo', icon: Target },
]

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
    }
    setIsSubmitting(false)
  }

  const handleMagicLink = async () => {
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Introduce tu email.')
      return
    }

    setIsSubmitting(true)
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    if (magicLinkError) {
      setError(magicLinkError.message)
    } else {
      setMessage('Revisa tu email. Hemos enviado el enlace de acceso.')
    }
    setIsSubmitting(false)
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-10 text-zinc-100">
      <section className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/15 text-purple-400">
            <Dumbbell size={32} strokeWidth={2.25} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-purple-400">
            Método Bilbo
          </p>
          <h1 className="text-3xl font-black tracking-tight">Accede a tu cuenta</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-14 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-base text-zinc-100 outline-none transition focus:border-purple-400"
              placeholder="tu@email.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-14 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-base text-zinc-100 outline-none transition focus:border-purple-400"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-purple-500 px-4 text-base font-bold text-white disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle className="animate-spin" size={22} /> : 'Entrar'}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleMagicLink}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-base font-bold text-zinc-100 disabled:opacity-60"
          >
            <Mail size={20} />
            Enviar Magic Link
          </button>
        </form>
      </section>
    </main>
  )
}

function AppShell({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<Tab>('train')
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signOut = async () => {
    setIsSigningOut(true)
    await supabase.auth.signOut()
  }

  const tabTitles: Record<Tab, string> = {
    train: 'Entrenar',
    calendar: 'Calendario',
    bilbo: 'Bilbo',
  }

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-900 bg-zinc-950/95 px-4 backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-400">Método Bilbo</p>
          <h1 className="text-lg font-black">{tabTitles[activeTab]}</h1>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={isSigningOut}
          aria-label="Cerrar sesión"
          title={`Cerrar sesión (${user.email ?? 'usuario'})`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 disabled:opacity-50"
        >
          {isSigningOut ? <LoaderCircle className="animate-spin" size={20} /> : <LogOut size={20} />}
        </button>
      </header>

      <main className="px-4 pb-28 pt-5">
        <div className="mx-auto max-w-lg">
          {activeTab === 'train' && (
            <EmptyScreen icon={Dumbbell} title="Tu sesión activa" text="Aquí podremos iniciar y registrar tus entrenamientos." />
          )}
          {activeTab === 'calendar' && (
            <EmptyScreen icon={CalendarDays} title="Histórico" text="Aquí aparecerá el calendario de entrenamientos." />
          )}
          {activeTab === 'bilbo' && (
            <EmptyScreen icon={Target} title="Ciclos Bilbo" text="Aquí gestionaremos ciclos y progresiones." />
          )}
        </div>
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ${
                  isActive ? 'text-purple-400' : 'text-zinc-500'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function EmptyScreen({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Dumbbell
  title: string
  text: string
}) {
  return (
    <section className="mt-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
        <Icon size={26} />
      </div>
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">{text}</p>
    </section>
  )
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setUser(data.session?.user ?? null)
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-zinc-950 text-purple-400">
        <LoaderCircle className="animate-spin" size={32} />
      </main>
    )
  }

  return user ? <AppShell user={user} /> : <LoginScreen />
}

export default App
