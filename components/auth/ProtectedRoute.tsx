import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Rocket } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  // Add timeout for loading state
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
      }, 12000); // 12 second timeout

      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);

  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Rocket className="w-12 h-12 text-cyan-500 animate-pulse mx-auto mb-4" />
          <p className="text-white text-lg">Initializing ROCKETv1...</p>
          <p className="text-gray-400 text-sm mt-2">Connecting to mission control</p>
          <div className="mt-4">
            <div className="w-48 bg-gray-700 rounded-full h-2 mx-auto">
              <div className="bg-cyan-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingTimeout) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Rocket className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-white text-lg">Connection Timeout</p>
          <p className="text-gray-400 text-sm mt-2">Loading is taking longer than expected</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Rocket className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg">Access Denied</p>
          <p className="text-gray-400 text-sm mt-2">Redirecting to authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 