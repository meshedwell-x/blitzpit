import type { Metadata } from "next";
import dynamic from "next/dynamic";

const GameUI = dynamic(() => import("../../components/GameUI"), { ssr: false });

export const metadata: Metadata = {
  title: "BLITZPIT - Game Battle Royale Online Mien Phi | Khong Can Tai",
  description:
    "Choi BLITZPIT mien phi tren trinh duyet. Game battle royale khong can tai, khong can dang ky. Giong PUBG & Free Fire nhung choi ngay tren trinh duyet!",
  keywords:
    "game ban sung online, battle royale online, game mien phi, game sinh ton online, free fire alternative, pubg web, game online khong can tai, blitzpit",
  alternates: {
    canonical: "https://blitzpit.com/vi",
  },
  openGraph: {
    title: "BLITZPIT - Game Battle Royale Mien Phi",
    description:
      "Battle royale mien phi tren trinh duyet. Khong tai, khong dang ky. Choi ngay!",
    url: "https://blitzpit.com/vi",
    locale: "vi_VN",
  },
};

export default function VietnamPage() {
  return <GameUI />;
}
