import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Caustics Lab",
  description: "A browser sandbox for exploring surface-driven caustic light patterns.",
  metadataBase: new URL("https://next-sim.vercel.app/"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
