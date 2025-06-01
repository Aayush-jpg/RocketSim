import './globals.css'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'ROCKETv1 - AI-Powered Rocket Engineering Platform',
  description: 'Advanced rocket simulation platform with AI-powered design assistance, real-time 3D visualization, and professional-grade physics simulation.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="noise-bg font-sans min-h-screen bg-black text-white">
        <AuthProvider>
          {children}
          <Toaster 
            position="top-right"
            theme="dark"
            richColors
            closeButton
          />
        </AuthProvider>
      </body>
    </html>
  )
} 