import type { Metadata } from "next";
import dynamic from "next/dynamic";

const GameUI = dynamic(() => import("../../components/GameUI"), { ssr: false });

export const metadata: Metadata = {
  title: "BLITZPIT - Game Battle Royale Gratis Online | Tanpa Download",
  description:
    "Main BLITZPIT gratis di browser. Game battle royale tanpa download, tanpa daftar. Mirip PUBG & Free Fire tapi langsung main di browser. HP & PC!",
  keywords:
    "game online gratis, battle royale online, game tembak tembakan online, game gratis tanpa download, free fire alternative, pubg web, game perang online, battle royale browser, game online multiplayer, blitzpit",
  alternates: {
    canonical: "https://blitzpit.com/id",
  },
  openGraph: {
    title: "BLITZPIT - Game Battle Royale Gratis di Browser",
    description:
      "Battle royale gratis di browser. Tanpa download, tanpa daftar. Langsung main!",
    url: "https://blitzpit.com/id",
    locale: "id_ID",
  },
};

export default function IndonesiaPage() {
  return <GameUI />;
}
