import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/config-store";
import type { AppConfig } from "@/types";

export function useSettings() {
  const storeConfig = useConfigStore((s) => s.config);
  const refreshConfig = useConfigStore((s) => s.refreshConfig);
  const saveConfigAction = useConfigStore((s) => s.saveConfigAction);
  const saved = useConfigStore((s) => s.saved);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    if (storeConfig) setConfig(storeConfig);
  }, [storeConfig]);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) =>
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    const ok = await saveConfigAction(config);
    setSaving(false);
    if (ok) toast.success("配置已保存");
    else toast.error("保存失败");
  };

  return { config, saving, saved, update, handleSave };
}
