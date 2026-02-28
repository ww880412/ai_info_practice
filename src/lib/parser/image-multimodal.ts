import { generateFromFile } from '../ai/generate';
import { z } from 'zod';
import type { ParseStrategy, ParseInput, ParseResult } from './strategy';
import { SourceType } from '@prisma/client';

const FileExtractSchema = z.object({
  title: z.string().optional().default("Image"),
  content: z.string().min(1, "Content cannot be empty"),
});

const EXTRACT_FROM_FILE_PROMPT = `提取这个文件/图片中的所有文字内容。

返回格式（严格 JSON，不要添加任何额外文字）：
{
  "title": "文档标题（从内容推断）",
  "content": "提取的完整文字内容（保留原始结构，使用 Markdown 格式）"
}

要求：
- 提取所有可见文字，不要遗漏
- 保留文章结构（标题、段落、列表、代码块等）
- 如果是截图，识别所有文字内容
- 不要进行总结或改写，忠实提取原文`;

export class ImageMultimodalStrategy implements ParseStrategy {
  name = 'ImageMultimodalStrategy';

  canHandle(input: ParseInput): boolean {
    return input.type === 'IMAGE';
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const buffer = input.data as Buffer;
    const base64 = buffer.toString('base64');

    const result = await generateFromFile(
      EXTRACT_FROM_FILE_PROMPT,
      { base64, mimeType: input.mimeType || 'image/png' },
      FileExtractSchema
    );

    return {
      title: result.title || 'Image',
      content: result.content,
      sourceType: 'TEXT' as SourceType,
      strategy: this.name,
      processingTime: Date.now() - start,
    };
  }
}
