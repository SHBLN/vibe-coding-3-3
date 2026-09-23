import { Route, Routes } from 'react-router-dom'
import { KnowledgeLiveChatWidget } from './components/KnowledgeLiveChatWidget'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BoardViewPage } from './pages/BoardViewPage'
import { BoardsPage } from './pages/BoardsPage'
import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { BillingPage } from './pages/BillingPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireCompleteProfile={false}>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/boards"
        element={
          <ProtectedRoute>
            <BoardsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/boards/:boardId"
        element={
          <ProtectedRoute>
            <BoardViewPage />
          </ProtectedRoute>
        }
      />
    </Routes>
    <KnowledgeLiveChatWidget />
    </>
  )
}

export default App
