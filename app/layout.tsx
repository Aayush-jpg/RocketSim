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
    <html lang="en">
      <body className="noise-bg font-sans">
        {children}
      </body>
    </html>
  )
} 