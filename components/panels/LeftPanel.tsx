"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isCollapsed: boolean
  onCollapse: () => void
}

const mockProjects = [
  { id: 1, name: "Atlas V Replica", modified: "2h ago", status: "active" },
  { id: 2, name: "Model Rocket", modified: "1d ago", status: "draft" },
  { id: 3, name: "High Power", modified: "3d ago", status: "completed" },
]

const mockFiles = [
  { id: 1, name: "rocket-config.json", type: "config", size: "2.4 KB" },
  { id: 2, name: "simulation-data.csv", type: "data", size: "156 KB" },
  { id: 3, name: "flight-analysis.pdf", type: "report", size: "1.2 MB" },
]

export default function Sidebar({ isCollapsed, onCollapse }: SidebarProps) {
  const [activeSection, setActiveSection] = useState("projects")

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-black border-r border-white/5 flex flex-col items-center py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>

        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </Button>

          <Button variant="ghost" size="sm" className="p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
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
          <h1 className="text-xl font-semibold text-white">RocketSim</h1>
          <Button variant="ghost" size="sm" onClick={onCollapse} className="p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
          <Button
            variant={activeSection === "projects" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection("projects")}
            className="flex-1"
          >
            Projects
          </Button>
          <Button
            variant={activeSection === "files" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection("files")}
            className="flex-1"
          >
            Files
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === "projects" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Recent Projects</h2>
              <Button variant="ghost" size="sm" className="text-xs">
                New
              </Button>
            </div>

            <div className="space-y-3">
              {mockProjects.map((project) => (
                <Card key={project.id} className="p-4 hover-lift cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white text-sm">{project.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">{project.modified}</p>
                    </div>
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        project.status === "active" && "bg-green-400",
                        project.status === "draft" && "bg-yellow-400",
                        project.status === "completed" && "bg-gray-400",
                      )}
                    />
                  </div>
                </Card>
              ))}
            </div>

            <Button variant="secondary" className="w-full">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Project Files</h2>
              <Button variant="ghost" size="sm" className="text-xs">
                Upload
              </Button>
            </div>

            <div className="space-y-2">
              {mockFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{file.size}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">User</p>
            <p className="text-xs text-gray-400">Pro Plan</p>
          </div>
        </div>
      </div>
    </div>
  )
}
