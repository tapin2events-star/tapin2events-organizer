import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, LEGAL_EFFECTIVE, LegalPage, LegalSection } from '../components/LegalPage';

// Privacy Policy describing what TapIN actually collects and which services
// handle it (keep in sync when adding a new third-party service).
// NOTE: draft for TapIN LLC to have reviewed by an attorney before relying on it.
export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_EFFECTIVE}
      intro={
        <p>
          This policy explains what information <strong>TapIN LLC</strong> ("TapIN," "we") collects when you use TapIN2Events, how we use and share it, and the choices you have.
          The short version: <strong>we don't sell your personal information, we don't show ads, and we don't use third-party tracking or analytics tools.</strong>
        </p>
      }
    >
      <LegalSection title="Information you give us">
        <ul>
          <li><strong>Account details:</strong> your name, email address, and, if you add them, your phone number, city and state, bio, and profile photo.</li>
          <li><strong>Organizer, resource, and seller details:</strong> events you create or import, resource profiles, products, photos, music and video links, pricing, and vendor applications.</li>
          <li><strong>Posts and activity:</strong> videos, captions, comments, likes, follows, saved events, interests, reports, and tips.</li>
          <li><strong>Messages:</strong> booking requests and notes you send to organizers or resources.</li>
          <li><strong>Purchases:</strong> tickets, registrations, orders, and shipping addresses you enter. Card payments are handled by Stripe; <strong>TapIN never receives or stores your full card number.</strong></li>
          <li><strong>Payout details:</strong> if you get paid through TapIN, you provide identity and bank details directly to Stripe. We receive your Stripe account status, not your bank account number.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Information collected as you use TapIN">
        <ul>
          <li><strong>Tickets and check-ins:</strong> tickets you hold and when they're scanned at an event.</li>
          <li><strong>Location, only if you allow it:</strong> if you tap "use my location" on the map, your device's location is used on your device to center the map. It isn't saved to your account or sent to TapIN. City searches are looked up with OpenStreetMap.</li>
          <li><strong>Browser storage:</strong> we store your sign-in session and a few preferences (like dismissed prompts) in your browser so the Service works. We don't use advertising or tracking cookies.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul>
          <li>To run the Service: show events, process tickets and orders, pay organizers, check people in, and send confirmations, reminders, and alerts.</li>
          <li>To personalize Discover, such as "Picked for you" based on your interests and the events you save or attend.</li>
          <li>To keep TapIN safe: prevent fraud, enforce our <Link to="/terms">Terms</Link>, and review reports.</li>
          <li>To provide support and improve the Service.</li>
          <li>To comply with legal, tax, and accounting obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who can see your information">
        <ul>
          <li><strong>Everyone:</strong> public profile information (name, photo, bio, organizer or resource badges, follower counts), posts, comments, published events, and resource profiles. You can make your profile private in Profile settings.</li>
          <li><strong>Organizers:</strong> when you get a ticket or register, that event's organizer and their full team members can see your name, email, ticket details, seat, and check-in status. Vendor applicants' details are shared with the event's organizer and anyone they've made a vendor manager.</li>
          <li><strong>Sellers:</strong> when you buy a product, the seller sees your name, email, and the shipping address you entered.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Services that help us run TapIN">
        <p>We share information with these providers only as needed for them to perform services for us:</p>
        <ul>
          <li><strong>Supabase:</strong> hosting, database, sign-in, and file storage.</li>
          <li><strong>Stripe:</strong> payment processing, refunds, and payouts.</li>
          <li><strong>Resend:</strong> sending emails such as tickets, confirmations, and notifications.</li>
          <li><strong>Gumlet:</strong> hosting and streaming videos posted to the feed.</li>
          <li><strong>Anthropic:</strong> AI features. When you use them, the text, flyer images, or web pages you provide are processed to generate descriptions, fill in event details, or suggest flyer text.</li>
          <li><strong>Google:</strong> maps on event pages and web fonts.</li>
          <li><strong>OpenStreetMap:</strong> the Discover map and turning city names into map locations.</li>
          <li><strong>QuickChart:</strong> creating the QR code images in ticket emails (it receives your ticket's link).</li>
          <li><strong>Embedded media:</strong> when you play music or videos that creators have linked (Spotify, Apple Music, SoundCloud, YouTube, Vimeo, TikTok), those services load in your browser and their own privacy policies apply.</li>
        </ul>
        <p>We may also share information if required by law, to protect the rights and safety of TapIN or others, or as part of a merger or sale of the business (with this policy continuing to apply).</p>
        <p><strong>We do not sell or rent your personal information</strong>, and we don't share it for advertising.</p>
      </LegalSection>

      <LegalSection title="How long we keep information">
        <p>We keep your information while your account is active. If you delete your account, we delete or anonymize your personal information, except records we must keep for legal, tax, accounting, or fraud-prevention reasons (such as payment and ticket records), which we keep only as long as required.</p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul>
          <li>Edit your profile, make it private, and change notification settings in <Link to="/profile">Profile</Link>.</li>
          <li>Edit or delete your posts, events, and other content.</li>
          <li><strong>Delete your account:</strong> go to your Profile and choose <strong>Delete my account</strong>. It takes effect right away. If you can't sign in, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email address on your account.</li>
          <li>Depending on where you live, you may have the right to access, correct, delete, or get a copy of your personal information. Email us and we'll respond within the time the law requires. We won't treat you differently for making a request.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Children">
        <p>TapIN isn't directed to children under 13, and we don't knowingly collect personal information from them. If you believe a child under 13 has given us information, contact us and we'll delete it.</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>We use safeguards such as encrypted connections and access controls that limit who can see what. No system is perfectly secure, so please use a strong, private email account for signing in.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>We may update this policy. If we make significant changes, we'll let you know in the app or by email.</p>
        <p>Questions or requests? Contact TapIN LLC at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
