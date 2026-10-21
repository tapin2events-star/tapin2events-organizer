import { Suspense } from 'react';
import MeetingRedirect from './components/MeetingRedirect';
import DomainGate from './components/DomainGate';
import { TourProvider } from './components/TourGuide';
import lazyWithRetry from './lib/lazyWithRetry';
import AppErrorBoundary from './components/AppErrorBoundary';
const BusinessPlanGate = lazyWithRetry(() => import('./pages/business/BusinessPlanGate'));
import ActivityRedirect from './components/ActivityRedirect';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const EventForm = lazyWithRetry(() => import('./pages/EventForm'));
const ImportEvents = lazyWithRetry(() => import('./pages/ImportEvents'));
const Earnings = lazyWithRetry(() => import('./pages/Earnings'));
const EventDetail = lazyWithRetry(() => import('./pages/EventDetail'));
import Discover from './pages/Discover';
const PublicEventDetail = lazyWithRetry(() => import('./pages/PublicEventDetail'));
const TicketPass = lazyWithRetry(() => import('./pages/TicketPass'));
const Receipt = lazyWithRetry(() => import('./pages/Receipt'));
const ShortLink = lazyWithRetry(() => import('./pages/ShortLink'));
const PromoterLinks = lazyWithRetry(() => import('./pages/PromoterLinks'));
const EventNetwork = lazyWithRetry(() => import('./pages/EventNetwork'));
const PeopleIveMet = lazyWithRetry(() => import('./pages/PeopleIveMet'));
const NetworkHome = lazyWithRetry(() => import('./pages/NetworkHome'));
const TeamChat = lazyWithRetry(() => import('./pages/TeamChat'));
const Planning = lazyWithRetry(() => import('./pages/Planning'));
const MeetingDetail = lazyWithRetry(() => import('./pages/MeetingDetail'));
const PollDetail = lazyWithRetry(() => import('./pages/PollDetail'));
const MyActivity = lazyWithRetry(() => import('./pages/MyActivity'));
const SavedEvents = lazyWithRetry(() => import('./pages/SavedEvents'));
const RefundPolicy = lazyWithRetry(() => import('./pages/RefundPolicy'));
const TermsOfService = lazyWithRetry(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const CreatorProfile = lazyWithRetry(() => import('./pages/CreatorProfile'));
const ProductDetail = lazyWithRetry(() => import('./pages/ProductDetail'));
const MyVendorApplicationsPage = lazyWithRetry(() => import('./pages/MyVendorApplicationsPage'));
const OrganizerVendorApplicationsPage = lazyWithRetry(() => import('./pages/OrganizerVendorApplicationsPage'));
const OrganizerBookings = lazyWithRetry(() => import('./pages/OrganizerBookings'));
const ResourceDiscovery = lazyWithRetry(() => import('./pages/ResourceDiscovery'));
const ResourceProfile = lazyWithRetry(() => import('./pages/ResourceProfile'));
const Welcome = lazyWithRetry(() => import('./pages/Welcome'));
const Tutorials = lazyWithRetry(() => import('./pages/Tutorials'));
const Embed = lazyWithRetry(() => import('./pages/Embed'));
const MeetingMinutes = lazyWithRetry(() => import('./pages/MeetingMinutes'));
const PartnerInvite = lazyWithRetry(() => import('./pages/PartnerInvite'));
const PartnerCard = lazyWithRetry(() => import('./pages/PartnerCard'));
const PartnerOptout = lazyWithRetry(() => import('./pages/PartnerOptout'));
const OrgTickets = lazyWithRetry(() => import('./pages/OrgTickets'));
const TransferAccept = lazyWithRetry(() => import('./pages/TransferAccept'));
const ResourceSignup = lazyWithRetry(() => import('./pages/ResourceSignup'));
const ResourceDashboard = lazyWithRetry(() => import('./pages/ResourceDashboard'));
const MyGroups = lazyWithRetry(() => import('./pages/MyGroups'));
const GroupCreate = lazyWithRetry(() => import('./pages/GroupCreate'));
const GroupManage = lazyWithRetry(() => import('./pages/GroupManage'));
const GroupChat = lazyWithRetry(() => import('./pages/GroupChat'));
const ScoutingBoards = lazyWithRetry(() => import('./pages/ScoutingBoards'));
const ScoutingBoard = lazyWithRetry(() => import('./pages/ScoutingBoard'));
const SharedScoutBoard = lazyWithRetry(() => import('./pages/SharedScoutBoard'));
const BusinessHome = lazyWithRetry(() => import('./pages/business/BusinessHome'));
const OrgManage = lazyWithRetry(() => import('./pages/business/OrgManage'));
const OrgPublic = lazyWithRetry(() => import('./pages/business/OrgPublic'));
const OrgDirectory = lazyWithRetry(() => import('./pages/business/OrgDirectory'));
const ProductsPage = lazyWithRetry(() => import('./pages/ProductsPage'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));

// Only organizers checking guests in ever need this, and its QR-scanning
// library is large — code-split it so public visitors never download it.
const CheckIn = lazyWithRetry(() => import('./pages/CheckIn'));
// Feed pulls in hls.js for cross-browser video playback -- a meaningfully
// large library that visitors who never open the feed shouldn't have to
// download as part of the app's main bundle.
const Feed = lazyWithRetry(() => import('./pages/Feed'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppErrorBoundary><TourProvider><DomainGate><Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/feed"
            element={
              <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black" role="status" aria-label="Loading"><span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>}>
                <Feed />
              </Suspense>
            }
          />

          {/* One shared sidebar shell for the entire app now — public pages
              and organizer pages alike. Auth is enforced per-route below via
              ProtectedRoute, not by which shell wraps them. */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/embed/org/:slug" element={<Embed />} />
          <Route path="/embed/event/:id" element={<Embed />} />
          <Route path="/partner/:token" element={<PartnerInvite />} />
          <Route path="/partners/:id/card" element={<PartnerCard />} />
          <Route path="/partner-optout/:token" element={<PartnerOptout />} />
          <Route path="/meetings/:id/minutes" element={<ProtectedRoute><MeetingMinutes /></ProtectedRoute>} />
          {/* Short meeting address (used in meeting emails and calendar entries). */}
          <Route path="/meetings/:id" element={<MeetingRedirect />} />

          <Route element={<Layout />}>
            <Route path="/" element={<Discover />} />
            <Route path="/events/:id" element={<PublicEventDetail />} />
            <Route path="/p/:code" element={<ShortLink />} />
            <Route path="/promoter" element={<ProtectedRoute><PromoterLinks /></ProtectedRoute>} />
            <Route path="/events/:id/network" element={<ProtectedRoute><EventNetwork /></ProtectedRoute>} />
            <Route path="/events/:id/network/qr/:token" element={<ProtectedRoute><EventNetwork /></ProtectedRoute>} />
            <Route path="/connections" element={<ProtectedRoute><PeopleIveMet /></ProtectedRoute>} />
            <Route path="/network" element={<ProtectedRoute><NetworkHome /></ProtectedRoute>} />
            <Route path="/team-chat/:orgId" element={<ProtectedRoute><TeamChat /></ProtectedRoute>} />
            <Route path="/pass/:ticketId" element={<TicketPass />} />
            <Route path="/tickets/:slug" element={<OrgTickets />} />
            <Route path="/transfer/:token" element={<TransferAccept />} />
            <Route path="/receipt" element={<ProtectedRoute><Receipt /></ProtectedRoute>} />
            <Route path="/activity" element={<MyActivity />} />
            <Route path="/my-activity" element={<ActivityRedirect />} />
            <Route path="/saved" element={<SavedEvents />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/creator/:email" element={<CreatorProfile />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/vendor-applications" element={<MyVendorApplicationsPage />} />
            <Route path="/resources" element={<ResourceDiscovery />} />
            <Route path="/resources/new" element={<ResourceSignup />} />
            <Route path="/tutorials" element={<Tutorials />} />
            <Route path="/resources/dashboard" element={<ResourceDashboard />} />
            <Route path="/resources/:id" element={<ResourceProfile />} />
            <Route path="/groups" element={<ProtectedRoute><MyGroups /></ProtectedRoute>} />
            <Route path="/groups/new" element={<ProtectedRoute><GroupCreate /></ProtectedRoute>} />
            <Route path="/groups/:id/manage" element={<ProtectedRoute><GroupManage /></ProtectedRoute>} />
            <Route path="/groups/:id/chat" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
            <Route path="/organizer/scouting" element={<ProtectedRoute><ScoutingBoards /></ProtectedRoute>} />
            <Route path="/organizer/scouting/:id" element={<ProtectedRoute><ScoutingBoard /></ProtectedRoute>} />
            <Route path="/scout/:token" element={<SharedScoutBoard />} />
            <Route path="/business" element={<BusinessHome />} />
            <Route path="/business/plan" element={<BusinessPlanGate />} />
            <Route path="/business/:slug/manage" element={<ProtectedRoute><OrgManage /></ProtectedRoute>} />
            <Route path="/o/:slug" element={<OrgPublic />} />
            <Route path="/organizations" element={<OrgDirectory />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

            <Route path="/organizer" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/organizer/vendor-applications" element={<ProtectedRoute><OrganizerVendorApplicationsPage /></ProtectedRoute>} />
            <Route path="/organizer/bookings" element={<ProtectedRoute><OrganizerBookings /></ProtectedRoute>} />
            <Route path="/organizer/new" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
            <Route path="/organizer/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
            <Route path="/organizer/meetings/:id" element={<ProtectedRoute><MeetingDetail /></ProtectedRoute>} />
            <Route path="/organizer/polls/:id" element={<ProtectedRoute><PollDetail /></ProtectedRoute>} />
            <Route path="/organizer/import" element={<ProtectedRoute><ImportEvents /></ProtectedRoute>} />
            <Route path="/organizer/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />
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
        </Routes></DomainGate></TourProvider></AppErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
