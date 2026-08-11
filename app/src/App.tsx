import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { store, useAppDispatch } from "./store";
import { refreshAll } from "./store/appSlice";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CreateNovel from "./pages/CreateNovel";
import Outline from "./pages/Outline";
import Chapters from "./pages/Chapters";
import Illustrations from "./pages/Illustrations";
import Export from "./pages/Export";
import Settings from "./pages/Settings";

function AppInner() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(refreshAll());
  }, [dispatch]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#d4a574",
          colorBgContainer: "#191930",
          colorBgElevated: "#21213a",
          colorBgLayout: "#111120",
          colorBorder: "#2a2a42",
          colorBorderSecondary: "#353555",
          colorText: "#e2dcd0",
          colorTextSecondary: "#9b94a8",
          colorTextTertiary: "#5e5872",
          borderRadius: 8,
          fontFamily: '"Microsoft YaHei", "等线", "Segoe UI", sans-serif',
        },
        components: {
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "rgba(212, 165, 116, 0.12)",
            itemSelectedColor: "#d4a574",
            itemHoverBg: "#21213a",
            itemColor: "#9b94a8",
          },
          Card: {
            colorBgContainer: "#191930",
          },
          Progress: {
            remainingColor: "#21213a",
          },
        },
      }}
    >
      <BrowserRouter>
        <Layout>
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
        </Layout>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}
