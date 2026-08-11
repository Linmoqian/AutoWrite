import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/features/dashboard";
import CreateNovel from "@/features/create-novel";
import Outline from "@/features/outline";
import Chapters from "@/features/chapters";
import Illustrations from "@/features/illustrations";
import Export from "@/features/export";
import Settings from "@/features/settings";

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateNovel />} />
          <Route path="/outline" element={<Outline />} />
          <Route path="/chapters" element={<Chapters />} />
          <Route path="/illustrations" element={<Illustrations />} />
          <Route path="/export" element={<Export />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <Toaster />
    </BrowserRouter>
  );
}
