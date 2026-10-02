import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";

export const metadata: Metadata = {
  title: "Tenant GTO",
  description: "Capture tenant GTO sales, compare daily performance and project next week's turnover.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <ToastProvider>
          <WorkspaceProvider>
          <div className="md:flex">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </div>
          </WorkspaceProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
