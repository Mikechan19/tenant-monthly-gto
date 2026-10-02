import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AddSalesProvider } from "@/components/AddSales";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";

export const metadata: Metadata = {
  title: "Tenant GTO",
  description: "Capture tenant GTO sales, compare daily performance and project next week's turnover.",
  appleWebApp: { capable: true, title: "Tenant GTO", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets env(safe-area-inset-*) report the notch / home-indicator insets
  interactiveWidget: "resizes-content", // Android Chrome: keyboard shrinks the layout so sheets stay visible
  themeColor: "#0f766e",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <ToastProvider>
          <WorkspaceProvider>
          <AddSalesProvider>
            <div className="md:flex">
              <Sidebar />
              {/* Bottom padding on phones clears the fixed tab bar + floating Add Sales button. */}
              <main className="min-w-0 flex-1 px-4 pt-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-6 lg:px-8">
                <div className="mx-auto max-w-6xl">{children}</div>
              </main>
            </div>
          </AddSalesProvider>
          </WorkspaceProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
