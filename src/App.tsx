import type { ReactNode } from 'react'
import { useStore } from './lib/store'
import { AppShell } from './components/AppShell'
import { FoodSearch } from './components/FoodSearch'
import { GramSheet } from './components/GramSheet'
import { CustomFoodSheet } from './components/CustomFoodSheet'
import { BarcodeSheet } from './components/BarcodeSheet'
import { TodayScreen } from './screens/TodayScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ActivityScreen } from './screens/ActivityScreen'
import { ProgressScreen, WeightSheet } from './screens/ProgressScreen'
import { LoginScreen } from './screens/LoginScreen'
import { Onboarding, ProfileSheet } from './screens/ProfileScreen'

export default function App() {
  const { ready, supabaseEnabled, session, snapshot, tab, overlay } = useStore()

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/20 text-2xl">
            🌿
          </div>
          <div className="font-extrabold">Форма</div>
        </div>
      </div>
    )
  }

  if (supabaseEnabled && !session) {
    return (
      <Frame>
        <LoginScreen />
      </Frame>
    )
  }

  if (!snapshot.profile?.onboardingComplete) {
    return (
      <Frame>
        <Onboarding />
      </Frame>
    )
  }

  return (
    <AppShell>
      {tab === 'today' && <TodayScreen />}
      {tab === 'diary' && <DiaryScreen />}
      {tab === 'activity' && <ActivityScreen />}
      {tab === 'progress' && <ProgressScreen />}
      {overlay.type === 'search' && <FoodSearch />}
      {overlay.type === 'grams' && <GramSheet />}
      {overlay.type === 'custom-food' && <CustomFoodSheet />}
      {overlay.type === 'barcode' && <BarcodeSheet />}
      <WeightSheet />
      <ProfileSheet />
    </AppShell>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-black md:flex md:items-center md:justify-center md:py-4">
      <div className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-bg md:h-[min(900px,100dvh)] md:rounded-[32px] md:border md:border-white/10">
        {children}
      </div>
    </div>
  )
}
