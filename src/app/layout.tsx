import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "AccessLink · Lối Tiếp Cận",
  description:
    "Bản demo NexRoute: tìm đúng lối tiếp cận địa điểm trong khu vực thi công.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
