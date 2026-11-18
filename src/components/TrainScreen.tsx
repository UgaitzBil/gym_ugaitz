import { useEffect, useRef, useState } from 'react'
import type { Database } from '../types/database'
import { supabase } from '../lib/supabase'
import {
  Check,
  ChevronDown,
  Clock3,
  Dumbbell,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

type Exercise = Database['public']['Tables']['exercises']['Row']

interface ActiveSet {
  id: string
  exerciseId: string
  exerciseName: string
  weight: number
  reps: number
  rir: number | null
  notes: string
  isBilboSet: boolean
  setOrder: number
  saved: boolean
  serverId?: string
}

interface SessionDraft {
  workoutId: string | null
  workoutDate: string
  title: string
  notes: string
  sets: ActiveSet[]
  startedAt: string
}

const DRAFT_PREFIX = 'bilbo-active-session'

function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function TrainScreen({ userId }: { userId: string }) {
  const storageKey = `${DRAFT_PREFIX}-${userId}`
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [weight, setWeight] = useState('20')
  const [reps, setReps] = useState('10')
  const [rir, setRir] = useState('')
  const [setNotes, setSetNotes] = useState('')
  const [isBilboSet, setIsBilboSet] = useState(false)
  const [lastSet, setLastSet] = useState<Database['public']['Tables']['sets']['Row'] | null>(null)
  const [isLoadingExercises, setIsLoadingExercises] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [isSavingSet, setIsSavingSet] = useState(false)
  const [isCreatingExercise, setIsCreatingExercise] = useState(false)
  const [isExercisePanelOpen, setIsExercisePanelOpen] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseGroup, setNewExerciseGroup] = useState('')
  const [newExerciseBilbo, setNewExerciseBilbo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [session, setSession] = useState<SessionDraft | null>(null)
  const [timerDuration, setTimerDuration] = useState(() => Number(localStorage.getItem('bilbo-rest-duration') || 90))
  const [timerRemaining, setTimerRemaining] = useState(0)
  const timerStartedAt = useRef<number | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setSession(JSON.parse(saved) as SessionDraft)
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  }, [storageKey])

  useEffect(() => {
    if (session) {
      localStorage.setItem(storageKey, JSON.stringify(session))
    }
  }, [session, storageKey])

  useEffect(() => {
    const loadExercises = async () => {
      setIsLoadingExercises(true)
      const { data, error: loadError } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId)
        .order('name')

      if (loadError) {
        setError(loadError.message)
      } else {
        setExercises(data ?? [])
      }
      setIsLoadingExercises(false)
    }
    void loadExercises()
  }, [userId])

  useEffect(() => {
    if (timerRemaining <= 0) return

    const interval = window.setInterval(() => {
      if (timerStartedAt.current === null) return
      const elapsed = Math.floor((Date.now() - timerStartedAt.current) / 1000)
      const remaining = Math.max(timerDuration - elapsed, 0)
      setTimerRemaining(remaining)

      if (remaining === 0) {
        window.clearInterval(interval)
        timerStartedAt.current = null
        navigator.vibrate?.([180, 80, 180])
      }
    }, 250)

    return () => window.clearInterval(interval)
  }, [timerDuration, timerRemaining > 0])

  const startSession = async (date = todayIso()) => {
    setError('')
    setSuccess('')
    setIsStarting(true)
    const title = `Entrenamiento ${new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${date}T12:00:00`))}`

    const { data, error: createError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        workout_date: date,
        title,
        notes: null,
        duration_minutes: null,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setIsStarting(false)
      return
    }

    setSession({
      workoutId: data.id,
      workoutDate: date,
      title: data.title,
      notes: '',
      sets: [],
      startedAt: new Date().toISOString(),
    })
    setIsStarting(false)
  }

  const endSession = async () => {
    if (!session) return
    setError('')
    setIsStarting(true)

    const unsavedSets = session.sets.filter((set) => !set.saved)
    if (session.workoutId) {
      for (const set of unsavedSets) {
        const { error: saveError } = await supabase.from('sets').insert({
          user_id: userId,
          workout_id: session.workoutId,
          exercise_id: set.exerciseId,
          bilbo_cycle_id: null,
          set_order: set.setOrder,
          weight_kg: set.weight,
          reps: set.reps,
          rir: set.rir,
          is_bilbo_set: set.isBilboSet,
          notes: set.notes || null,
        })
        if (saveError) {
          setError(saveError.message)
          setIsStarting(false)
          return
        }
      }
    }

    const elapsedMinutes = Math.max(
      1,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60_000),
    )

    if (session.workoutId) {
      await supabase
        .from('workouts')
        .update({
          title: session.title,
          notes: session.notes || null,
          duration_minutes: elapsedMinutes,
        })
        .eq('id', session.workoutId)
    }

    localStorage.removeItem(storageKey)
    setSession(null)
    setSelectedExercise(null)
    setSuccess('Entrenamiento guardado.')
    setIsStarting(false)
  }

  const selectExercise = async (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setIsExercisePanelOpen(false)
    setExerciseSearch('')
    setError('')
    setLastSet(null)

    const { data, error: loadError } = await supabase
      .from('sets')
      .select('*')
      .eq('exercise_id', exercise.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (loadError) {
      setError(loadError.message)
      return
    }

    setLastSet(data)
    if (data) {
      setWeight(String(data.weight_kg))
      setReps(String(data.reps))
      setRir(data.rir === null ? '' : String(data.rir))
      setSetNotes(data.notes ?? '')
    }
  }

  const createExercise = async () => {
    if (!newExerciseName.trim()) {
      setError('Escribe el nombre del ejercicio.')
      return
    }

    setError('')
    setIsCreatingExercise(true)
    const { data, error: createError } = await supabase
      .from('exercises')
      .insert({
        user_id: userId,
        name: newExerciseName.trim(),
        muscle_group: newExerciseGroup.trim() || 'Otro',
        supports_bilbo: newExerciseBilbo,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setIsCreatingExercise(false)
      return
    }

    setExercises((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewExerciseName('')
    setNewExerciseGroup('')
    setNewExerciseBilbo(false)
    setIsCreatingExercise(false)
    setSuccess('Ejercicio creado.')
    await selectExercise(data)
  }

  const confirmSet = async () => {
    if (!session || !selectedExercise) {
      setError('Selecciona un ejercicio.')
      return
    }

    const parsedWeight = Number(weight)
    const parsedReps = Number(reps)
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || !Number.isInteger(parsedReps) || parsedReps < 1) {
      setError('Introduce peso y repeticiones válidos.')
      return
    }

    setError('')
    setSuccess('')
    setIsSavingSet(true)
    const setOrder =
      session.sets.filter((set) => set.exerciseId === selectedExercise.id).length + 1
    const draftSet: ActiveSet = {
      id: crypto.randomUUID(),
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      weight: parsedWeight,
      reps: parsedReps,
      rir: rir === '' ? null : Number(rir),
      notes: setNotes.trim(),
      isBilboSet,
      setOrder,
      saved: false,
    }

    if (session.workoutId) {
      const { data: savedSet, error: saveError } = await supabase.from('sets').insert({
        user_id: userId,
        workout_id: session.workoutId,
        exercise_id: selectedExercise.id,
        bilbo_cycle_id: null,
        set_order: setOrder,
        weight_kg: parsedWeight,
        reps: parsedReps,
        rir: rir === '' ? null : Number(rir),
        is_bilbo_set: isBilboSet,
        notes: setNotes.trim() || null,
      }).select('id').single()

      if (saveError) {
        setError(`La serie quedó guardada solo en el borrador: ${saveError.message}`)
      } else {
        draftSet.saved = true
        draftSet.serverId = savedSet.id
        setSuccess('Serie registrada.')
      }
    }

    setSession((current) =>
      current ? { ...current, sets: [...current.sets, draftSet] } : current,
    )
    setLastSet({
      id: draftSet.id,
      user_id: userId,
      workout_id: session.workoutId ?? '',
      exercise_id: draftSet.exerciseId,
      bilbo_cycle_id: null,
      set_order: setOrder,
      weight_kg: parsedWeight,
      reps: parsedReps,
      rir: draftSet.rir,
      is_bilbo_set: isBilboSet,
      notes: setNotes.trim() || null,
      created_at: new Date().toISOString(),
    })

    timerStartedAt.current = Date.now()
    setTimerRemaining(timerDuration)
    setIsSavingSet(false)
  }

  const removeSet = async (setId: string) => {
    const setToRemove = session?.sets.find((set) => set.id === setId)
    if (setToRemove?.serverId) {
      const { error: deleteError } = await supabase
        .from('sets')
        .delete()
        .eq('id', setToRemove.serverId)
        .eq('user_id', userId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }
    }
    setSession((current) =>
      current
        ? { ...current, sets: current.sets.filter((set) => set.id !== setId) }
        : current,
    )
  }

  const changeRestDuration = (seconds: number) => {
    setTimerDuration(seconds)
    localStorage.setItem('bilbo-rest-duration', String(seconds))
    if (timerRemaining > 0) {
      timerStartedAt.current = Date.now()
      setTimerRemaining(seconds)
    }
  }

  const startTimer = () => {
    timerStartedAt.current = Date.now()
    setTimerRemaining(timerDuration)
  }

  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(exerciseSearch.toLowerCase()),
  )

  if (!session) {
    return (
      <section className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </p>
        )}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
            <Dumbbell size={24} />
          </div>
          <h2 className="text-2xl font-black">Nueva sesión</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Puedes empezar hoy o elegir otra fecha.
          </p>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-zinc-300">Fecha</span>
            <input
              id="workout-date"
              type="date"
              defaultValue={todayIso()}
              className="h-14 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-100"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const date = (document.getElementById('workout-date') as HTMLInputElement | null)?.value
              void startSession(date || todayIso())
            }}
            disabled={isStarting}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-purple-500 text-base font-bold text-white disabled:opacity-60"
          >
            {isStarting ? <LoaderCircle className="animate-spin" size={22} /> : <Plus size={22} />}
            Iniciar entreno
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input
            value={session.title}
            onChange={(event) => setSession({ ...session, title: event.target.value })}
            aria-label="Título del entrenamiento"
            className="h-12 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-base font-bold text-zinc-100"
          />
          <div className="flex h-12 items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-400">
            {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
              new Date(`${session.workoutDate}T12:00:00`),
            )}
          </div>
        </div>
        <textarea
          value={session.notes}
          onChange={(event) => setSession({ ...session, notes: event.target.value })}
          rows={2}
          placeholder="Notas generales del entreno..."
          className="mt-3 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100"
        />
      </div>

      <button
        type="button"
        onClick={() => setIsExercisePanelOpen(true)}
        className="flex h-16 w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
            <Dumbbell size={20} />
          </div>
          <div>
            <p className="text-sm font-bold">{selectedExercise?.name ?? 'Añadir ejercicio'}</p>
            {selectedExercise && (
              <p className="mt-0.5 text-xs text-zinc-500">{selectedExercise.muscle_group}</p>
            )}
          </div>
        </div>
        <ChevronDown size={20} className="text-zinc-500" />
      </button>

      {selectedExercise && (
        <div className="space-y-4">
          {lastSet && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Última serie</p>
              <p className="mt-1 text-sm font-bold text-zinc-200">
                {lastSet.weight_kg} kg × {lastSet.reps} reps
                {lastSet.rir !== null ? ` · RIR ${lastSet.rir}` : ''}
              </p>
              {lastSet.notes && (
                <p className="mt-1 text-xs text-zinc-500">Nota anterior: {lastSet.notes}</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">Peso kg</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1.25"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  className="h-16 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-center text-2xl font-black"
                />
              </label>
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">Repeticiones</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={reps}
                  onChange={(event) => setReps(event.target.value)}
                  className="h-16 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-center text-2xl font-black"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWeight(String(Math.max(0, (Number(weight) || 0) - 2.5)))}
                className="h-12 rounded-xl border border-zinc-700 text-base font-bold"
              >
                −2.5 kg
              </button>
              <button
                type="button"
                onClick={() => setWeight(String((Number(weight) || 0) + 2.5))}
                className="h-12 rounded-xl border border-zinc-700 text-base font-bold"
              >
                +2.5 kg
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[0.7fr_1.3fr] gap-3">
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">RIR</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="10"
                  value={rir}
                  onChange={(event) => setRir(event.target.value)}
                  placeholder="0"
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
                />
              </label>
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">Nota de serie</span>
                <input
                  value={setNotes}
                  onChange={(event) => setSetNotes(event.target.value)}
                  placeholder="Ej. polea altura 8"
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
                />
              </label>
            </div>

            <label className="mt-4 flex h-12 items-center gap-3 rounded-xl border border-zinc-800 px-3">
              <input
                type="checkbox"
                checked={isBilboSet}
                onChange={(event) => setIsBilboSet(event.target.checked)}
                className="h-5 w-5 accent-purple-500"
              />
              <span className="text-sm font-bold">Serie Bilbo</span>
            </label>

            <button
              type="button"
              onClick={confirmSet}
              disabled={isSavingSet}
              className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-purple-500 text-base font-black text-white disabled:opacity-60"
            >
              {isSavingSet ? <LoaderCircle className="animate-spin" size={22} /> : <Check size={22} />}
              Confirmar serie
            </button>
          </div>
        </div>
      )}

      {session.sets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Series registradas</p>
          {session.sets.map((set, index) => (
            <div
              key={set.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{set.exerciseName}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Serie {set.setOrder}: {set.weight} kg × {set.reps}
                  {set.rir !== null ? ` · RIR ${set.rir}` : ''}
                  {!set.saved ? ' · solo borrador' : ''}
                </p>
                {set.notes && <p className="mt-0.5 truncate text-xs text-zinc-500">{set.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeSet(set.id)}
                aria-label="Eliminar serie"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={endSession}
        disabled={isStarting}
        className="flex h-14 w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-base font-bold disabled:opacity-60"
      >
        {isStarting ? <LoaderCircle className="animate-spin" size={22} /> : 'Terminar entreno'}
      </button>

      {isExercisePanelOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="dialog" aria-modal="true">
          <div className="max-h-[88svh] w-full overflow-y-auto rounded-t-3xl border-t border-zinc-800 bg-zinc-950 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-zinc-700" />
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Ejercicios</h2>
              <button
                type="button"
                onClick={() => setIsExercisePanelOpen(false)}
                aria-label="Cerrar"
                className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-400"
              >
                <X size={22} />
              </button>
            </div>

            <label className="mt-4 flex h-14 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3">
              <Search size={20} className="text-zinc-500" />
              <input
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                placeholder="Buscar ejercicio..."
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>

            <div className="mt-3 space-y-2">
              {isLoadingExercises ? (
                <div className="flex justify-center py-8 text-purple-400">
                  <LoaderCircle className="animate-spin" size={28} />
                </div>
              ) : (
                filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => void selectExercise(exercise)}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-bold">{exercise.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{exercise.muscle_group}</p>
                    </div>
                    {exercise.supports_bilbo && (
                      <span className="rounded-full bg-purple-500/15 px-2 py-1 text-[10px] font-bold text-purple-400">
                        Bilbo
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 p-4">
              <p className="text-sm font-black">Crear ejercicio propio</p>
              <input
                value={newExerciseName}
                onChange={(event) => setNewExerciseName(event.target.value)}
                placeholder="Nombre"
                className="mt-3 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3"
              />
              <input
                value={newExerciseGroup}
                onChange={(event) => setNewExerciseGroup(event.target.value)}
                placeholder="Grupo muscular"
                className="mt-3 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3"
              />
              <label className="mt-3 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={newExerciseBilbo}
                  onChange={(event) => setNewExerciseBilbo(event.target.checked)}
                  className="h-5 w-5 accent-purple-500"
                />
                Compatible con Bilbo
              </label>
              <button
                type="button"
                onClick={createExercise}
                disabled={isCreatingExercise}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10 text-sm font-bold text-purple-300 disabled:opacity-60"
              >
                {isCreatingExercise ? <LoaderCircle className="animate-spin" size={20} /> : 'Crear ejercicio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {timerRemaining > 0 ? (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-purple-400/30 bg-zinc-900 px-3 py-2 shadow-2xl">
          <Clock3 size={18} className="text-purple-400" />
          <span className="min-w-12 text-center text-base font-black tabular-nums">
            {String(Math.floor(timerRemaining / 60)).padStart(2, '0')}:
            {String(timerRemaining % 60).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setTimerRemaining(0)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500"
            aria-label="Cerrar temporizador"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startTimer}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold shadow-2xl"
        >
          <Clock3 size={18} className="text-purple-400" />
          {timerDuration}s
        </button>
      )}

      <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 z-40">
        <select
          aria-label="Duración del descanso"
          value={timerDuration}
          onChange={(event) => changeRestDuration(Number(event.target.value))}
          className="h-10 rounded-full border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold"
        >
          <option value={90}>90 segundos</option>
          <option value={120}>120 segundos</option>
          <option value={180}>180 segundos</option>
        </select>
      </div>
    </section>
  )
}
