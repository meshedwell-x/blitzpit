import type { Metadata } from "next";
import dynamic from "next/dynamic";

const GameUI = dynamic(() => import("../../components/GameUI"), { ssr: false });

export const metadata: Metadata = {
  title: "BLITZPIT - เกม Battle Royale ฟรี เล่นออนไลน์ ไม่ต้องดาวน์โหลด",
  description:
    "เล่น BLITZPIT ฟรีบนเบราว์เซอร์ เกม Battle Royale ไม่ต้องดาวน์โหลด ไม่ต้องสมัคร เหมือน PUBG และ Free Fire เล่นได้ทั้งมือถือและ PC!",
  keywords:
    "เกมออนไลน์ฟรี, battle royale online, เกมยิง, เกมเอาชีวิตรอด, free fire, pubg, เกมบราวเซอร์, blitzpit",
  alternates: {
    canonical: "https://blitzpit.com/th",
  },
  openGraph: {
    title: "BLITZPIT - เกม Battle Royale ฟรีบนเบราว์เซอร์",
    description:
      "Battle Royale ฟรีบนเบราว์เซอร์ ไม่ต้องดาวน์โหลด เล่นเลย!",
    url: "https://blitzpit.com/th",
    locale: "th_TH",
  },
};

export default function ThaiPage() {
  return <GameUI />;
}
