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

// Only organizers checking guests in ever need this, and its QR-scanning
// library is large — code-split it so public visitors never download it.
const CheckIn = lazy(() => import('./pages/CheckIn'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Discover />} />
          <Route path="/events/:id" element={<PublicEventDetail />} />
          <Route path="/pass/:ticketId" element={<TicketPass />} />
          <Route path="/activity" element={<MyActivity />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/organizer" element={<Dashboard />} />
            <Route path="/organizer/new" element={<EventForm />} />
            <Route path="/organizer/events/:id" element={<EventDetail />} />
            <Route path="/organizer/events/:id/checkin" element={<Suspense fallback={<p className="text-muted">Loading scanner…</p>}><CheckIn /></Suspense>} />
            <Route path="/organizer/events/:id/edit" element={<EventForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
