import React, { useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, Undo2, GitCommit, Rocket, FolderOpen } from 'lucide-react';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function VersionHistoryTab() {
  const { 
    rocketVersions, 
    isLoadingVersions, 
    loadRocketVersions, 
    revertToVersion,
    loadRocketVersion,
    rocket,
    savedRockets,
    currentProject,
    isDatabaseConnected
  } = useRocket();

  // Check if we're in a project context
  const isInProject = currentProject && rocket.project_id === currentProject.id;
  const isNewProject = !currentProject || !isInProject;

  useEffect(() => {
    if (isDatabaseConnected && isInProject) {
      // Load versions for the current project rocket
      loadRocketVersions();
    }
  }, [loadRocketVersions, isDatabaseConnected, isInProject, rocket.id, currentProject?.id]);

  const handleRevert = (versionId: string) => {
    if (window.confirm('Are you sure you want to revert to this version? This will create a new version with the reverted design.')) {
      revertToVersion(versionId);
    }
  };

  const handleLoadVersion = (versionId: string) => {
    console.log('Loading version:', versionId, 'for rocket:', rocket.id);
    loadRocketVersion(versionId, rocket.id);
  };

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto w-full">
      {/* Close button */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Version History</h3>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('closeAnalysis'))}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Current Project/Rocket Info */}
      <div className="bg-black/40 rounded-lg border border-gray-600/30 p-4">
        <h4 className="font-medium text-gray-100 mb-2 flex items-center gap-2">
          {isInProject ? (
            <>
              <FolderOpen className="w-4 h-4" />
              Project: {currentProject.name}
            </>
          ) : (
            <>
              <GitCommit className="w-4 h-4" />
              Current Design
            </>
          )}
        </h4>
        <p className="text-sm text-gray-200">{rocket.name}</p>
        <p className="text-xs text-gray-400 mt-1">
          {(rocket.nose_cone ? 1 : 0) + rocket.body_tubes.length + rocket.fins.length + rocket.parachutes.length + (rocket.motor ? 1 : 0)} parts • {rocket.motor.motor_database_id} • {isNewProject ? 'No project' : 'Project rocket'}
        </p>
      </div>

      {/* Version History */}
      <div className="space-y-4">
        <h4 className="font-medium text-white mb-4">
          {isInProject ? `Project Version History (${rocketVersions.length})` : 'Version History (0)'}
        </h4>

        {!isDatabaseConnected ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">Database not connected</p>
            <p className="text-xs opacity-70">
              Version history requires database connection
            </p>
          </div>
        ) : isNewProject ? (
          <div className="text-center py-8 text-gray-400">
            <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">Not in a project</p>
            <p className="text-xs opacity-70">
              Select or create a project to track version history.<br/>
              Projects group related rocket designs and conversations.
            </p>
          </div>
        ) : isLoadingVersions ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading version history...</p>
          </div>
        ) : rocketVersions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">No version history yet</p>
            <p className="text-xs opacity-70">
              Make changes to your rocket design to create version history
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rocketVersions.map((version, index) => (
              <Card key={version.id} className="p-4 bg-white/5 border-white/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-white">
                        Version {version.version_number}
                      </span>
                      {version.is_current && (
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-2">
                      {version.description || version.name}
                    </p>
                    
                    {version.created_by_action && (
                      <div className="text-xs text-gray-400 mb-2">
                        Action: {version.created_by_action.replace('_', ' ')}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(version.created_at)}
                      </span>
                      <span>{version.motor_id}</span>
                      <span>
                        {(() => {
                          try {
                            // Handle both string and already-parsed object cases
                            const parts = typeof version.parts === 'string' 
                              ? JSON.parse(version.parts) 
                              : version.parts;
                            return Array.isArray(parts) ? parts.length : 0;
                          } catch (error) {
                            console.warn('Failed to parse version parts:', error);
                            return 0;
                          }
                        })()} parts
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadVersion(version.id)}
                      className="text-xs bg-white/5 border-white/20 hover:bg-white/10"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevert(version.id)}
                      className="text-xs bg-white/5 border-white/20 hover:bg-white/10"
                      disabled={version.is_current}
                    >
                      <Undo2 className="w-3 h-3 mr-1" />
                      Revert
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h4 className="font-medium text-white mb-2">About Version History</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Every AI modification creates a new version</li>
          <li>• Revert to any previous design state</li>
          <li>• Version history is preserved across sessions</li>
          <li>• Reverting creates a new version (non-destructive)</li>
          <li>• {isNewProject ? 'Select a project to enable version tracking' : 'Each project has its own version history'}</li>
        </ul>
      </div>
    </div>
  );
} 