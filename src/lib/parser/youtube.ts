/**
 * YouTube parser - extracts video metadata and description
 */
import * as cheerio from 'cheerio';
import type { ParseStrategy, ParseInput, ParseResult, ParseMetadata } from './strategy';
import { SourceType } from '@prisma/client';

interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  type?: string;
  height?: number;
  width?: number;
  version?: string;
  provider_name?: string;
  provider_url?: string;
  thumbnail_height?: number;
  thumbnail_width?: number;
  thumbnail_url?: string;
  html?: string;
}

export class YouTubeStrategy implements ParseStrategy {
  name = 'YouTubeStrategy';

  canHandle(input: ParseInput): boolean {
    if (input.type !== 'WEBPAGE' && input.type !== 'TEXT') return false;
    const url = input.data as string;
    return this.isYouTubeUrl(url);
  }

  private isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/.test(url);
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  async execute(input: ParseInput): Promise<ParseResult> {
    const start = Date.now();
    const url = input.data as string;
    const videoId = this.extractVideoId(url);

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Fetch oEmbed data
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    let title = 'YouTube Video';
    let author = '';

    try {
      const response = await fetch(oembedUrl);
      if (response.ok) {
        const data: YouTubeOEmbedResponse = await response.json();
        title = data.title || title;
        author = data.author_name || '';
      }
    } catch (error) {
      console.warn('Failed to fetch YouTube oEmbed data:', error);
    }

    // Try to fetch description from page
    let description = '';
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (pageResponse.ok) {
        const html = await pageResponse.text();
        const $ = cheerio.load(html);

        // Try to extract description from meta tags
        description =
          $('meta[name="description"]').attr('content') ||
          $('meta[property="og:description"]').attr('content') ||
          '';
      }
    } catch (error) {
      console.warn('Failed to fetch YouTube page:', error);
    }

    // Build content
    const content = `# ${title}

${author ? `**Author:** ${author}\n` : ''}
**Video ID:** ${videoId}
**URL:** ${url}

${description ? `## Description\n\n${description}` : ''}

---
*Note: This is a YouTube video. Visit the URL to watch the full content.*
`;

    const metadata: ParseMetadata = {};
    if (author) metadata.author = author;

    return {
      title,
      content,
      sourceType: 'WEBPAGE' as SourceType,
      strategy: this.name,
      processingTime: Date.now() - start,
      metadata,
    };
  }
}
