import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CreateNovel from "./pages/CreateNovel";
import Outline from "./pages/Outline";
import Chapters from "./pages/Chapters";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateNovel />} />
            <Route path="/outline" element={<Outline />} />
            <Route path="/chapters" element={<Chapters />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ConfigProvider>
  );
}
