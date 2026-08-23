import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Members from './pages/Members'
import Contributions from './pages/Contributions'
import Loans from './pages/Loans'
import Investments from './pages/Investments'
import Meetings from './pages/Meetings'
import Audit from './pages/Audit'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'

import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import FooterNav from './components/FooterNav'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="web-layout">
          <Sidebar />
          <div className="web-content">
            <TopBar />
            <main className="web-main">
              <Routes>
                {/* Public — sign-in only, no self-signup (members are invited) */}
                <Route path="/login" element={<Login />} />

                {/* First-time / post-invite password set — accessible only to authenticated sessions */}
                <Route
                  path="/set-password"
                  element={<ProtectedRoute><SetPassword /></ProtectedRoute>}
                />

                {/* Shared dashboard — every member */}
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/contributions" element={<ProtectedRoute><Contributions /></ProtectedRoute>} />
                <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
                <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                {/* Chair only */}
                <Route path="/members" element={<ProtectedRoute allowedRoles={['chair']}><Members /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={['chair']}><Settings /></ProtectedRoute>} />

                {/* Treasurer / Chair only */}
                <Route path="/investments" element={<ProtectedRoute allowedRoles={['treasurer', 'chair']}><Investments /></ProtectedRoute>} />

                {/* Auditor / Chair only */}
                <Route path="/audit" element={<ProtectedRoute allowedRoles={['auditor', 'chair']}><Audit /></ProtectedRoute>} />

                {/* Anything unmatched (old bookmarks/tabs from the v1 multi-group
                    routes, typos, etc.) — send back to the dashboard rather than
                    rendering a blank page. */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <FooterNav />
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
