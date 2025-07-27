"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const contentSections = [
  {
    id: 1,
    scrollStart: 0,
    scrollEnd: 0.15,
    content: {
      title: "SpaceX showed us rockets could be cheaper",
      subtitle: "Now it's your turn to build one",
    },
  },
  {
    id: 2,
    scrollStart: 0.2,
    scrollEnd: 0.35,
    content: {
      title: "We're re-envisioning how anyone can build their own rockets",
      subtitle: "No PhD required. Just pure ambition.",
    },
  },
  {
    id: 3,
    scrollStart: 0.4,
    scrollEnd: 0.55,
    content: {
      title: "Humans are multilingual animals",
      subtitle: "We speak code, dreams, and rocket science",
    },
  },
  {
    id: 4,
    scrollStart: 0.6,
    scrollEnd: 0.75,
    content: {
      title: "Rocket design shouldn't be rocket science",
      subtitle: "We help you iterate fast, test quickly, fail forward",
    },
  },
  {
    id: 5,
    scrollStart: 0.8,
    scrollEnd: 0.95,
    content: {
      title: "We're very far from where we need to be",
      subtitle: "But trying doesn't hurt. And neither does dreaming big.",
    },
  },
]

export function ContentOverlay() {
  const router = useRouter()
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeSection, setActiveSection] = useState<number | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.min(window.scrollY / (document.body.scrollHeight - window.innerHeight), 1)
      setScrollProgress(progress)

      const active = contentSections.find((section) => progress >= section.scrollStart && progress <= section.scrollEnd)
      setActiveSection(active?.id || null)
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleStartBuilding = () => {
    router.push('/auth')
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      <button
        onClick={handleStartBuilding}
        className="fixed top-8 right-8 z-20 pointer-events-auto px-6 py-3 rounded-full bg-white/90 text-black font-sans font-light text-lg transition-all duration-500 hover:scale-105"
      >
        Build Now
      </button>
      {contentSections.map((section) => {
        const isActive = activeSection === section.id
        const opacity = isActive ? 0.7 : 0

        return (
          <div
            key={section.id}
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000"
            style={{ opacity }}
          >
            <div className="max-w-4xl mx-auto px-8 text-center">
              {/* Enhanced backdrop with spectacular glow */}
              <div className="p-12 rounded-3xl space-backdrop">
                <h1 className="text-white font-sans font-normal text-4xl md:text-6xl mb-6 leading-tight tracking-tight space-text-glow">
                  {section.content.title}
                </h1>
                <p className="text-white/90 font-sans font-light text-xl md:text-2xl leading-relaxed space-text-glow">
                  {section.content.subtitle}
                </p>
              </div>
            </div>
          </div>
        )
      })}

      {/* Enhanced Final CTA with spectacular glow */}
      {scrollProgress > 0.95 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="p-12 rounded-3xl space-backdrop">
              <h1 className="text-white/90 font-sans font-normal text-5xl md:text-7xl 
                mb-8 tracking-tight space-text-glow">
                Ready to launch?
              </h1>
              <button 
                onClick={handleStartBuilding}
                className="cosmic-button pointer-events-auto px-12 py-6 border-2 
                border-white/80 rounded-full text-white/90 font-sans font-light 
                text-xl transition-all duration-500 
                hover:bg-white/90 hover:text-black hover:scale-105 
                backdrop-blur-[2px]"
              >
                Start Building
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
