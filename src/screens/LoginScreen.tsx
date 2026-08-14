import { useState } from 'react'
import { useStore } from '../lib/store'

export function LoginScreen() {
  const { signIn, signUp, authError } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')

  const submit = () => {
    if (mode === 'in') signIn(email, password)
    else signUp(email, password)
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
      <div className="mb-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/20 text-2xl">🌿</div>
        <h1 className="text-3xl font-extrabold">Форма</h1>
        <p className="mt-2 text-white/50">Один аккаунт. Войди, чтобы дневник жил и на телефоне, и на компьютере.</p>
      </div>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-white/45">Почта</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs text-white/45">Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
        />
      </label>
      {authError && <p className="mb-3 text-sm text-carbs">{authError}</p>}
      <button onClick={submit} className="h-14 w-full rounded-2xl bg-mint font-bold text-bg">
        {mode === 'in' ? 'Войти' : 'Создать аккаунт'}
      </button>
      <button
        onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
        className="mt-3 h-12 text-sm text-white/50"
      >
        {mode === 'in' ? 'Первый раз? Создать аккаунт' : 'Уже есть аккаунт? Войти'}
      </button>
    </div>
  )
}
