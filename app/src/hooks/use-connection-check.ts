import { toast } from "sonner";
import { testAiConnection } from "@/services/tauri";

/**
 * AI 连接检测 hook。
 * 返回 checkConnection 函数，调用时测试连接并显示 Toast。
 */
export function useConnectionCheck() {
  const checkConnection = async (): Promise<boolean> => {
    try {
      const result = await testAiConnection();
      if (!result.connected) {
        toast.error(result.error || "模型连接失败，请检查配置");
        return false;
      }
      return true;
    } catch (e) {
      toast.error(`连接检测失败: ${e}`);
      return false;
    }
  };

  return { checkConnection };
}
