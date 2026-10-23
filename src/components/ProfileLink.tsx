import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfileId, resolveProfileId, profilePathForId } from '../lib/profileLinks';

// A link to someone's public TapIN profile by account (/u/:id), given the email already on screen.
// The email never ends up in the link; until the account is known it still works (looks it up on tap).
export default function ProfileLink({ email, className, onClick, children, title }: {
  email: string | null | undefined; className?: string; onClick?: (e: MouseEvent) => void; children: ReactNode; title?: string;
}) {
  const id = useProfileId(email);
  const navigate = useNavigate();
  if (id) return <Link to={profilePathForId(id)} className={className} onClick={onClick} title={title}>{children}</Link>;
  if (id === null) return <span className={className} title={title}>{children}</span>; // no TapIN account
  return (
    <a href="#" className={className} title={title} onClick={async (e) => {
      e.preventDefault(); onClick?.(e);
      const found = await resolveProfileId(email);
      if (found) navigate(profilePathForId(found));
    }}>{children}</a>
  );
}
