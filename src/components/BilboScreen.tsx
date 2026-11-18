import { useEffect, useMemo, useState } from 'react'
import type { Database } from '../types/database'
import { supabase } from '../lib/supabase'
import {
  AlertTriangle,
  Calculator,
  Check,
  ChevronRight,
  LoaderCircle,
  Plus,
  Target,
} from 'lucide-react'

type Exercise = Database['public']['Tables']['exercises']['Row']
type BilboCycle = Database['public']['Tables']['bilbo_cycles']['Row']
type SetRow = Database['public']['Tables']['sets']['Row']

function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment
}

export function BilboScreen({ userId }: { userId: string }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [cycles, setCycles] = useState<BilboCycle[]>([])
  const [sets, setSets] = useState<SetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [manualOneRm, setManualOneRm] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rounding, setRounding] = useState<1.25 | 2.5>(2.5)
  const [increment, setIncrement] = useState('2.5')

  const [diskWeight, setDiskWeight] = useState('100')
  const [barWeight, setBarWeight] = useState('20')

  const loadData = async () => {
    setLoading(true)
    setError('')

    const [exerciseResult, cycleResult, setResult] = await Promise.all([
      supabase
        .from('exercises')
        .select('*')
        .eq('user_id', userId)
        .eq('supports_bilbo', true)
        .order('name'),
      supabase
        .from('bilbo_cycles')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false }),
      supabase
        .from('sets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_bilbo_set', true),
    ])

    if (exerciseResult.error) setError(exerciseResult.error.message)
    if (cycleResult.error) setError(cycleResult.error.message)
    if (setResult.error) setError(setResult.error.message)

    setExercises(exerciseResult.data ?? [])
    setCycles(cycleResult.data ?? [])
    setSets(setResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [userId])

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.is_active) ?? null,
    [cycles],
  )

  const activeExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === activeCycle?.exercise_id) ?? null,
    [activeCycle, exercises],
  )

  const estimatedOneRm = useMemo(() => {
    const enteredWeight = Number(weight)
    const enteredReps = Number(reps)
    if (!Number.isFinite(enteredWeight) || enteredWeight <= 0 ||
        !Number.isFinite(enteredReps) || enteredReps <= 0) {
      return null
    }
    return enteredWeight * (1 + enteredReps / 30)
  }, [weight, reps])

  const initialWeight = useMemo(() => {
    const currentOneRm = Number(manualOneRm) > 0
      ? Number(manualOneRm)
      : estimatedOneRm
    if (!currentOneRm) return null
    return roundToIncrement(currentOneRm * 0.5, rounding)
  }, [manualOneRm, estimatedOneRm, rounding])

  const createCycle = async () => {
    setError('')
    setSuccess('')
    if (!selectedExerciseId) {
      setError('Selecciona un ejercicio compatible.')
      return
    }
    if (!initialWeight) {
      setError('Introduce una 1RM o peso y repeticiones para estimarla.')
      return
    }
    const incrementValue = Number(increment)
    if (!Number.isFinite(incrementValue) || incrementValue <= 0) {
      setError('Introduce un incremento válido.')
      return
    }

    setBusy(true)
    const previousCycle = cycles
      .filter((cycle) => cycle.exercise_id === selectedExerciseId)
      .sort((a, b) => b.cycle_number - a.cycle_number)[0]

    if (activeCycle?.exercise_id === selectedExerciseId) {
      const { error: deactivateError } = await supabase
        .from('bilbo_cycles')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', activeCycle.id)
        .eq('user_id', userId)
      if (deactivateError) {
        setError(deactivateError.message)
        setBusy(false)
        return
      }
    }

    const currentOneRm = Number(manualOneRm) > 0 ? Number(manualOneRm) : estimatedOneRm
    if (!currentOneRm) {
      setBusy(false)
      return
    }

    const { error: createError } = await supabase.from('bilbo_cycles').insert({
      user_id: userId,
      exercise_id: selectedExerciseId,
      cycle_number: (previousCycle?.cycle_number ?? 0) + 1,
      estimated_1rm_start: currentOneRm,
      start_weight_kg: initialWeight,
      increment_kg: incrementValue,
      is_active: true,
      started_at: new Date().toISOString(),
      ended_at: null,
    })

    if (createError) {
      setError(createError.message)
    } else {
      setSuccess('Ciclo Bilbo creado.')
      setManualOneRm('')
      setWeight('')
      setReps('')
      await loadData()
    }
    setBusy(false)
  }

  const closeCycle = async () => {
    if (!activeCycle) return
    setBusy(true)
    setError('')
    const { error: closeError } = await supabase
      .from('bilbo_cycles')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', activeCycle.id)
      .eq('user_id', userId)
    if (closeError) {
      setError(closeError.message)
    } else {
      setSuccess('Ciclo cerrado.')
      await loadData()
    }
    setBusy(false)
  }

  const nextTarget = useMemo(() => {
    if (!activeCycle) return null
    const cycleSets = sets.filter((set) => set.bilbo_cycle_id === activeCycle.id)
    const completedSessions = new Set(cycleSets.map((set) => set.workout_id)).size
    return roundToIncrement(
      activeCycle.start_weight_kg + completedSessions * activeCycle.increment_kg,
      activeCycle.increment_kg,
    )
  }, [activeCycle, sets])

  const historicalRecord = useMemo(() => {
    if (!activeCycle || !nextTarget) return null
    const previousSets = sets
      .filter(
        (set) =>
          set.exercise_id === activeCycle.exercise_id &&
          set.weight_kg === nextTarget &&
          set.bilbo_cycle_id !== activeCycle.id &&
          set.bilbo_cycle_id !== null,
      )
      .sort((a, b) => b.reps - a.reps)
    return previousSets[0] ?? null
  }, [activeCycle, nextTarget, sets])

  const recentCycleSets = useMemo(() => {
    if (!activeCycle) return []
    return sets
      .filter((set) => set.bilbo_cycle_id === activeCycle.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [activeCycle, sets])

  const lowRepSet = recentCycleSets.find((set) => set.reps < 15) ?? null
  const lowRepOneRm = lowRepSet
    ? lowRepSet.weight_kg * (1 + lowRepSet.reps / 30)
    : null

  const diskResult = useMemo(() => {
    const total = Number(diskWeight)
    const bar = Number(barWeight)
    if (!Number.isFinite(total) || !Number.isFinite(bar) || total < bar) {
      return { remaining: 0, plates: [] as Array<{ weight: number; count: number }> }
    }
    let remaining = (total - bar) / 2
    const available = [20, 15, 10, 5, 2.5, 1.25]
    const plates: Array<{ weight: number; count: number }> = []
    for (const plate of available) {
      const count = Math.floor((remaining + 0.0001) / plate)
      if (count > 0) {
        plates.push({ weight: plate, count })
        remaining = Number((remaining - count * plate).toFixed(2))
      }
    }
    return { remaining, plates }
  }, [diskWeight, barWeight])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-purple-400">
        <LoaderCircle className="animate-spin" size={28} />
      </div>
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

      {activeCycle && (
        <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/15 to-zinc-900 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                Ciclo {activeCycle.cycle_number} activo
              </p>
              <h2 className="mt-1 text-xl font-black">{activeExercise?.name ?? 'Ejercicio Bilbo'}</h2>
            </div>
            <Target size={24} className="text-purple-400" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-950/70 px-3 py-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Próximo peso</p>
              <p className="mt-1 text-2xl font-black">{nextTarget?.toFixed(2).replace('.00', '')} kg</p>
            </div>
            <div className="rounded-xl bg-zinc-950/70 px-3 py-3">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Récord histórico</p>
              <p className="mt-1 text-2xl font-black">
                {historicalRecord ? `${historicalRecord.reps} reps` : 'Sin récord'}
              </p>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-400">
            Inicio: {activeCycle.start_weight_kg} kg · Incremento: +{activeCycle.increment_kg} kg
          </div>

          {historicalRecord && (
            <p className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm">
              Objetivo a batir: <strong>{historicalRecord.reps} repeticiones</strong> con el mismo peso.
            </p>
          )}

          {lowRepSet && lowRepOneRm && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex gap-2">
                <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-black text-amber-300">
                    Considera cerrar el ciclo
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-200/80">
                    Registraste {lowRepSet.reps} repeticiones con {lowRepSet.weight_kg} kg.
                    Nuevo 1RM estimado: {lowRepOneRm.toFixed(1)} kg.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(activeCycle.exercise_id)
                      setManualOneRm(lowRepOneRm.toFixed(1))
                      setWeight('')
                      setReps('')
                    }}
                    className="mt-3 h-10 rounded-lg bg-amber-400 px-3 text-xs font-black text-zinc-950"
                  >
                    Usar para siguiente ciclo
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={closeCycle}
            disabled={busy}
            className="mt-3 h-12 w-full rounded-xl border border-zinc-700 text-sm font-bold disabled:opacity-60"
          >
            Cerrar ciclo
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
            <Plus size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black">
              {activeCycle ? 'Nuevo ciclo' : 'Crear ciclo Bilbo'}
            </h2>
            <p className="text-xs text-zinc-500">Calcula el peso inicial al 50%</p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-bold text-zinc-400">Ejercicio compatible</span>
          <select
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
            className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
          >
            <option value="">Seleccionar ejercicio</option>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 rounded-xl border border-zinc-800 p-3">
          <p className="mb-3 text-xs font-bold text-zinc-400">Estimar 1RM con Epley</p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 block text-[11px] text-zinc-500">Peso kg</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
              />
            </label>
            <label>
              <span className="mb-2 block text-[11px] text-zinc-500">Repeticiones</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
              />
            </label>
          </div>
          {estimatedOneRm && (
            <p className="mt-3 text-sm text-zinc-300">
              1RM estimado: <strong className="text-purple-300">{estimatedOneRm.toFixed(1)} kg</strong>
            </p>
          )}
        </div>

        <label className="mt-3 block">
          <span className="mb-2 block text-xs font-bold text-zinc-400">1RM actual</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={manualOneRm}
            onChange={(event) => setManualOneRm(event.target.value)}
            placeholder={estimatedOneRm ? estimatedOneRm.toFixed(1) : 'Ej. 100'}
            className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-2 block text-xs font-bold text-zinc-400">Redondeo kg</span>
            <select
              value={rounding}
              onChange={(event) => setRounding(Number(event.target.value) as 1.25 | 2.5)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
            >
              <option value={2.5}>Múltiplos de 2.5</option>
              <option value={1.25}>Múltiplos de 1.25</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold text-zinc-400">Incremento kg</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1.25"
              value={increment}
              onChange={(event) => setIncrement(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
            />
          </label>
        </div>

        {initialWeight && (
          <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-3">
            <p className="text-xs text-purple-300">Peso inicial recomendado</p>
            <p className="mt-1 text-2xl font-black text-purple-100">
              {initialWeight.toFixed(2).replace('.00', '')} kg
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={createCycle}
          disabled={busy}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-purple-500 text-base font-bold text-white disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="animate-spin" size={21} /> : <Check size={20} />}
          Crear ciclo
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
            <Calculator size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black">Discos por lado</h2>
            <p className="text-xs text-zinc-500">Configuración rápida</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-2 block text-xs font-bold text-zinc-400">Peso total</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1.25"
              value={diskWeight}
              onChange={(event) => setDiskWeight(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold text-zinc-400">Barra</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1.25"
              value={barWeight}
              onChange={(event) => setBarWeight(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3"
            />
          </label>
        </div>

        {diskResult.plates.length > 0 ? (
          <div className="mt-4 space-y-2">
            {diskResult.plates.map((plate) => (
              <div
                key={plate.weight}
                className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-bold">{plate.weight} kg</p>
                  <p className="text-[11px] text-zinc-500">por lado</p>
                </div>
                <div className="flex items-center gap-2 text-purple-300">
                  <span className="text-xl font-black">× {plate.count}</span>
                  <ChevronRight size={17} />
                </div>
              </div>
            ))}
            {diskResult.remaining > 0.001 && (
              <p className="text-xs text-amber-400">
                Sin equivalencia exacta: quedan {diskResult.remaining.toFixed(2)} kg por lado.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-zinc-950 px-3 py-3 text-center text-sm text-zinc-500">
            Introduce un peso válido superior a la barra.
          </p>
        )}
      </div>
    </section>
  )
}
