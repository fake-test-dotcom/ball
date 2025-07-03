'use client';
import dynamic from 'next/dynamic';
const Game = dynamic(() => import('../components/Game'), { ssr: false });

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <Game />
    </main>
  );
}
