import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/app/components/theme-provider";
import { Metadata } from "next";
import Icon from "@/public/favicon.ico";
import Icon16 from "@/public/favicon-16x16.png";
import Icon32 from "@/public/favicon-32x32.png";

export const metadata: Metadata = {
  title: "TreeGPT",
  description: "AI-powered tree of thought exploration",
  icons: {
    icon: [
      { url: Icon.src },
      { url: Icon16.src, sizes: "16x16", type: "image/png" },
      { url: Icon32.src, sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
