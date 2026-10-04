import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YT Studio',
  description: 'Panel para extractor de YouTube, Media Hub, YouTube API y base de datos central',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
