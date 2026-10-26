import { describe, expect, it } from 'vitest';
import { slugify, tipSchema, videoEmbedUrl } from './content';

describe('slugify', () => {
  it('transliterates Turkish letters', () => {
    expect(slugify('Ölüdeniz Babadağ Uçuşu!')).toBe('oludeniz-babadag-ucusu');
    expect(slugify('  İyi Şanslar  ')).toBe('iyi-sanslar');
  });
});

describe('videoEmbedUrl', () => {
  it('supports YouTube and Vimeo links', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(videoEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789?dnt=1',
    );
  });
  it('rejects anything else', () => {
    expect(videoEmbedUrl('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedUrl('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedUrl('https://youtube.com/watch?v=<script>')).toBeNull();
    expect(videoEmbedUrl('not a url')).toBeNull();
  });
});

describe('tipSchema', () => {
  it('rejects unsupported video links', () => {
    const base = {
      title: 'Forward launch',
      locale: 'tr',
      body_md: 'Check your lines twice before every launch.',
      category: 'launching',
      difficulty: 'beginner',
    };
    expect(
      tipSchema.safeParse({ ...base, video_url: 'https://youtu.be/dQw4w9WgXcQ' }).success,
    ).toBe(true);
    expect(tipSchema.safeParse({ ...base, video_url: 'https://example.com/v' }).success).toBe(
      false,
    );
  });
});
