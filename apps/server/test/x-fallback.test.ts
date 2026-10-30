import assert from 'node:assert/strict';
import test from 'node:test';
import { xFallbackUrl, renderXFallback } from '../src/infrastructure/x-fallback.js';
import { DefuddleArticleExtractor } from '../src/infrastructure/defuddle-article-extractor.js';

test('fallback accepts only X status URLs and sends just the ID', () => {
  assert.equal(xFallbackUrl('https://x.com/name/status/123?s=secret'), 'https://api.fxtwitter.com/status/123');
  assert.equal(xFallbackUrl('https://twitter.com/i/web/status/123'), 'https://api.fxtwitter.com/status/123');
  assert.equal(xFallbackUrl('https://evil.com/name/status/123'), undefined);
  assert.equal(xFallbackUrl('https://x.com/home'), undefined);
});

test('long X content survives extraction with paragraphs and safe media', async () => {
  const text = '长帖 <script>alert(1)</script>\n\n' + '完整内容😀\n'.repeat(200) + '\n15. 最后一项';
  const html = renderXFallback({ code: 200, tweet: { id: '123', text,
    media: { photos: [{ url: 'https://pbs.twimg.com/media/a.jpg' }, { url: 'http://127.0.0.1/a' }] },
  } }, 'https://x.com/name/status/123');
  const article = await new DefuddleArticleExtractor('zh-CN').extract({ html, finalUrl: 'https://x.com/name/status/123' }, {
    id: 'x', apiVersion: '1', name: 'X', priority: 100, match: { hostnames: ['x.com'] }, extraction: { openGraphContent: true },
  });
  assert.ok(article.html.includes('15. 最后一项'));
  assert.ok(article.html.includes('pbs.twimg.com/media/a.jpg'));
  assert.ok(!article.html.includes('127.0.0.1'));
  assert.ok(!article.html.includes('<script>'));
  assert.ok(article.html.includes('FxTwitter'));
});

test('invalid, unavailable or mismatched posts never become successful notes', () => {
  for (const payload of [null, { code: 404 }, { code: 200, tweet: { id: '456', text: 'wrong' } }, { code: 200, tweet: { id: '123', text: '' } }]) {
    assert.throws(() => renderXFallback(payload, 'https://x.com/name/status/123'));
  }
});
