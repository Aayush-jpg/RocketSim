import './globals.css'

export const metadata = {
  title: 'RocketSim - Undergraduate Rocket Engineering',
  description: 'Advanced rocket simulation platform for undergraduate engineers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="noise-bg font-sans min-h-screen bg-black text-white">
        {children}
      </body>
    </html>
  )
} 