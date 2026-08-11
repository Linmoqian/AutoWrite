import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CreateNovel from "@/pages/CreateNovel";
import Outline from "@/pages/Outline";
import Chapters from "@/pages/Chapters";
import Illustrations from "@/pages/Illustrations";
import Export from "@/pages/Export";
import Settings from "@/pages/Settings";

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
