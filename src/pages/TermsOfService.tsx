import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, LEGAL_EFFECTIVE, LegalPage, LegalSection } from '../components/LegalPage';

// Plain-language Terms of Service reflecting how TapIN works.
// NOTE: draft for TapIN LLC to have reviewed by an attorney before relying on it.
export default function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={LEGAL_EFFECTIVE}
      intro={
        <p>
          These terms are an agreement between you and <strong>TapIN LLC</strong> ("TapIN," "we," "us"), a North Carolina company, covering your use of the TapIN2Events website and apps
          (the "Service"). By creating an account or using the Service, you agree to these terms, our <Link to="/privacy" className="font-medium text-marigold hover:underline">Privacy Policy</Link>, and
          our <Link to="/refund-policy" className="font-medium text-marigold hover:underline">Refund Policy</Link>.
        </p>
      }
    >
      <LegalSection title="1. What TapIN is">
        <p>TapIN is a platform that helps people discover events, and helps organizers, artists, vendors, and sellers list events, sell tickets and merchandise, share videos, and connect.
          Unless an event page says otherwise, <strong>TapIN is not the organizer of events listed on the Service</strong>. Organizers are responsible for their events.</p>
      </LegalSection>

      <LegalSection title="2. Who can use TapIN">
        <p>You must be at least 13 years old to use the Service. You must be at least 18 (or the age of majority where you live) to buy tickets or products, organize events, sell, apply as a vendor,
          or receive payouts. If you're between 13 and 17, you may use the Service only with a parent or guardian's permission, and a parent or guardian must make any purchases.</p>
      </LegalSection>

      <LegalSection title="3. Your account">
        <p>Keep your account information accurate and your sign-in secure. You're responsible for activity on your account. Tell us right away at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you think someone else has accessed it.</p>
      </LegalSection>

      <LegalSection title="4. Organizers, resources, and sellers">
        <p>If you list an event, offer services as a resource, sell products, or accept vendors, you agree to:</p>
        <ul>
          <li>Describe your event, services, or products accurately, including dates, prices, and location.</li>
          <li>Hold the event or deliver what you sold, and follow all laws that apply to you, including permits, venue rules, safety requirements, and taxes.</li>
          <li>Handle attendee, vendor, and customer questions and complaints about your event or products.</li>
          <li>Only post or import events you run or have permission to post.</li>
          <li>Use attendee information you receive only to run your event and communicate about it.</li>
        </ul>
        <p>Disputes between users (for example, between an organizer and a vendor or a buyer and a seller) are between those users, though we may help where we can.</p>
      </LegalSection>

      <LegalSection title="5. Payments, fees, and payouts">
        <p>Payments on TapIN are processed by <strong>Stripe</strong>. We don't store your full card number. Buyers pay the listed price plus service and processing fees, which are shown before you pay.</p>
        <p><strong>Getting paid.</strong> Organizers, sellers, and creators receive payouts through a Stripe account connected to TapIN. Payment processing services for these accounts are provided by Stripe and are subject to the{' '}
          <a href="https://stripe.com/legal/connect-account" target="_blank" rel="noopener noreferrer">Stripe Connected Account Agreement</a>, which includes the{' '}
          <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener noreferrer">Stripe Services Agreement</a>. By agreeing to these terms or continuing to receive payouts, you agree to be bound by those Stripe agreements, as Stripe may modify them. You authorize TapIN to share information about you and your transactions with Stripe as needed for Stripe to provide its services.</p>
        <p><strong>Refunds and reversals.</strong> If you cancel an event or a sale is refunded, reversed, or disputed, you authorize TapIN to reverse or recover the related payout from your Stripe account to fund the refund, as described in our Refund Policy. If your Stripe balance can't cover a refund you owe, you remain responsible for it.</p>
      </LegalSection>

      <LegalSection title="6. Refunds">
        <p>Refunds follow our <Link to="/refund-policy">Refund Policy</Link>. In short: service and processing fees are non-refundable, and if an organizer cancels an event, buyers are refunded the ticket price.</p>
      </LegalSection>

      <LegalSection title="7. Your content">
        <p>You keep ownership of what you post, including events, photos, videos, comments, and profile information ("your content"). You give TapIN a worldwide, non-exclusive, royalty-free license to host, store, display, reproduce, adapt (for example, resize or transcode), and distribute your content in order to operate, improve, and promote the Service. This license ends when you delete your content, except where it has been shared by others or where we must keep it for legal reasons.</p>
        <p>You're responsible for your content and confirm you have the rights needed to post it, including rights to music, images, and videos, and permission from people shown in it.</p>
      </LegalSection>

      <LegalSection title="8. Things you may not do">
        <ul>
          <li>Break the law, or post content that's illegal, fraudulent, hateful, harassing, threatening, or sexually explicit.</li>
          <li>List fake events, sell tickets you can't honor, or misrepresent yourself or your business.</li>
          <li>Post content that infringes someone else's copyright, trademark, privacy, or other rights.</li>
          <li>Spam, scrape, or collect other users' information without permission.</li>
          <li>Interfere with the Service, try to get around its security, or access it in unauthorized ways.</li>
          <li>Use the Service to buy tickets for resale in violation of an organizer's rules or the law.</li>
        </ul>
        <p>You can report posts and comments in the app. We may remove content or restrict accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="9. Copyright complaints">
        <p>If you believe content on TapIN infringes your copyright, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with: your contact information; a description of the copyrighted work; the link to the content you believe infringes; a statement that you have a good-faith belief the use isn't authorized; a statement, under penalty of perjury, that your notice is accurate and that you're the owner or authorized to act for the owner; and your physical or electronic signature. We'll respond and may remove the content. We may disable accounts of repeat infringers.</p>
      </LegalSection>

      <LegalSection title="10. AI features">
        <p>Some features use artificial intelligence, such as writing event descriptions, reading flyers, importing events from a link, and suggesting flyer text. AI output can be wrong or incomplete. Review it before publishing; you're responsible for what you publish.</p>
      </LegalSection>

      <LegalSection title="11. Other services">
        <p>The Service links to or embeds other services, such as Stripe, Eventbrite, Spotify, YouTube, and maps. Their own terms and privacy policies apply when you use them, and we're not responsible for them.</p>
      </LegalSection>

      <LegalSection title="12. Suspension and ending your account">
        <p>You can stop using TapIN at any time and ask us to delete your account. We may suspend or end access to the Service if you break these terms, create risk or legal exposure for TapIN or others, or if required by law. Sections that by their nature should continue (like payments owed, your content license for already-shared content, disclaimers, and limits of liability) continue after your account ends.</p>
      </LegalSection>

      <LegalSection title="13. Disclaimers">
        <p>The Service is provided "as is" and "as available." To the fullest extent the law allows, TapIN disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We don't guarantee that events will happen as described, that listings are accurate, or that the Service will be uninterrupted or error-free.</p>
      </LegalSection>

      <LegalSection title="14. Limits on liability">
        <p>To the fullest extent the law allows, TapIN won't be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or data, arising from your use of the Service or any event. TapIN's total liability for any claim related to the Service is limited to the greater of (a) the fees you paid to TapIN in the 12 months before the claim, or (b) $100.</p>
      </LegalSection>

      <LegalSection title="15. Your responsibility to us">
        <p>If you use the Service to organize events, sell, or post content, you agree to defend and hold TapIN harmless from claims arising from your events, products, content, or violation of these terms or the law.</p>
      </LegalSection>

      <LegalSection title="16. Governing law">
        <p>These terms are governed by the laws of the State of North Carolina, without regard to its conflict-of-law rules. Any dispute will be brought in the state or federal courts located in Wake County, North Carolina, and you consent to their jurisdiction.</p>
      </LegalSection>

      <LegalSection title="17. Changes and contact">
        <p>We may update these terms. If we make significant changes, we'll let you know in the app or by email. Continuing to use the Service after changes take effect means you accept them.</p>
        <p>Questions? Contact TapIN LLC at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
