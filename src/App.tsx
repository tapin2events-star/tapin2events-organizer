import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventForm from './pages/EventForm';
import EventDetail from './pages/EventDetail';
import Discover from './pages/Discover';
import PublicEventDetail from './pages/PublicEventDetail';
import TicketPass from './pages/TicketPass';
import MyActivity from './pages/MyActivity';
import ResourceDiscovery from './pages/ResourceDiscovery';
import ResourceProfile from './pages/ResourceProfile';
import ResourceSignup from './pages/ResourceSignup';
import ResourceDashboard from './pages/ResourceDashboard';
import ProductsPage from './pages/ProductsPage';

// Only organizers checking guests in ever need this, and its QR-scanning
// library is large — code-split it so public visitors never download it.
const CheckIn = lazy(() => import('./pages/CheckIn'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* One shared sidebar shell for the entire app now — public pages
              and organizer pages alike. Auth is enforced per-route below via
              ProtectedRoute, not by which shell wraps them. */}
          <Route element={<Layout />}>
            <Route path="/" element={<Discover />} />
            <Route path="/events/:id" element={<PublicEventDetail />} />
            <Route path="/pass/:ticketId" element={<TicketPass />} />
            <Route path="/activity" element={<MyActivity />} />
            <Route path="/resources" element={<ResourceDiscovery />} />
            <Route path="/resources/new" element={<ResourceSignup />} />
            <Route path="/resources/dashboard" element={<ResourceDashboard />} />
            <Route path="/resources/:id" element={<ResourceProfile />} />
            <Route path="/products" element={<ProductsPage />} />

            <Route path="/organizer" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/organizer/new" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
            <Route path="/organizer/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
            <Route
              path="/organizer/events/:id/checkin"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<p className="text-muted">Loading scanner…</p>}>
                    <CheckIn />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="/organizer/events/:id/edit" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
