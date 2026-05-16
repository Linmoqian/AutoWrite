import { message } from "antd";
import { testAiConnection } from "../services/tauri";

export async function checkConnection(): Promise<boolean> {
  try {
    const result = await testAiConnection();
    if (!result.connected) {
      message.error({
        content: result.error || "模型连接失败",
        duration: 5,
      });
      return false;
    }
    return true;
  } catch (e) {
    message.error({
      content: `连接检测失败: ${e}`,
      duration: 5,
    });
    return false;
  }
}
