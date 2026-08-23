import './App.css'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { FinanceProvider } from './context/FinanceContext'
import { GroupsProvider } from './context/GroupsContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import CreateGroup from './pages/CreateGroup'
import GroupSettings from './pages/GroupSettings'
import RecordContribution from './pages/RecordContribution'
import ContributionRecords from './pages/ContributionRecords'
import Profile from './pages/Profile'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Loans from './pages/Loans'
import NewLoan from './pages/NewLoan'
import Goals from './pages/Goals'
import NewGoal from './pages/NewGoal'
import SubmitRequest from './pages/SubmitRequest'
import AdminRequests from './pages/AdminRequests'
import ChairDashboard from './pages/ChairDashboard'
import TreasuryDashboard from './pages/TreasuryDashboard'
import SecretaryDashboard from './pages/SecretaryDashboard'
import AuditDashboard from './pages/AuditDashboard'
import SysadminDashboard from './pages/SysadminDashboard'
import MobilizerDashboard from './pages/MobilizerDashboard'
import VotingDashboard from './pages/VotingDashboard'

import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import FooterNav from './components/FooterNav'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FinanceProvider>
          <GroupsProvider>
            <div className="web-layout">
              <Sidebar />
              <div className="web-content">
                <TopBar />
                <main className="web-main">
                  <Routes>
                    {/* Public — login only (no self-signup) */}
                    <Route path="/login" element={<Login />} />

                    {/* Forced password change — accessible only to authenticated users */}
                    <Route
                      path="/change-password"
                      element={<ProtectedRoute><ChangePassword /></ProtectedRoute>}
                    />

                    {/* Protected — any logged-in user */}
                    <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
                    <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
                    <Route path="/groups/:id/records" element={<ProtectedRoute><ContributionRecords /></ProtectedRoute>} />
                    <Route path="/groups/:id/submit" element={<ProtectedRoute><SubmitRequest /></ProtectedRoute>} />
                    <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
                    <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                    {/* Admin-only (Sysadmin) */}
                    <Route path="/admin" element={<ProtectedRoute allowedRoles={['sysadmin']}><SysadminDashboard /></ProtectedRoute>} />

                    {/* Role-specific Dashboards */}
                    <Route path="/chair" element={<ProtectedRoute allowedRoles={['chair', 'sysadmin']}><ChairDashboard /></ProtectedRoute>} />
                    <Route path="/treasury" element={<ProtectedRoute allowedRoles={['treasury', 'sysadmin']}><TreasuryDashboard /></ProtectedRoute>} />
                    <Route path="/secretary" element={<ProtectedRoute allowedRoles={['secretary', 'sysadmin']}><SecretaryDashboard /></ProtectedRoute>} />
                    <Route path="/audit" element={<ProtectedRoute allowedRoles={['audit', 'sysadmin']}><AuditDashboard /></ProtectedRoute>} />
                    <Route path="/mobilizer" element={
                      <ProtectedRoute allowedRoles={['mobilizer', 'sysadmin']}><MobilizerDashboard /></ProtectedRoute>
                    } />
                    <Route path="/voting" element={
                      <ProtectedRoute allowedRoles={['member', 'chair', 'treasury', 'secretary', 'audit', 'mobilizer', 'sysadmin']}>
                        <VotingDashboard />
                      </ProtectedRoute>
                    } />

                    {/* Role-gated pages */}
                    <Route path="/groups/new" element={<ProtectedRoute allowedRoles={['sysadmin','chair','mobilizer']}><CreateGroup /></ProtectedRoute>} />
                    <Route path="/groups/:id/settings" element={<ProtectedRoute><GroupSettings /></ProtectedRoute>} />
                    <Route path="/groups/:id/record" element={<ProtectedRoute><RecordContribution /></ProtectedRoute>} />
                    <Route path="/groups/:id/requests" element={<ProtectedRoute><AdminRequests /></ProtectedRoute>} />
                    <Route path="/loans/new" element={<ProtectedRoute><NewLoan /></ProtectedRoute>} />
                    <Route path="/goals/new" element={<ProtectedRoute><NewGoal /></ProtectedRoute>} />
                  </Routes>
                </main>
                <FooterNav />
              </div>
            </div>
          </GroupsProvider>
        </FinanceProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
