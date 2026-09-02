import { useState } from 'react'
import { AuthModal, type AuthTab } from './components/landing/AuthModal'
import { AuthWelcomeBanner } from './components/landing/AccountBadge'
import { FeaturesSection } from './components/landing/FeaturesSection'
import { Footer } from './components/landing/Footer'
import { Header } from './components/landing/Header'
import { HeroSection } from './components/landing/HeroSection'
import { ResultsSection } from './components/landing/ResultsSection'
import { TelegramSection } from './components/landing/TelegramSection'
import { TestimonialPricingSection } from './components/landing/TestimonialPricingSection'
import { TickerBar } from './components/landing/TickerBar'
import { useAuth } from './hooks/useAuth'

function App() {
  const { account, loading, refresh, signOut } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [showWelcome, setShowWelcome] = useState(false)

  const openAuthModal = (tab: AuthTab) => {
    setAuthTab(tab)
    setAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setAuthModalOpen(false)
  }

  const handleAuthSuccess = async () => {
    await refresh()
    setShowWelcome(true)
    closeAuthModal()
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
          setShowWelcome(false)
        }}
      />

      {showWelcome && account && (
        <AuthWelcomeBanner account={account} onDismiss={() => setShowWelcome(false)} />
      )}

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

export default App
