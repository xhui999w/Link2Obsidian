// Only public status IDs are sent to this fixed third-party endpoint. No cookies
// or API credentials are forwarded. Network access still uses our egress proxy.
export function xFallbackUrl(input: string): string | undefined {
  const url = new URL(input);
  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) return;
  const id = url.pathname.match(/^\/(?:[\w]+\/status|i\/web\/status)\/(\d+)(?:\/|$)/)?.[1];
  return id ? `https://api.fxtwitter.com/status/${id}` : undefined;
}

const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));

export function renderXFallback(payload: unknown, original: string): string {
  const data = payload as { code?: number; tweet?: {
    id?: string; text?: string; author?: { name?: string; screen_name?: string };
    media?: { photos?: { url?: string }[]; videos?: { url?: string }[] };
  } } | null;
  const tweet = data?.tweet;
  const expected = xFallbackUrl(original)?.split('/').pop();
  if (data?.code !== 200 || !tweet || !expected || tweet.id !== expected
    || typeof tweet.text !== 'string' || !tweet.text.trim()) {
    throw new Error('备用来源没有返回匹配的公开帖文正文');
  }
  const text = tweet.text;
  const title = `${Array.from(text.split('\n').find(line => line.trim()) ?? text).slice(0, 80).join('')} — ${tweet.author?.name ?? 'X'}`;
  const paragraphs = text.split(/\n\s*\n/).map(p => `<p>${escape(p).replaceAll('\n', '<br>')}</p>`).join('');
  const photos = (tweet.media?.photos ?? []).flatMap(photo => {
    try {
      const url = new URL(photo.url ?? '');
      return url.protocol === 'https:' && url.hostname === 'pbs.twimg.com'
        ? [`<img src="${escape(url.href)}">`] : [];
    } catch { return []; }
  }).join('');
  const videos = (tweet.media?.videos ?? []).flatMap(video => {
    try {
      const url = new URL(video.url ?? '');
      return url.protocol === 'https:' && url.hostname === 'video.twimg.com'
        ? [`<p><a href="${escape(url.href)}">视频原文件</a></p>`] : [];
    } catch { return []; }
  }).join('');
  return `<html><head><title>${escape(title)}</title><meta property="og:title" content="${escape(title)}"><meta property="og:site_name" content="X"></head><body><article data-l2o-x>${paragraphs}${photos}${videos}<p>采集来源：FxTwitter 公开接口；<a href="${escape(original)}">X 原帖</a>。视频保留链接。</p></article></body></html>`;
}
