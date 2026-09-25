import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventForm from './pages/EventForm';
import EventDetail from './pages/EventDetail';
import Discover from './pages/Discover';
import PublicEventDetail from './pages/PublicEventDetail';
import TicketPass from './pages/TicketPass';
import MyActivity from './pages/MyActivity';
import Profile from './pages/Profile';
import CreatorProfile from './pages/CreatorProfile';
import ProductDetail from './pages/ProductDetail';
import MyVendorApplicationsPage from './pages/MyVendorApplicationsPage';
import OrganizerVendorApplicationsPage from './pages/OrganizerVendorApplicationsPage';
import ResourceDiscovery from './pages/ResourceDiscovery';
import ResourceProfile from './pages/ResourceProfile';
import ResourceSignup from './pages/ResourceSignup';
import ResourceDashboard from './pages/ResourceDashboard';
import ProductsPage from './pages/ProductsPage';
import AdminDashboard from './pages/AdminDashboard';

// Only organizers checking guests in ever need this, and its QR-scanning
// library is large — code-split it so public visitors never download it.
const CheckIn = lazy(() => import('./pages/CheckIn'));
// Feed pulls in hls.js for cross-browser video playback -- a meaningfully
// large library that visitors who never open the feed shouldn't have to
// download as part of the app's main bundle.
const Feed = lazy(() => import('./pages/Feed'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/feed"
            element={
              <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading…</div>}>
                <Feed />
              </Suspense>
            }
          />

          {/* One shared sidebar shell for the entire app now — public pages
              and organizer pages alike. Auth is enforced per-route below via
              ProtectedRoute, not by which shell wraps them. */}
          <Route element={<Layout />}>
            <Route path="/" element={<Discover />} />
            <Route path="/events/:id" element={<PublicEventDetail />} />
            <Route path="/pass/:ticketId" element={<TicketPass />} />
            <Route path="/activity" element={<MyActivity />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/creator/:email" element={<CreatorProfile />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/vendor-applications" element={<MyVendorApplicationsPage />} />
            <Route path="/resources" element={<ResourceDiscovery />} />
            <Route path="/resources/new" element={<ResourceSignup />} />
            <Route path="/resources/dashboard" element={<ResourceDashboard />} />
            <Route path="/resources/:id" element={<ResourceProfile />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

            <Route path="/organizer" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/organizer/vendor-applications" element={<ProtectedRoute><OrganizerVendorApplicationsPage /></ProtectedRoute>} />
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
