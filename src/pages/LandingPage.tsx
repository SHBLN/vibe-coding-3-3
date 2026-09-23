import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthModal, type AuthTab } from '../components/landing/AuthModal'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { Footer } from '../components/landing/Footer'
import { Header } from '../components/landing/Header'
import { HeroSection } from '../components/landing/HeroSection'
import { ResultsSection } from '../components/landing/ResultsSection'
import { TelegramSection } from '../components/landing/TelegramSection'
import {
  TestimonialPricingSection,
  type PricingPlanId,
} from '../components/landing/TestimonialPricingSection'
import { TickerBar } from '../components/landing/TickerBar'
import { useAuth } from '../hooks/useAuth'
import { LANDING_HOW_IT_WORKS_ID, scrollToLandingSection } from '../lib/landingAnchors'

const dashboardHighlights = [
  { label: 'Активные доски', value: '11' },
  { label: 'Задач в работе', value: '28' },
  { label: 'Просрочено', value: '3' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { account, loading, refresh, signOut } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [pendingBillingPlan, setPendingBillingPlan] = useState<PricingPlanId | null>(null)
  const [postAuthPath, setPostAuthPath] = useState<string | null>(null)

  const openAuthModal = (tab: AuthTab) => {
    setAuthTab(tab)
    setAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setAuthModalOpen(false)
    setPendingBillingPlan(null)
    setPostAuthPath(null)
  }

  const handlePricingPay = (planId: PricingPlanId) => {
    if (account) {
      navigate(`/billing?plan=${planId}`)
      return
    }
    setPendingBillingPlan(planId)
    openAuthModal('login')
  }

  const handleAuthSuccess = async () => {
    const planAfterLogin = pendingBillingPlan
    const redirectPath = postAuthPath
    await refresh()
    setAuthModalOpen(false)
    setPendingBillingPlan(null)
    setPostAuthPath(null)
    if (planAfterLogin) {
      navigate(`/billing?plan=${planAfterLogin}`)
      return
    }
    if (redirectPath) {
      navigate(redirectPath)
      return
    }
    navigate('/boards')
  }

  const requireAuthForPath = (path: string) => {
    if (account) {
      navigate(path)
      return
    }
    setPostAuthPath(path)
    openAuthModal('login')
  }

  const handleConnectTelegram = () => {
    requireAuthForPath('/settings')
  }

  const handleOpenBoards = () => {
    requireAuthForPath('/boards')
  }

  const handleHowItWorks = () => {
    scrollToLandingSection(LANDING_HOW_IT_WORKS_ID)
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header
        account={account}
        authLoading={loading}
        onLoginClick={() => openAuthModal('login')}
        onRegisterClick={() => openAuthModal('register')}
        onSignOut={async () => {
          await signOut()
        }}
      />

      <main className="bg-surface">
        <section className="section-shell py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {dashboardHighlights.map((item) => (
              <div key={item.label} className="panel-shell px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy/45">{item.label}</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-navy">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
        <HeroSection
          isAuthenticated={Boolean(account)}
          onRegisterClick={() => openAuthModal('register')}
          onGoToBoards={() => navigate('/boards')}
          onHowItWorksClick={handleHowItWorks}
        />
        <TickerBar />
        <FeaturesSection />
        <ResultsSection />
        <TelegramSection
          onConnectTelegram={handleConnectTelegram}
          onOpenBoards={handleOpenBoards}
        />
        <TestimonialPricingSection
          isAuthenticated={Boolean(account)}
          authLoading={loading}
          onPayPlan={handlePricingPay}
        />
      </main>
      <Footer />
      <AuthModal
        isOpen={authModalOpen}
        activeTab={authTab}
        onTabChange={setAuthTab}
        onClose={closeAuthModal}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}
