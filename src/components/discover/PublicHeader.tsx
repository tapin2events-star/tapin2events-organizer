import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PublicHeader() {
  const { user } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/discover" className="font-display text-xl font-extrabold tracking-tight text-gray-900">
          TAP<span className="text-marigold">IN</span>
        </Link>
        {user ? (
          <Link
            to="/"
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold"
          >
            Organizer dashboard
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold"
          >
            Organizer sign in
          </Link>
        )}
      </div>
    </header>
  );
}
