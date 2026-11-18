import { useEffect, useMemo, useState } from 'react'
import type { Database } from '../types/database'
import { supabase } from '../lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  LoaderCircle,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

type Workout = Database['public']['Tables']['workouts']['Row']
type SetRow = Database['public']['Tables']['sets']['Row']
type Exercise = Database['public']['Tables']['exercises']['Row']

interface WorkoutWithSets extends Workout {
  sets: SetRow[]
  hasBilbo: boolean
}

function isoToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function CalendarScreen({ userId }: { userId: string }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([])
  const [exercises, setExercises] = useState<Record<string, Exercise>>({})
  const [selectedDate, setSelectedDate] = useState(isoToday())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingSet, setEditingSet] = useState<SetRow | null>(null)
  const [editWorkout, setEditWorkout] = useState(false)

  const reloadMonth = async () => {
    setLoading(true)
    setError('')

    const from = isoDate(month.getFullYear(), month.getMonth(), 1)
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const to = isoDate(month.getFullYear(), month.getMonth(), lastDay)

    const { data: monthWorkouts, error: workoutError } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .gte('workout_date', from)
      .lte('workout_date', to)
      .order('workout_date', { ascending: false })

    if (workoutError) {
      setError(workoutError.message)
      setLoading(false)
      return
    }

    const rows = monthWorkouts ?? []
    const workoutIds = rows.map((workout) => workout.id)
    let setRows: SetRow[] = []
    let exerciseRows: Exercise[] = []

    if (workoutIds.length > 0) {
      const [
        { data: loadedSets, error: setQueryError },
        { data: loadedExercises, error: exerciseQueryError },
      ] =
        await Promise.all([
          supabase
            .from('sets')
            .select('*')
            .eq('user_id', userId)
            .in('workout_id', workoutIds)
            .order('set_order'),
          supabase.from('exercises').select('*').eq('user_id', userId),
        ])

      if (setQueryError) {
        setError(setQueryError.message)
      } else {
        setRows = loadedSets ?? []
      }
      if (exerciseQueryError) {
        setError(exerciseQueryError.message)
      } else {
        exerciseRows = loadedExercises ?? []
      }
    }

    setExercises(
      Object.fromEntries(exerciseRows.map((exercise) => [exercise.id, exercise])) as Record<
        string,
        Exercise
      >,
    )

    setWorkouts(
      rows.map((workout) => {
        const workoutSets = setRows.filter((set) => set.workout_id === workout.id)
        return {
          ...workout,
          sets: workoutSets,
          hasBilbo: workoutSets.some((set) => set.is_bilbo_set),
        }
      }),
    )
    setLoading(false)
  }

  useEffect(() => {
    void reloadMonth()
  }, [month, userId])

  const firstWeekdayMonday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; date: string } | null> = []
    for (let i = 0; i < firstWeekdayMonday; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, date: isoDate(month.getFullYear(), month.getMonth(), day) })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [month, firstWeekdayMonday, daysInMonth])

  const workoutsByDate = useMemo(
    () => Object.fromEntries(workouts.map((workout) => [workout.workout_date, workout])) as Record<
      string,
      WorkoutWithSets
    >,
    [workouts],
  )

  const selectedWorkout = workoutsByDate[selectedDate] ?? null

  const dayTonnage = selectedWorkout
    ? selectedWorkout.sets.reduce((total, set) => total + set.weight_kg * set.reps, 0)
    : 0

  const exerciseGroups = useMemo(() => {
    if (!selectedWorkout) return []
    const groups: Array<{ exercise: Exercise | null; sets: SetRow[] }> = []
    for (const set of selectedWorkout.sets) {
      let group = groups.find((item) => item.sets[0]?.exercise_id === set.exercise_id)
      if (!group) {
        group = { exercise: exercises[set.exercise_id] ?? null, sets: [] }
        groups.push(group)
      }
      group.sets.push(set)
    }
    return groups
  }, [selectedWorkout, exercises])

  const changeMonth = (direction: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  }

  const updateSet = async () => {
    if (!editingSet) return
    setBusy(true)
    setError('')

    const parsedWeight = Number(editingSet.weight_kg)
    const parsedReps = Number(editingSet.reps)
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || !Number.isInteger(parsedReps) || parsedReps < 1) {
      setError('Introduce peso y repeticiones válidos.')
      setBusy(false)
      return
    }

    const { error: updateError } = await supabase
      .from('sets')
      .update({
        weight_kg: parsedWeight,
        reps: parsedReps,
        rir: editingSet.rir,
        is_bilbo_set: editingSet.is_bilbo_set,
        notes: editingSet.notes,
      })
      .eq('id', editingSet.id)
      .eq('user_id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Serie actualizada.')
      setEditingSet(null)
      await reloadMonth()
    }
    setBusy(false)
  }

  const deleteSet = async (setId: string) => {
    setBusy(true)
    setError('')
    const { error: deleteError } = await supabase
      .from('sets')
      .delete()
      .eq('id', setId)
      .eq('user_id', userId)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      setSuccess('Serie eliminada.')
      await reloadMonth()
    }
    setBusy(false)
  }

  const saveWorkout = async () => {
    if (!selectedWorkout) return
    setBusy(true)
    setError('')
    const { error: updateError } = await supabase
      .from('workouts')
      .update({
        title: selectedWorkout.title,
        notes: selectedWorkout.notes,
        duration_minutes: selectedWorkout.duration_minutes,
      })
      .eq('id', selectedWorkout.id)
      .eq('user_id', userId)
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Entrenamiento actualizado.')
      setEditWorkout(false)
      await reloadMonth()
    }
    setBusy(false)
  }

  const deleteWorkout = async () => {
    if (!selectedWorkout) return
    setBusy(true)
    setError('')
    const { error: setsDeleteError } = await supabase
      .from('sets')
      .delete()
      .eq('workout_id', selectedWorkout.id)
      .eq('user_id', userId)
    if (setsDeleteError) {
      setError(setsDeleteError.message)
      setBusy(false)
      return
    }
    const { error: deleteError } = await supabase
      .from('workouts')
      .delete()
      .eq('id', selectedWorkout.id)
      .eq('user_id', userId)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      setSuccess('Entrenamiento eliminado.')
      await reloadMonth()
    }
    setBusy(false)
  }

  const repeatToday = async () => {
    if (!selectedWorkout) return
    setBusy(true)
    setError('')
    setSuccess('')

    const today = isoToday()
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        workout_date: today,
        title: selectedWorkout.title,
        notes: selectedWorkout.notes,
        duration_minutes: null,
      })
      .select()
      .single()

    if (workoutError) {
      setError(workoutError.message)
      setBusy(false)
      return
    }

    if (selectedWorkout.sets.length > 0) {
      const clonedSets = selectedWorkout.sets.map((set) => ({
        user_id: userId,
        workout_id: workout.id,
        exercise_id: set.exercise_id,
        bilbo_cycle_id: null,
        set_order: set.set_order,
        weight_kg: set.weight_kg,
        reps: set.reps,
        rir: set.rir,
        is_bilbo_set: set.is_bilbo_set,
        notes: set.notes,
      }))
      const { error: setsError } = await supabase.from('sets').insert(clonedSets)
      if (setsError) {
        setError(`Entrenamiento creado, pero no pudieron clonarse las series: ${setsError.message}`)
        setBusy(false)
        return
      }
    }

    setMonth(new Date())
    setSelectedDate(today)
    setSuccess('Entrenamiento repetido para hoy.')
    await reloadMonth()
    setBusy(false)
  }

  const monthLabel = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(month)

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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="mb-3 flex h-12 items-center justify-between px-1">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Mes anterior"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-base font-black capitalize">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex h-72 items-center justify-center text-purple-400">
            <LoaderCircle className="animate-spin" size={28} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 text-center">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => (
                <div key={label} className="pb-2 text-[11px] font-bold text-zinc-600">
                  {label}
                </div>
              ))}
              {calendarCells.map((cell, index) => {
                if (!cell) return <div key={`empty-${index}`} className="aspect-square" />
                const workout = workoutsByDate[cell.date]
                const selected = selectedDate === cell.date
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    className={`relative aspect-square rounded-xl text-sm font-bold transition ${
                      selected
                        ? 'bg-purple-500 text-white'
                        : cell.date === isoToday()
                          ? 'border border-zinc-600 text-zinc-100'
                          : 'text-zinc-300'
                    }`}
                  >
                    {cell.day}
                    {workout && (
                      <span
                        className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                          workout.hasBilbo ? 'bg-fuchsia-400' : 'bg-emerald-400'
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex justify-center gap-5 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Entreno
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-fuchsia-400" /> Serie Bilbo
              </span>
            </div>
          </>
        )}
      </div>

      {selectedWorkout ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            {editWorkout ? (
              <div className="space-y-3">
                <input
                  value={selectedWorkout.title}
                  onChange={(event) =>
                    setWorkouts((current) =>
                      current.map((workout) =>
                        workout.id === selectedWorkout.id
                          ? { ...workout, title: event.target.value }
                          : workout,
                      ),
                    )
                  }
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 font-bold"
                />
                <textarea
                  value={selectedWorkout.notes ?? ''}
                  onChange={(event) =>
                    setWorkouts((current) =>
                      current.map((workout) =>
                        workout.id === selectedWorkout.id
                          ? { ...workout, notes: event.target.value }
                          : workout,
                      ),
                    )
                  }
                  rows={2}
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedWorkout.duration_minutes ?? ''}
                  onChange={(event) =>
                    setWorkouts((current) =>
                      current.map((workout) =>
                        workout.id === selectedWorkout.id
                          ? {
                              ...workout,
                              duration_minutes: event.target.value === '' ? null : Number(event.target.value),
                            }
                          : workout,
                      ),
                    )
                  }
                  placeholder="Duración en minutos"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditWorkout(false)}
                    className="h-12 rounded-xl border border-zinc-700 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveWorkout}
                    disabled={busy}
                    className="h-12 rounded-xl bg-purple-500 font-bold text-white"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(
                        new Date(`${selectedDate}T12:00:00`),
                      )}
                    </p>
                    <h3 className="mt-1 text-xl font-black">{selectedWorkout.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditWorkout(true)}
                    aria-label="Editar entrenamiento"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400"
                  >
                    <Pencil size={17} />
                  </button>
                </div>
                {selectedWorkout.notes && (
                  <p className="mt-3 text-sm text-zinc-400">{selectedWorkout.notes}</p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-950 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-600">Duración</p>
                    <p className="mt-1 font-black">
                      {selectedWorkout.duration_minutes ? `${selectedWorkout.duration_minutes} min` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-600">Tonelaje</p>
                    <p className="mt-1 font-black">{dayTonnage.toLocaleString('es-ES')} kg</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            {exerciseGroups.map((group) => (
              <div key={group.sets[0].exercise_id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <h4 className="px-1 text-sm font-black">
                  {group.exercise?.name ?? 'Ejercicio eliminado'}
                </h4>
                <div className="mt-2 space-y-2">
                  {group.sets.map((set) => (
                    <div
                      key={set.id}
                      className={`flex items-center gap-2 rounded-xl px-3 py-3 ${
                        set.is_bilbo_set ? 'border border-fuchsia-500/20 bg-fuchsia-500/5' : 'bg-zinc-950'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">
                          Serie {set.set_order}: {set.weight_kg} kg × {set.reps}
                          {set.rir !== null ? ` · RIR ${set.rir}` : ''}
                        </p>
                        {set.notes && <p className="mt-1 truncate text-xs text-zinc-500">{set.notes}</p>}
                        {set.is_bilbo_set && (
                          <p className="mt-1 text-[10px] font-bold uppercase text-fuchsia-400">Serie Bilbo</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSet(set)}
                        aria-label="Editar serie"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSet(set.id)}
                        disabled={busy}
                        aria-label="Borrar serie"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={repeatToday}
            disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-purple-500 text-base font-bold text-white disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="animate-spin" size={21} /> : <Copy size={20} />}
            Repetir este entreno hoy
          </button>
          <button
            type="button"
            onClick={deleteWorkout}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-red-500/20 text-sm font-bold text-red-400 disabled:opacity-60"
          >
            Borrar entrenamiento
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center">
          <p className="text-sm font-bold text-zinc-500">
            {loading ? 'Consultando calendario...' : 'No hay entrenamientos este día'}
          </p>
        </div>
      )}

      {editingSet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="dialog" aria-modal="true">
          <div className="w-full rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-zinc-700" />
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Editar serie</h3>
              <button
                type="button"
                onClick={() => setEditingSet(null)}
                aria-label="Cerrar"
                className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-400"
              >
                <X size={22} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">Peso kg</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1.25"
                  value={editingSet.weight_kg}
                  onChange={(event) =>
                    setEditingSet({ ...editingSet, weight_kg: Number(event.target.value) })
                  }
                  className="h-14 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-center text-xl font-black"
                />
              </label>
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">Repeticiones</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={editingSet.reps}
                  onChange={(event) =>
                    setEditingSet({ ...editingSet, reps: Number(event.target.value) })
                  }
                  className="h-14 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-center text-xl font-black"
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-2 block text-xs font-bold text-zinc-400">RIR</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={editingSet.rir ?? ''}
                  onChange={(event) =>
                    setEditingSet({
                      ...editingSet,
                      rir: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3"
                />
              </label>
              <label className="flex h-12 items-end pb-1">
                <span className="flex h-12 w-full items-center gap-2 rounded-xl border border-zinc-800 px-3">
                  <input
                    type="checkbox"
                    checked={editingSet.is_bilbo_set}
                    onChange={(event) =>
                      setEditingSet({ ...editingSet, is_bilbo_set: event.target.checked })
                    }
                    className="h-5 w-5 accent-purple-500"
                  />
                  <span className="text-sm font-bold">Bilbo</span>
                </span>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-2 block text-xs font-bold text-zinc-400">Notas</span>
              <input
                value={editingSet.notes ?? ''}
                onChange={(event) =>
                  setEditingSet({ ...editingSet, notes: event.target.value || null })
                }
                placeholder="Ej. polea altura 8"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3"
              />
            </label>
            <button
              type="button"
              onClick={updateSet}
              disabled={busy}
              className="mt-4 flex h-14 w-full items-center justify-center rounded-xl bg-purple-500 text-base font-bold text-white disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="animate-spin" size={21} /> : 'Guardar serie'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
