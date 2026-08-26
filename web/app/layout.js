import "./globals.css";
import Providers from "@/components/Providers";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <ServiceWorkerRegistrar />
        </Providers>
      </body>
    </html>
  );
}
