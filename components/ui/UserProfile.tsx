import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  LogOut, 
  Settings, 
  Rocket, 
  MessageSquare, 
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function UserProfile() {
  const { user, userSession, signOut } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      toast({
        title: "Signed Out",
        description: "Successfully signed out of ROCKETv1.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get user display information from Google OAuth data
  const getUserDisplayName = () => {
    return user.user_metadata?.full_name || 
           user.user_metadata?.name || 
           user.user_metadata?.username || 
           user.email?.split('@')[0] || 
           'User';
  };

  const getUserAvatarUrl = () => {
    return user.user_metadata?.avatar_url || 
           user.user_metadata?.picture || 
           null;
  };

  const getInitials = (name: string) => {
    const displayName = getUserDisplayName();
    const words = displayName.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  };

  const getExperienceColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-500';
      case 'intermediate': return 'bg-yellow-500';
      case 'advanced': return 'bg-orange-500';
      case 'expert': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const displayName = getUserDisplayName();
  const avatarUrl = getUserAvatarUrl();
  const experienceLevel = user.user_metadata?.experience_level || 'beginner';

  return (
    <Card className="bg-black bg-opacity-60 border-gray-800 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 bg-cyan-600">
              {avatarUrl && (
                <AvatarImage 
                  src={avatarUrl} 
                  alt={displayName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-cyan-600 text-white">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-white text-sm">
                {displayName}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge 
                  className={`text-xs ${getExperienceColor(experienceLevel)} text-white`}
                >
                  {experienceLevel}
                </Badge>
                {userSession && (
                  <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                    Session Active
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <CardContent className="pt-0">
            {/* User Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-900 bg-opacity-50 rounded-lg">
                <Rocket className="w-5 h-5 text-cyan-500 mx-auto mb-1" />
                <div className="text-white text-lg font-semibold">
                  {userSession?.rocket_count || 0}
                </div>
                <div className="text-gray-400 text-xs">Rockets</div>
              </div>
              
              <div className="text-center p-3 bg-gray-900 bg-opacity-50 rounded-lg">
                <Activity className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <div className="text-white text-lg font-semibold">
                  {userSession?.simulation_count || 0}
                </div>
                <div className="text-gray-400 text-xs">Simulations</div>
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Email:</span>
                <span className="text-white truncate">{user.email}</span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-400">Provider:</span>
                <span className="text-white">Google</span>
              </div>
              
              {userSession && (
                <div className="flex items-center space-x-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Session:</span>
                  <span className="text-white text-xs font-mono">
                    {userSession.session_id.slice(-8)}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full text-red-400 border-red-600 hover:bg-red-900 hover:bg-opacity-20"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Sign Out
              </Button>
            </div>
          </CardContent>
        </motion.div>
      )}
    </Card>
  );
} 