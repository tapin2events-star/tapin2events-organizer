import { Navigate, useLocation } from 'react-router-dom';

// Old address for My Activity: send people to /activity, keeping the #section.
export default function ActivityRedirect() {
  const { hash } = useLocation();
  return <Navigate to={`/activity${hash}`} replace />;
}
