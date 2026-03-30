import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://blitzpit.com";
const TITLE = "BLITZPIT - Free Battle Royale Browser Game | No Download";
const DESCRIPTION =
  "Play BLITZPIT free in your browser. Voxel battle royale with endless survival, no download required. Jump in, fight, survive. Works on mobile & PC.";
const KEYWORDS = [
  "battle royale online free",
  "battle royale no download",
  "free battle royale browser game",
  "browser shooting game",
  "online shooting game",
  "io game",
  "battle royale io",
  "fps browser game",
  "survival game online",
  "multiplayer browser game",
  "free online games",
  "pubg alternative online",
  "free fire alternative browser",
  "voxel game",
  "3d browser game",
  "blitzpit",
  "blitzpit unblocked",
  "battle royale game online free",
  "play battle royale online",
  "no download shooting game",
  "mobile battle royale browser",
  "war game online free",
  "games not blocked by school",
  "unblocked games",
].join(", ");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | BLITZPIT",
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  authors: [{ name: "BLITZPIT" }],
  creator: "BLITZPIT",
  publisher: "BLITZPIT",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "BLITZPIT",
    title: "BLITZPIT - Free Battle Royale Browser Game",
    description:
      "Endless voxel battle royale in your browser. No download. No signup. Just fight.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BLITZPIT - Free Battle Royale Browser Game",
    description:
      "Endless voxel battle royale in your browser. No download. Just fight.",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en": SITE_URL,
      "hi": `${SITE_URL}/hi`,
      "id": `${SITE_URL}/id`,
      "vi": `${SITE_URL}/vi`,
      "th": `${SITE_URL}/th`,
      "zh": `${SITE_URL}/zh`,
    },
  },
  category: "games",
  other: {
    "google-site-verification": "",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "BLITZPIT",
    "application-name": "BLITZPIT",
    "msapplication-TileColor": "#000000",
    "theme-color": "#000000",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "BLITZPIT",
  url: SITE_URL,
  description: DESCRIPTION,
  genre: ["Battle Royale", "Shooter", "Survival", "Action"],
  gamePlatform: ["Web Browser", "Mobile Browser", "PC", "Android", "iOS"],
  applicationCategory: "Game",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  playMode: ["SinglePlayer", "MultiPlayer"],
  numberOfPlayers: {
    "@type": "QuantitativeValue",
    minValue: 1,
    maxValue: 80,
  },
  inLanguage: ["en", "hi", "id", "vi", "th", "zh"],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is BLITZPIT free to play?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, BLITZPIT is 100% free to play in your browser. No download or signup required.",
      },
    },
    {
      "@type": "Question",
      name: "Can I play BLITZPIT on mobile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, BLITZPIT works on any mobile browser. Just visit blitzpit.com and start playing instantly.",
      },
    },
    {
      "@type": "Question",
      name: "Is BLITZPIT like PUBG or Free Fire?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BLITZPIT is a voxel-style battle royale similar to PUBG and Free Fire, but playable directly in your browser with no download needed. It features endless survival mode where the fight never stops.",
      },
    },
    {
      "@type": "Question",
      name: "Can I play BLITZPIT at school?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BLITZPIT is a browser game that works on any device with internet access. Visit blitzpit.com to play.",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
