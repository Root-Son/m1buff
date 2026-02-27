import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'M1버프 현황판',
  description: '호텔 예약 현황 대시보드',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
