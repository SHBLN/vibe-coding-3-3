import { FeaturesSection } from './components/landing/FeaturesSection'
import { Footer } from './components/landing/Footer'
import { Header } from './components/landing/Header'
import { HeroSection } from './components/landing/HeroSection'
import { ResultsSection } from './components/landing/ResultsSection'
import { TelegramSection } from './components/landing/TelegramSection'
import { TestimonialPricingSection } from './components/landing/TestimonialPricingSection'
import { TickerBar } from './components/landing/TickerBar'

function App() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main>
        <HeroSection />
        <TickerBar />
        <FeaturesSection />
        <ResultsSection />
        <TelegramSection />
        <TestimonialPricingSection />
      </main>
      <Footer />
    </div>
  )
}

export default App
