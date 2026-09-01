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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Discover />} />
          <Route path="/events/:id" element={<PublicEventDetail />} />
          <Route path="/pass/:ticketId" element={<TicketPass />} />
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
            <Route path="/organizer/events/:id/edit" element={<EventForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
