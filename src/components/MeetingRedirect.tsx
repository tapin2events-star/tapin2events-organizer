import { Navigate, useParams } from 'react-router-dom';

// /meetings/:id (from meeting emails and calendar entries) opens the meeting page.
export default function MeetingRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/organizer/meetings/${id}`} replace />;
}
