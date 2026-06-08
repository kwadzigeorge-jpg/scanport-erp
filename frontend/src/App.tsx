import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scanners from './pages/Scanners/index';
import ScannerDetail from './pages/Scanners/ScannerDetail';
import Certifications from './pages/Certifications/index';
import Notifications from './pages/Notifications/index';
import Reports from './pages/Reports/index';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Admin from './pages/Admin';
import Incidents from './pages/Incidents/index';
import TicketForm from './pages/Incidents/TicketForm';
import TicketDetail from './pages/Incidents/TicketDetail';
import ScannerBoard from './pages/ScannerBoard/index';
import AgentRequests from './pages/AgentRequests/index';
import AgentRequestForm from './pages/AgentRequests/AgentRequestForm';
import AgentRequestDetail from './pages/AgentRequests/AgentRequestDetail';

function ProtectedRoute({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand border-t-transparent" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="incidents"       element={<Incidents />} />
            <Route path="incidents/new"   element={<TicketForm />} />
            <Route path="incidents/:id"   element={<TicketDetail />} />
            <Route path="scanner-board"   element={<ScannerBoard />} />
            <Route path="scanners"       element={<Scanners />} />
            <Route path="scanners/:id"   element={<ScannerDetail />} />
            <Route path="certifications" element={<Certifications />} />
            <Route path="notifications"  element={<Notifications />} />
            <Route path="reports"              element={<Reports />} />
            <Route path="agent-requests"      element={<AgentRequests />} />
            <Route path="agent-requests/new"  element={<AgentRequestForm />} />
            <Route path="agent-requests/:id"  element={<AgentRequestDetail />} />
            <Route path="users" element={
              <ProtectedRoute adminOnly><Users /></ProtectedRoute>
            } />
            <Route path="audit" element={
              <ProtectedRoute adminOnly><AuditLog /></ProtectedRoute>
            } />
            <Route path="admin" element={
              <ProtectedRoute adminOnly><Admin /></ProtectedRoute>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
