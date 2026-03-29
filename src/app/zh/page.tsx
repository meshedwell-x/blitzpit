import type { Metadata } from "next";
import dynamic from "next/dynamic";

const GameUI = dynamic(() => import("../../components/GameUI"), { ssr: false });

export const metadata: Metadata = {
  title: "BLITZPIT - 免费吃鸡网页游戏 | 无需下载 | 在线射击",
  description:
    "在浏览器中免费玩BLITZPIT。像素风格吃鸡大逃杀，无需下载，无需注册。手机电脑都能玩，即开即玩！",
  keywords:
    "吃鸡网页游戏, 大逃杀在线, 免费射击游戏, 在线游戏, 像素吃鸡, 方块大逃杀, 网页游戏免费, 多人在线射击, blitzpit",
  alternates: {
    canonical: "https://blitzpit.com/zh",
  },
  openGraph: {
    title: "BLITZPIT - 免费吃鸡网页游戏",
    description: "浏览器免费吃鸡大逃杀，无需下载，即开即玩！",
    url: "https://blitzpit.com/zh",
    locale: "zh_CN",
  },
};

export default function ChinesePage() {
  return <GameUI />;
}
