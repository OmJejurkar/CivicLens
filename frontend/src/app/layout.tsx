import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MainLayout from "@/components/MainLayout";

export const metadata: Metadata = {
  title: "AI Meeting Co-Pilot | Government Leaders Dashboard",
  description: "AI-powered meeting summarization system for public leaders and government administrators. Transcribe, summarize, and track action items from official meetings.",
  keywords: "government, meeting, summarization, AI, co-pilot, minutes of meeting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0 }}>
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
