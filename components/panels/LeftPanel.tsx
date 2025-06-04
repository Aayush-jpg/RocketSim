"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useRocket } from "@/lib/store"
import { Rocket } from "@/types/rocket"
import UserProfile from "@/components/ui/UserProfile"
import { 
  Plus, 
  FileText, 
  MessageSquare, 
  BarChart3, 
  Trash2, 
  MoreVertical,
  Clock,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { cleanupOrphanedSessions } from '@/lib/services/database.service'

interface LeftPanelProps {
  isCollapsed: boolean
  onCollapse: () => void
  onProjectClick?: (projectId: string) => void
}

interface NewRocketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateRocket: (name: string, template: 'basic' | 'advanced' | 'sport') => void
}

function NewRocketDialog({ open, onOpenChange, onCreateRocket }: NewRocketDialogProps) {
  const [name, setName] = useState("")
  const [template, setTemplate] = useState<'basic' | 'advanced' | 'sport'>('basic')

  const handleCreate = () => {
    if (name.trim()) {
      onCreateRocket(name.trim(), template)
      setName("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Rocket</DialogTitle>
          <DialogDescription>
            Choose a name and template for your new rocket design.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rocket Name</label>
            <Input
              placeholder="Enter rocket name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="text-black"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'basic', label: 'Basic', desc: 'Simple design' },
                { key: 'advanced', label: 'Advanced', desc: 'Enhanced features' },
                { key: 'sport', label: 'Sport', desc: 'High performance' }
              ].map((t) => (
                <Button
                  key={t.key}
                  variant={template === t.key ? "default" : "outline"}
                  className="h-auto flex-col p-3"
                  onClick={() => setTemplate(t.key as typeof template)}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs opacity-70">{t.desc}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Rocket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RocketStatusBadge({ rocket, simulations }: { rocket: Rocket, simulations: any[] }) {
  const rocketSims = simulations.filter(sim => sim.rocket_id === rocket.id)
  
  if (rocketSims.length === 0) {
    return <Badge variant="secondary" className="text-xs">Draft</Badge>
  } else if (rocketSims.length >= 3) {
    return <Badge variant="default" className="text-xs bg-green-600">Tested</Badge>
  } else {
    return <Badge variant="default" className="text-xs bg-blue-600">Active</Badge>
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export default function LeftPanel({ isCollapsed, onCollapse, onProjectClick }: LeftPanelProps) {
  const { 
    savedRockets, 
    userSimulations, 
    userChatSessions, 
    userStats,
    isLoadingPanelData,
    isDatabaseConnected,
    loadRocket,
    createAndLoadNewRocket,
    deleteRocketFromList,
    loadPanelData,
    refreshPanelData
  } = useRocket()
  
  const [activeSection, setActiveSection] = useState("projects")
  const [showNewRocketDialog, setShowNewRocketDialog] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load panel data when component mounts and database connects
  useEffect(() => {
    if (isDatabaseConnected) {
      loadPanelData()
    }
  }, [isDatabaseConnected])

  const handleCreateRocket = async (name: string, template: 'basic' | 'advanced' | 'sport') => {
    await createAndLoadNewRocket(name, template)
    refreshPanelData() // Refresh to show new rocket in list
  }

  const handleLoadRocket = (rocket: Rocket) => {
    // Load the rocket in the 3D view
    loadRocket(rocket)
    
    // Notify parent component that a project was clicked so it can load project-specific chat
    if (onProjectClick) {
      onProjectClick(rocket.id)
    }
  }

  const handleDeleteRocket = async (rocketId: string) => {
    await deleteRocketFromList(rocketId)
    refreshPanelData()
  }

  const handleCleanupSessions = async () => {
    setIsRefreshing(true);
    try {
      const cleaned = await cleanupOrphanedSessions();
      if (cleaned) {
        console.log('Orphaned sessions cleaned up');
        // Show a brief success indicator
        const button = document.querySelector('[title="Clean up empty sessions"]');
        if (button) {
          const originalText = button.textContent;
          button.textContent = '✅';
          setTimeout(() => {
            button.textContent = originalText;
          }, 2000);
        }
        // Refresh the panel data after cleanup
        refreshPanelData();
      } else {
        // Show "no cleanup needed" indicator
        const button = document.querySelector('[title="Clean up empty sessions"]');
        if (button) {
          const originalText = button.textContent;
          button.textContent = '👍';
          setTimeout(() => {
            button.textContent = originalText;
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Session cleanup failed:', error);
      // Show error indicator
      const button = document.querySelector('[title="Clean up empty sessions"]');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '❌';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-black border-r border-white/5 flex flex-col items-center py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="p-2 relative">
            <FileText className="w-5 h-5" />
            {savedRockets.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                {savedRockets.length}
              </Badge>
            )}
          </Button>

          <Button variant="ghost" size="sm" className="p-2 relative">
            <BarChart3 className="w-5 h-5" />
            {userSimulations.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                {userSimulations.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 h-full bg-black border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-white">ROCKETv1</h1>
          <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation - Remove Files tab, only show Projects */}
        <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
          >
            <FileText className="w-4 h-4 mr-2" />
            Projects
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!isDatabaseConnected ? (
          <div className="text-center text-gray-400 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Database not connected</p>
            <p className="text-xs opacity-70">Running in offline mode</p>
          </div>
        ) : isLoadingPanelData ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-sm">Loading...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">
                Rocket Designs ({savedRockets.length})
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs"
                onClick={() => setShowNewRocketDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            {savedRockets.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm mb-2">No rocket designs yet</p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowNewRocketDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Rocket
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {savedRockets.map((rocket) => (
                  <Card key={rocket.id} className="p-4 hover-lift cursor-pointer group">
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1"
                        onClick={() => handleLoadRocket(rocket)}
                      >
                        <h3 className="font-medium text-white text-sm">{rocket.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {rocket.parts.length} parts • {rocket.motorId}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <RocketStatusBadge rocket={rocket} simulations={userSimulations} />
                          <span className="text-xs text-gray-500">
                            Modified recently
                          </span>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem 
                            onClick={() => handleLoadRocket(rocket)}
                          >
                            Open Project
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteRocket(rocket.id)}
                            className="text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5">
        <UserProfile />
      </div>

      {/* New Rocket Dialog */}
      <NewRocketDialog 
        open={showNewRocketDialog}
        onOpenChange={setShowNewRocketDialog}
        onCreateRocket={handleCreateRocket}
      />
    </div>
  )
}
