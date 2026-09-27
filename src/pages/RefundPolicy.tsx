import { Link } from 'react-router-dom';

// Plain-language refund policy reflecting how TapIN handles refunds.
// NOTE: draft for TapIN LLC to have reviewed by an attorney.
const UPDATED = 'September 27, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function RefundPolicy() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold text-bone">Refund Policy</h1>
      <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>

      <p className="mt-4 text-sm leading-relaxed text-gray-700">
        TapIN helps organizers sell tickets and vendor spots, and helps sellers offer merchandise. When you pay on TapIN, your purchase price goes to the organizer or seller,
        and the service and processing fees shown at checkout cover the cost of running TapIN and processing your payment.
      </p>

      <Section title="Service and processing fees">
        <p><strong>Service and processing fees are non-refundable</strong>, including when an event is cancelled.</p>
      </Section>

      <Section title="Tickets">
        <p><strong>If an organizer cancels an event,</strong> you'll be refunded the ticket price to your original payment method. You'll get a notification and an email when your refund is issued. Refunds usually appear within 5–10 business days.</p>
        <p><strong>For anything else</strong>, such as not being able to attend, refunds are up to the event organizer. Contact them from the event page.</p>
        <p><strong>Series passes</strong> cover several dates. If a single date is cancelled, the organizer handles any refund for that date.</p>
      </Section>

      <Section title="Vendor fees">
        <p><strong>If an event is cancelled,</strong> your vendor fee is refunded to your original payment method. Service and processing fees are non-refundable.</p>
        <p>For other situations, refunds are up to the event organizer.</p>
      </Section>

      <Section title="Merchandise">
        <p>Returns, exchanges, and refunds for merchandise are handled by the seller. Contact them about your order. Service and processing fees are non-refundable.</p>
      </Section>

      <Section title="Tips">
        <p>Tips are voluntary and go to the creator. They're generally non-refundable; if you made a mistake, contact us and we'll look into it.</p>
      </Section>

      <Section title="Events ticketed on other sites">
        <p>Some events on TapIN sell tickets through another site, such as Eventbrite. Refunds for those tickets follow that site's policy.</p>
      </Section>

      <Section title="Questions">
        <p>Contact us at <a href="mailto:tapin2events@gmail.com" className="font-medium text-marigold hover:underline">tapin2events@gmail.com</a>.</p>
      </Section>

      <p className="mt-8 text-sm"><Link to="/" className="font-medium text-marigold hover:underline">&larr; Back to TapIN</Link></p>
    </div>
  );
}
