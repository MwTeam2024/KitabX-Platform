import { Merriweather, Nunito_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import InstallBanner from "@/components/pwa/InstallBanner";

// Self-hosted via next/font — feeds globals.css's `--font-display`/
// `--font-body` variables (see there for the fallback stack).
const merriweather = Merriweather({ subsets: ["latin"], weight: ["700"], variable: "--font-merriweather" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-nunito" });

export const metadata = {
  title: {
    default: "KitabX — Society Book Exchange",
    template: "%s",
  },
  description: "A community where books live, stories grow, and readers connect.",
  applicationName: "KitabX",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KitabX",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/user-scalable lock — pinch-zoom must stay available, and
  // locking it is what caused the iOS Safari zoom bug fixed in the prototype.
  viewportFit: "cover",
  themeColor: "#123D25",
};

// Chrome/Edge fire `beforeinstallprompt` ONCE, a few hundred ms after load —
// before the app's JavaScript has even run, so a listener added from React is too
// late and the "Add to Home Screen" button would never get the install prompt
// (confirmed: the event fired in a clean Chrome profile and the banner still
// showed the manual steps). This tiny inline script runs before any Next.js
// code, keeps the event, and components/pwa/InstallBanner.js picks it up.
const CAPTURE_INSTALL_PROMPT = `window.__kxInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__kxInstallPrompt=e;});`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${merriweather.variable} ${nunitoSans.variable}`}>
      <body>
        <Script id="capture-install-prompt" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALL_PROMPT }} />
        <Providers>
          {children}
          <ServiceWorkerRegistrar />
          <InstallBanner />
        </Providers>
      </body>
    </html>
  );
}
