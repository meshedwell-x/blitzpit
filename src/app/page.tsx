'use client';

import dynamic from 'next/dynamic';

const GameUI = dynamic(() => import('../components/GameUI'), { ssr: false });

export default function Home() {
  return <GameUI />;
}
