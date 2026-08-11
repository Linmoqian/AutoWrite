/**
 * 过流式文本中的 <think> 标签。
 * 正则 /<think[\s\S]*?<\/think>/g 移除模型的思考过程。
 */
export function filterThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/g, "").trim();
}
