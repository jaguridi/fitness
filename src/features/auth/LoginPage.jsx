import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { USERS } from '../../constants'
import { useAuth } from '../../auth/AuthContext'
import { Avatar, Button, Skeleton, cx, memberProps } from '../../components/ui'

/**
 * Entrada: elegir quién eres y escribir (o crear) tu PIN de 4 dígitos.
 * Misma lógica que la v1: checkUserPin decide si se crea; login valida o crea.
 */
export default function LoginPage() {
  const [user, setUser] = useState(null)
  return (
    <div className="min-h-dvh bg-paper px-5 pt-safe pb-safe">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col py-8">
        {user ? <PinStep user={user} onBack={() => setUser(null)} /> : <ChooseStep onChoose={setUser} />}
      </div>
    </div>
  )
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex -space-x-1" aria-hidden="true">
        {USERS.map((u) => (
          <span key={u.id} className="size-3 rounded-full ring-2 ring-paper" style={{ background: `var(--m-${u.id})` }} />
        ))}
      </span>
      <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">FitFamily</span>
    </div>
  )
}

function ChooseStep({ onChoose }) {
  return (
    <>
      <Wordmark />
      <h1 className="type-display mt-14 text-ink">¿Quién eres?</h1>
      <p className="type-body mt-3 text-ink-soft">Toca tu nombre para entrar.</p>
      <ul className="mt-8 grid grid-cols-2 gap-3">
        {USERS.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              {...memberProps(u.id)}
              onClick={() => onChoose(u)}
              className="group flex h-full min-h-40 w-full flex-col justify-between rounded-surface bg-member-tint p-4 text-left transition-transform duration-150 active:scale-[0.97]"
            >
              <span className="inline-flex self-start rounded-full bg-surface p-[3px] shadow-[0_0_0_3px_var(--member)] transition-transform duration-200 group-hover:-rotate-3">
                <Avatar src={u.avatar} name="" size={64} plain />
              </span>
              <span className="mt-4 text-[26px] leading-none font-extrabold tracking-[-0.03em] text-ink">{u.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="type-small mt-auto pt-10 text-ink-soft">
        La app de ejercicio de la familia: cada uno con su meta, todos en el mismo álbum.
      </p>
    </>
  )
}

function PinStep({ user, onBack }) {
  const { login, checkUserPin } = useAuth()
  const [checking, setChecking] = useState(true)
  const [isNew, setIsNew] = useState(false)
  const [stage, setStage] = useState('enter') // 'enter' | 'create' | 'confirm'
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let alive = true
    setChecking(true)
    checkUserPin(user.id)
      .then((has) => alive && (setIsNew(!has), setStage(has ? 'enter' : 'create')))
      .catch(() => alive && (setIsNew(true), setStage('create')))
      .finally(() => alive && setChecking(false))
    return () => {
      alive = false
    }
  }, [user.id, checkUserPin])

  useEffect(() => {
    if (!checking) inputRef.current?.focus()
  }, [checking, stage])

  const fail = (message) => {
    setError(message)
    setPin('')
    setShakeKey((k) => k + 1)
  }

  const submit = async (value = pin) => {
    if (value.length !== 4 || loading) return
    setError('')
    if (stage === 'create') {
      setFirstPin(value)
      setPin('')
      setStage('confirm')
      return
    }
    if (stage === 'confirm' && value !== firstPin) {
      setStage('create')
      setFirstPin('')
      fail('Los PIN no coinciden. Créalo de nuevo.')
      return
    }
    setLoading(true)
    try {
      await login(user.id, value)
    } catch (err) {
      const msg = err?.message === 'PIN incorrecto' ? 'PIN incorrecto. Inténtalo de nuevo.' : err?.message
      fail(msg || 'No pudimos entrar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const onChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(v)
    if (error) setError('')
    if (v.length === 4) submit(v)
  }

  const copy = {
    enter: { title: `Hola, ${user.name}`, hint: 'Ingresa tu PIN de 4 dígitos.', cta: 'Entrar' },
    create: { title: `Hola, ${user.name}`, hint: 'Crea un PIN de 4 dígitos. Lo usarás cada vez que entres.', cta: 'Continuar' },
    confirm: { title: 'Repite tu PIN', hint: 'Escríbelo otra vez para confirmarlo.', cta: 'Crear PIN y entrar' },
  }[stage]

  return (
    <div {...memberProps(user.id)} className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="-ml-3 inline-flex h-11 items-center gap-1 self-start rounded-full pr-4 pl-2 text-[15px] font-semibold text-ink-soft hover:bg-ink/6 hover:text-ink"
      >
        <ChevronLeft size={20} strokeWidth={2.3} aria-hidden="true" />
        Cambiar de persona
      </button>

      <span className="mt-8 inline-flex self-start rounded-full bg-surface p-1 shadow-[0_0_0_4px_var(--member)]">
        <Avatar src={user.avatar} name={user.name} size={84} plain />
      </span>
      <h1 className="type-title mt-6 text-ink">{copy.title}</h1>
      <p className="type-body mt-2 max-w-[32ch] text-ink-soft">{checking ? 'Revisando tu cuenta…' : copy.hint}</p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {checking ? (
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="!h-[4.25rem] w-[3.75rem] !rounded-control" />
            ))}
          </div>
        ) : (
          <label className="group relative block w-fit">
            <span className="sr-only">
              {stage === 'confirm' ? 'Repite el PIN' : stage === 'create' ? 'Nuevo PIN' : 'PIN'}
            </span>
            <input
              ref={inputRef}
              key={stage}
              type="password"
              inputMode="numeric"
              autoComplete={stage === 'enter' ? 'current-password' : 'new-password'}
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={onChange}
              disabled={loading}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'pin-error' : undefined}
              className="absolute inset-0 z-10 h-full w-full cursor-text text-transparent caret-transparent opacity-0"
            />
            <span key={shakeKey} className={cx('flex gap-3', shakeKey > 0 && 'animate-shake')} aria-hidden="true">
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length
                const current = i === Math.min(pin.length, 3)
                return (
                  <span
                    key={i}
                    className={cx(
                      'flex h-[4.25rem] w-[3.75rem] items-center justify-center rounded-control border-2 bg-surface transition-colors duration-150',
                      error
                        ? 'border-danger'
                        : current && !loading
                          ? 'border-line-strong group-focus-within:border-ink'
                          : filled
                            ? 'border-member'
                            : 'border-line'
                    )}
                  >
                    {filled && <span key={pin.length} className="size-4 animate-pop rounded-full bg-member" />}
                  </span>
                )
              })}
            </span>
          </label>
        )}

        <p id="pin-error" role="alert" className="type-small mt-3 min-h-5 font-semibold text-danger">
          {error}
        </p>

        <Button type="submit" size="lg" block className="mt-6" loading={loading} disabled={checking || pin.length !== 4}>
          {loading ? 'Entrando…' : copy.cta}
        </Button>
      </form>

      {!isNew && !checking && (
        <p className="type-small mt-auto pt-10 text-ink-soft">¿Olvidaste tu PIN? Pídele a Jose que lo reinicie.</p>
      )}
    </div>
  )
}
