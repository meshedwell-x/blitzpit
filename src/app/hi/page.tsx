import type { Metadata } from "next";
import dynamic from "next/dynamic";

const GameUI = dynamic(() => import("../../components/GameUI"), { ssr: false });

export const metadata: Metadata = {
  title: "BLITZPIT - Free Battle Royale Game Online | No Download | Hindi",
  description:
    "BLITZPIT - Browser mein free battle royale khelo. Koi download nahi chahiye. PUBG jaisa game browser mein. Mobile aur PC dono par chalega. Abhi khelo!",
  keywords:
    "battle royale online free, pubg alternative online, free fire alternative browser, shooting game online free, browser game no download, battle royale hindi, online shooting game india, free battle royale mobile, pubg web game, bgmi alternative, unblocked battle royale, blitzpit",
  alternates: {
    canonical: "https://blitzpit.com/hi",
  },
  openGraph: {
    title: "BLITZPIT - Free Battle Royale Browser Game",
    description:
      "Browser mein free battle royale. Download nahi, signup nahi. Bas khelo aur jeeto!",
    url: "https://blitzpit.com/hi",
    locale: "hi_IN",
  },
};

export default function HindiPage() {
  return <GameUI />;
}
