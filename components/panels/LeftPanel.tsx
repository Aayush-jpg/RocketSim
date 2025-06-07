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
import { Project } from "@/types/rocket"
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
  ChevronRight,
  Folder,
  FolderOpen,
  Rocket,
  MoreHorizontal
} from "lucide-react"
import { cleanupOrphanedSessions, deleteProject } from '@/lib/services/database.service'
import { useAuth } from "@/lib/auth/AuthContext"

interface LeftPanelProps {
  isCollapsed: boolean
  onCollapse: () => void
  onProjectClick?: (projectId: string) => void
}

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateProject: (name: string, template: 'basic' | 'advanced' | 'sport') => void
}

function NewProjectDialog({ open, onOpenChange, onCreateProject }: NewProjectDialogProps) {
  const [name, setName] = useState("")
  const [template, setTemplate] = useState<'basic' | 'advanced' | 'sport'>('basic')

  const handleCreate = () => {
    if (name.trim()) {
      onCreateProject(name.trim(), template)
      setName("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Choose a name and template for your new rocket project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              placeholder="Enter project name..."
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
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectStatusBadge({ project }: { project: Project }) {
  const simCount = project.simulation_count || 0;
  if (simCount === 0) {
    return <Badge variant="secondary" className="text-xs">Draft</Badge>
  } else if (simCount >= 3) {
    return <Badge variant="default" className="text-xs bg-green-600">Tested</Badge>
  } else {
    return <Badge variant="default" className="text-xs bg-blue-600">Active</Badge>
  }
}

function getBadgeVariant(simCount: number): "default" | "secondary" | "destructive" | "outline" {
  if (simCount === 0) return "secondary";
  if (simCount >= 3) return "default";
  return "default";
}

function getProjectStatus(simCount: number): string {
  if (simCount === 0) return "Draft";
  if (simCount >= 3) return "Tested";
  return "Active";
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
  const { user } = useAuth()
  const { 
    isDatabaseConnected, 
    savedProjects, 
    currentProject,
    projectPagination,
    loadUserProjects,
    loadMoreProjects,
    loadProject,
    createAndLoadNewProject
  } = useRocket()
  
  const [newProjectDialog, setNewProjectDialog] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load panel data when component mounts and database connects
  useEffect(() => {
    console.log('🔍 LeftPanel useEffect: isDatabaseConnected:', isDatabaseConnected);
    console.log('🔍 LeftPanel useEffect: savedProjects length:', savedProjects.length);
    console.log('🔍 LeftPanel useEffect: isLoadingMore:', projectPagination.isLoadingMore);
    
    let isMounted = true; // Track if component is still mounted
    let debounceTimeout: NodeJS.Timeout | null = null;
    
    const debouncedLoadProjects = () => {
      // Clear any existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Debounce the load call to prevent rapid successive calls
      debounceTimeout = setTimeout(() => {
        if (isMounted && isDatabaseConnected) {
          console.log('🔍 LeftPanel useEffect: Database connected, calling loadUserProjects()');
          loadUserProjects();
        }
        debounceTimeout = null;
      }, 300); // 300ms debounce
    };
    
    if (isDatabaseConnected) {
      debouncedLoadProjects();
    } else {
      console.log('🔍 LeftPanel useEffect: Database not connected, skipping project load');
    }
    
    return () => {
      isMounted = false;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [isDatabaseConnected]) // Remove loadUserProjects from dependencies to prevent infinite loops

  const handleCreateProject = async (name: string, template: 'basic' | 'advanced' | 'sport') => {
    await createAndLoadNewProject(name, template)
    await loadUserProjects() // Refresh to show new project in list
  }

  const handleLoadProject = (project: Project) => {
    console.log('🚀 Loading project:', project.name, 'ID:', project.id)
    // Load the project in the store (this will load latest rocket and chat history)
    loadProject(project.id)
    
    // Notify parent component that a project was clicked so it can load project-specific chat
    if (onProjectClick) {
      onProjectClick(project.id)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    const project = savedProjects.find(p => p.id === projectId);
    const projectName = project?.name || 'this project';
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${projectName}"?\n\n` +
      `This will permanently delete:\n` +
      `• All rocket designs in this project\n` +
      `• All conversation history\n` +
      `• All simulation data\n` +
      `• All version history\n\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      console.log('🗑️ Deleting project:', projectId, projectName);
      
      // Check if we're deleting the currently active project
      const isDeletingCurrentProject = currentProject?.id === projectId;
      
      // Delete the project from database
      const success = await deleteProject(projectId);
      
      if (success) {
        console.log('✅ Project deleted successfully');
        
        // If we deleted the current project, clear it from state
        if (isDeletingCurrentProject) {
          // Reset to default state - clear current project and create new default rocket
          await createAndLoadNewProject('Default Rocket', 'basic');
          useRocket.setState({ currentProject: null }); // Clear current project
        }
        
        // Refresh the projects list
        await loadUserProjects();
        
        // Show success message
        console.log(`Project "${projectName}" has been deleted.`);
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      
      // Show error message to user
      window.alert(
        `Failed to delete project "${projectName}".\n\n` +
        `Please try again. If the problem persists, contact support.`
      );
    }
  };

  const refreshPanelData = () => {
    setIsRefreshing(true);
    loadUserProjects().finally(() => setIsRefreshing(false));
  };

  const handleCleanupSessions = async () => {
    setIsRefreshing(true);
    try {
      const cleaned = await cleanupOrphanedSessions();
      if (cleaned) {
        console.log('Orphaned sessions cleaned up');
        refreshPanelData();
      }
    } catch (error) {
      console.error('Session cleanup failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Render the projects list
  const renderProjects = () => {
    if (!isDatabaseConnected) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Connecting to database...</p>
        </div>
      )
    }

    if (savedProjects.length === 0 && !projectPagination.hasMore) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-4xl mb-2">🚀</div>
          <p>No projects yet.</p>
          <p className="text-sm">Create your first rocket project!</p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {savedProjects.map((project) => (
          <Card 
            key={project.id}
            className={cn(
              "p-3 cursor-pointer transition-all hover:shadow-md",
              currentProject?.id === project.id ? "border-blue-500 bg-blue-50/50" : "hover:border-blue-200"
            )}
            onClick={() => handleLoadProject(project)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm truncate">{project.name}</h3>
                  <Badge variant={getBadgeVariant(project.simulation_count || 0)} className="text-xs">
                    {getProjectStatus(project.simulation_count || 0)}
                  </Badge>
                </div>
                
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {project.description}
                  </p>
                )}
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Rocket className="h-3 w-3" />
                    <span>{project.rocket_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{project.message_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Updated {formatTimeAgo(project.updated_at)}</span>
                  </div>
                </div>
              </div>
              
              {/* Project actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleLoadProject(project);
                  }}>
                    <FileText className="h-3 w-3 mr-2" />
                    Open Project
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
        
        {/* Load More Button */}
        {projectPagination.hasMore && (
          <div className="pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={loadMoreProjects}
              disabled={projectPagination.isLoadingMore}
            >
              {projectPagination.isLoadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  Load More ({projectPagination.totalCount - savedProjects.length} remaining)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-black border-r border-white/5 flex flex-col items-center py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="p-2 relative">
            <Folder className="w-5 h-5" />
            {savedProjects.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                {savedProjects.length}
              </Badge>
            )}
          </Button>

          <Button variant="ghost" size="sm" className="p-2 relative">
            <BarChart3 className="w-5 h-5" />
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

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
            >
              <Folder className="w-4 h-4 mr-2" />
              Projects
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => setNewProjectDialog(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            New
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
        ) : projectPagination.isLoadingMore ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-sm">Loading...</p>
          </div>
        ) : (
          renderProjects()
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5">
        <UserProfile />
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog 
        open={newProjectDialog}
        onOpenChange={setNewProjectDialog}
        onCreateProject={handleCreateProject}
      />
    </div>
  )
}
