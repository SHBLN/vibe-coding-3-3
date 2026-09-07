import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BoardsPage } from './pages/BoardsPage'
import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'

function App() {
  return (
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
    </Routes>
  )
}

export default App
