import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthModal, type AuthTab } from '../components/landing/AuthModal'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { Footer } from '../components/landing/Footer'
import { Header } from '../components/landing/Header'
import { HeroSection } from '../components/landing/HeroSection'
import { ResultsSection } from '../components/landing/ResultsSection'
import { TelegramSection } from '../components/landing/TelegramSection'
import { TestimonialPricingSection } from '../components/landing/TestimonialPricingSection'
import { TickerBar } from '../components/landing/TickerBar'
import { useAuth } from '../hooks/useAuth'

export function LandingPage() {
  const navigate = useNavigate()
  const { account, loading, refresh, signOut } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState<AuthTab>('login')

  const openAuthModal = (tab: AuthTab) => {
    setAuthTab(tab)
    setAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setAuthModalOpen(false)
  }

  const handleAuthSuccess = async () => {
    await refresh()
    closeAuthModal()
    navigate('/boards')
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
        <HeroSection />
        <TickerBar />
        <FeaturesSection />
        <ResultsSection />
        <TelegramSection />
        <TestimonialPricingSection />
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
