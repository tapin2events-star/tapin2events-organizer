import { Link } from 'react-router-dom';
import { LegalPage, LegalSection } from '../components/LegalPage';

// Copyright & DMCA policy: TapIN's designated agent (as registered with the U.S. Copyright Office's DMCA Designated
// Agent Directory, October 28, 2026), how to send a takedown notice and a counter-notice, and the repeat-infringer
// policy. Keep the agent details identical to the Copyright Office registration.
// NOTE: draft for TapIN LLC to have reviewed by an attorney.
export const DMCA_AGENT = {
  name: 'Copyright Agent',
  company: 'TapIN LLC',
  address: '6134 Rogers Rd., Rolesville, NC 27571-9330',
  phone: '(919) 594-2700',
  email: 'dmca@tapin2events.com',
};

export default function CopyrightPolicy() {
  const a = DMCA_AGENT;
  return (
    <LegalPage title="Copyright & DMCA Policy" updated="October 28, 2026" intro={
      <p>TapIN respects the rights of artists, creators and copyright owners, and expects everyone using TapIN to do the same. This policy explains how to report content you believe infringes your copyright, how to respond if your content was removed, and how we handle repeat infringement, in line with the Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512.</p>
    }>
      <LegalSection title="Our designated agent">
        <p>Send copyright notices to TapIN&apos;s designated agent, as registered with the U.S. Copyright Office:</p>
        <address className="mt-1 rounded-xl border border-gray-200 bg-gray-50 p-4 not-italic leading-relaxed">
          <strong>{a.name}</strong><br />
          {a.company}<br />
          {a.address}<br />
          Phone: <a href={`tel:+1${a.phone.replace(/\D/g, '')}`} className="text-marigold underline">{a.phone}</a><br />
          Email: <a href={`mailto:${a.email}`} className="text-marigold underline">{a.email}</a>
        </address>
        <p>Email is the fastest way to reach us. This contact is only for copyright notices; for anything else, please use <a href="mailto:support@tapin2events.com" className="text-marigold underline">support@tapin2events.com</a>.</p>
      </LegalSection>

      <LegalSection title="Reporting copyright infringement (takedown notice)">
        <p>If you believe content on TapIN (such as a video, photo, music, artwork, event page or product listing) infringes your copyright, send our designated agent a written notice that includes:</p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>Your physical or electronic signature (as the copyright owner, or a person authorized to act for the owner).</li>
          <li>Identification of the copyrighted work you believe was infringed (or, for several works, a representative list).</li>
          <li>Identification of the material you believe is infringing, with enough information for us to find it, such as its link on TapIN.</li>
          <li>Your contact information: address, phone number and email.</li>
          <li>A statement that you have a good-faith belief the use isn&apos;t authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement that the information in your notice is accurate and, under penalty of perjury, that you&apos;re the copyright owner or authorized to act on the owner&apos;s behalf.</li>
        </ol>
        <p>When we receive a complete notice, we act quickly to remove the material or disable access to it, and we let the person who posted it know, including a copy of the notice where appropriate.</p>
      </LegalSection>

      <LegalSection title="If your content was removed (counter-notice)">
        <p>If you believe your content was removed by mistake or misidentification, you can send our designated agent a counter-notice that includes:</p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>Your physical or electronic signature.</li>
          <li>Identification of the material that was removed and where it appeared on TapIN before it was removed.</li>
          <li>A statement, under penalty of perjury, that you have a good-faith belief the material was removed as a result of mistake or misidentification.</li>
          <li>Your name, address and phone number, and a statement that you consent to the jurisdiction of the federal district court for your address (or, if you&apos;re outside the United States, any judicial district in which TapIN may be found), and that you&apos;ll accept service of process from the person who sent the original notice or their agent.</li>
        </ol>
        <p>When we receive a valid counter-notice, we send a copy to the person who sent the original notice. Unless they tell us they&apos;ve filed a court action to restrain the activity, we may restore the material in 10 to 14 business days.</p>
      </LegalSection>

      <LegalSection title="Repeat infringers">
        <p>We may remove content and, in appropriate circumstances, disable or terminate the accounts of people who repeatedly infringe others&apos; copyrights.</p>
      </LegalSection>

      <LegalSection title="Please be accurate">
        <p>Under the DMCA (17 U.S.C. § 512(f)), anyone who knowingly makes a material misrepresentation in a notice or counter-notice may be liable for damages. If you&apos;re not sure whether something infringes your rights, consider talking to a lawyer first.</p>
      </LegalSection>

      <p className="mt-6 text-sm text-gray-600">See also our <Link to="/terms" className="font-medium text-marigold hover:underline">Terms of Service</Link>.</p>
    </LegalPage>
  );
}
