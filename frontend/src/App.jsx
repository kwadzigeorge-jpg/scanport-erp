import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';

import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import BoothPage          from './pages/BoothPage';
import BayAllocationPage  from './pages/BayAllocationPage';
import MarshalPage      from './pages/MarshalPage';
import TransactionsPage from './pages/TransactionsPage';
import BaysPage         from './pages/BaysPage';
import ReportsPage      from './pages/ReportsPage';
import AdminPage        from './pages/AdminPage';
import LeavePage        from './pages/LeavePage';
import TrainingPage     from './pages/TrainingPage';
import InventoryPage    from './pages/InventoryPage';
import StockPage        from './pages/StockPage';
import CompliancePage   from './pages/CompliancePage';
import GrievancePage         from './pages/GrievancePage';
import ServiceFeedbackPage   from './pages/ServiceFeedbackPage';
import FeedbackFormPage      from './pages/FeedbackFormPage';
import GangAllocationPage    from './pages/GangAllocationPage';
import NotFoundPage          from './pages/NotFoundPage';

function ProtectedRoute({ children, roles, permission }) {
  const { user, loading, hasRole, hasPermission } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasRole(roles)) return <Navigate to="/dashboard" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/feedback" element={<FeedbackFormPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
        <Route path="booth"          element={<ProtectedRoute permission="allocation.create"><BoothPage /></ProtectedRoute>} />
        <Route path="marshal"        element={<ProtectedRoute permission="marshal.confirm_entry"><MarshalPage /></ProtectedRoute>} />
        <Route path="bays"           element={<ProtectedRoute permission="bay.view"><BaysPage /></ProtectedRoute>} />
        <Route path="bay-allocation" element={<ProtectedRoute permission="allocation.create"><BayAllocationPage /></ProtectedRoute>} />
        <Route path="transactions"   element={<ProtectedRoute permission="container.view"><TransactionsPage /></ProtectedRoute>} />
        <Route path="reports"        element={<ProtectedRoute permission="report.view"><ReportsPage /></ProtectedRoute>} />
        <Route path="admin"        element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />
        <Route path="leave"        element={<ProtectedRoute roles={['admin', 'supervisor']}><LeavePage /></ProtectedRoute>} />
        <Route path="inventory"    element={<ProtectedRoute permission="part.view"><InventoryPage /></ProtectedRoute>} />
        <Route path="stock"        element={<ProtectedRoute permission="stock.view"><StockPage /></ProtectedRoute>} />
        <Route path="compliance"   element={<ProtectedRoute><CompliancePage /></ProtectedRoute>} />
        <Route path="grievances"        element={<ProtectedRoute><GrievancePage /></ProtectedRoute>} />
        <Route path="service-feedback" element={<ProtectedRoute permission="feedback.view"><ServiceFeedbackPage /></ProtectedRoute>} />
        <Route path="gang-allocation"  element={<ProtectedRoute roles={['admin', 'supervisor']}><GangAllocationPage /></ProtectedRoute>} />
        <Route path="training"         element={<ProtectedRoute roles={['admin', 'supervisor']}><TrainingPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
