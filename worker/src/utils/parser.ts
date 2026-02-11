import type { PodcastInfo } from '../types';

// PodcastIndex API credentials (free tier)
const PODCASTINDEX_API_KEY = 'XTGTHKULSGC3RMHP2YEP';
const PODCASTINDEX_API_SECRET = '$T^$JJpwn#Ry4cjbSqMvRyq$ccZJA#Lfr9K3WFkA';

export async function parseXiaoyuzhouUrl(url: string): Promise<PodcastInfo | null> {
  try {
    console.log('Parsing URL:', url);

    const episodeMatch = url.match(/episode\/(\w+)/);
    if (!episodeMatch) {
      console.error('Could not extract episode ID from URL');
      return null;
    }

    const episodeId = episodeMatch[1];
    console.log('Episode ID:', episodeId);

    // Method 1: iTunes + RSS approach (most reliable)
    console.log('Method 1: iTunes + RSS...');
    let info = await fetchFromiTunesAndRSS(url, episodeId);
    if (info?.audioUrl) {
      console.log('Success via iTunes + RSS');
      return info;
    }

    // Method 2: PodcastIndex API
    console.log('Method 2: PodcastIndex...');
    info = await fetchFromPodcastIndex(url, episodeId);
    if (info?.audioUrl) {
      console.log('Success via PodcastIndex');
      return info;
    }

    // Method 3: Xiaoyuzhou API
    console.log('Method 3: Xiaoyuzhou API...');
    info = await fetchFromXiaoyuzhouAPI(episodeId);
    if (info?.audioUrl) {
      console.log('Success via Xiaoyuzhou API');
      return info;
    }

    // Method 4: Web page parsing
    console.log('Method 4: Web page parsing...');
    info = await fetchFromWebPage(url, episodeId);
    if (info?.audioUrl) {
      console.log('Success via web page parsing');
      return info;
    }

    console.error('All methods failed');
    return null;
  } catch (error) {
    console.error('Parse error:', error);
    return null;
  }
}

// ============ Method 1: iTunes + RSS ============

async function fetchFromiTunesAndRSS(episodeUrl: string, episodeId: string): Promise<PodcastInfo | null> {
  try {
    const pageResponse = await fetch(episodeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!pageResponse.ok) {
      console.log('Failed to fetch episode page:', pageResponse.status);
      return null;
    }

    const html = await pageResponse.text();

    const episodeTitle = extractMetaContent(html, 'og:title') || extractTitle(html);
    if (!episodeTitle) {
      console.log('Could not extract episode title');
      return null;
    }

    // Parse podcast name from title (format: "单集标题 | 播客名称")
    let podcastName = '';
    let cleanEpisodeTitle = episodeTitle;

    const titleParts = episodeTitle.split(/\s*\|\s*|\s+-\s+/);
    if (titleParts.length >= 2) {
      podcastName = titleParts[titleParts.length - 1].trim();
      cleanEpisodeTitle = titleParts[0].trim();
    }

    if (!podcastName) {
      const podcastMatch = html.match(/"podcastTitle":"([^"]+)"/);
      if (podcastMatch) podcastName = podcastMatch[1];
    }

    console.log('Podcast:', podcastName, '| Episode:', cleanEpisodeTitle);

    // Search iTunes
    const searchTerm = podcastName || cleanEpisodeTitle;
    const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=podcast&limit=5`;
    const iTunesResponse = await fetch(iTunesUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });

    if (!iTunesResponse.ok) return null;

    const iTunesData = await iTunesResponse.json() as {
      resultCount: number;
      results: Array<{ collectionName: string; feedUrl: string; artworkUrl600?: string }>;
    };

    if (!iTunesData.results?.length) return null;

    // Find best match
    let bestMatch = iTunesData.results[0];
    if (podcastName) {
      for (const result of iTunesData.results) {
        if (result.collectionName.toLowerCase().includes(podcastName.toLowerCase()) ||
          podcastName.toLowerCase().includes(result.collectionName.toLowerCase())) {
          bestMatch = result;
          break;
        }
      }
    }

    if (!bestMatch.feedUrl) return null;

    // Fetch and parse RSS
    const rssResponse = await fetch(bestMatch.feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
    });

    if (!rssResponse.ok) return null;

    const rssContent = await rssResponse.text();
    const episodeInfo = parseRSSEpisode(rssContent, episodeId, cleanEpisodeTitle);

    if (episodeInfo?.audioUrl) {
      if (!episodeInfo.coverUrl && bestMatch.artworkUrl600) {
        episodeInfo.coverUrl = bestMatch.artworkUrl600;
      }
      return episodeInfo;
    }

    return null;
  } catch (error) {
    console.error('iTunes + RSS error:', error);
    return null;
  }
}

// ============ Method 2: PodcastIndex ============

async function fetchFromPodcastIndex(episodeUrl: string, episodeId: string): Promise<PodcastInfo | null> {
  try {
    // First extract episode info from the page
    const pageResponse = await fetch(episodeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!pageResponse.ok) return null;

    const html = await pageResponse.text();
    const episodeTitle = extractMetaContent(html, 'og:title') || extractTitle(html) || '';

    let podcastName = '';
    let cleanEpisodeTitle = episodeTitle;
    const titleParts = episodeTitle.split(/\s*\|\s*|\s+-\s+/);
    if (titleParts.length >= 2) {
      podcastName = titleParts[titleParts.length - 1].trim();
      cleanEpisodeTitle = titleParts[0].trim();
    }

    if (!podcastName) return null;

    // Generate PodcastIndex auth headers
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const authString = `${PODCASTINDEX_API_KEY}${PODCASTINDEX_API_SECRET}${apiHeaderTime}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(authString));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const headers = {
      'User-Agent': 'PodcastSummarizerApp/1.0',
      'X-Auth-Key': PODCASTINDEX_API_KEY,
      'X-Auth-Date': apiHeaderTime.toString(),
      'Authorization': hashHex,
    };

    // Search for podcast by name
    const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(podcastName)}`;
    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      console.log('PodcastIndex search failed:', searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json() as {
      feeds?: Array<{ id: number; title: string; url: string; image?: string }>;
    };

    if (!searchData.feeds?.length) {
      console.log('No feeds found in PodcastIndex');
      return null;
    }

    // Find best matching feed
    let bestFeed = searchData.feeds[0];
    for (const feed of searchData.feeds) {
      if (feed.title.toLowerCase().includes(podcastName.toLowerCase()) ||
        podcastName.toLowerCase().includes(feed.title.toLowerCase())) {
        bestFeed = feed;
        break;
      }
    }

    console.log('PodcastIndex feed:', bestFeed.title, 'id:', bestFeed.id);

    // Get episodes from this feed
    // Regenerate auth headers for new request
    const apiHeaderTime2 = Math.floor(Date.now() / 1000);
    const authString2 = `${PODCASTINDEX_API_KEY}${PODCASTINDEX_API_SECRET}${apiHeaderTime2}`;
    const hashBuffer2 = await crypto.subtle.digest('SHA-1', encoder.encode(authString2));
    const hashHex2 = Array.from(new Uint8Array(hashBuffer2)).map(b => b.toString(16).padStart(2, '0')).join('');

    const episodesUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${bestFeed.id}&max=100`;
    const episodesResponse = await fetch(episodesUrl, {
      headers: {
        ...headers,
        'X-Auth-Date': apiHeaderTime2.toString(),
        'Authorization': hashHex2,
      },
    });

    if (!episodesResponse.ok) return null;

    const episodesData = await episodesResponse.json() as {
      items?: Array<{
        title: string;
        enclosureUrl: string;
        description?: string;
        image?: string;
        duration?: number;
        feedImage?: string;
      }>;
    };

    if (!episodesData.items?.length) return null;

    // Find matching episode
    for (const ep of episodesData.items) {
      if (areTitlesSimilar(ep.title, cleanEpisodeTitle)) {
        console.log('PodcastIndex matched episode:', ep.title);
        return {
          title: ep.title,
          description: ep.description || '',
          coverUrl: ep.image || ep.feedImage || bestFeed.image || '',
          audioUrl: ep.enclosureUrl || '',
          duration: ep.duration || 0,
        };
      }
    }

    console.log('No matching episode found in PodcastIndex');
    return null;
  } catch (error) {
    console.error('PodcastIndex error:', error);
    return null;
  }
}

// ============ RSS Parsing ============

function parseRSSEpisode(rssContent: string, episodeId: string, episodeTitle: string): PodcastInfo | null {
  try {
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items: string[] = [];
    let match;

    while ((match = itemRegex.exec(rssContent)) !== null) {
      items.push(match[1]);
    }

    console.log('Found', items.length, 'items in RSS');

    for (const item of items) {
      const guid = extractTagContent(item, 'guid') || '';
      const title = extractTagContent(item, 'title') || '';
      const audioUrl = extractEnclosureUrl(item);

      const isMatch = guid.includes(episodeId) ||
        (episodeTitle && title && areTitlesSimilar(title, episodeTitle));

      if (isMatch && audioUrl) {
        console.log('RSS matched:', title);
        return buildEpisodeInfo(item, title, audioUrl);
      }
    }

    // Fallback: partial title match
    if (episodeTitle) {
      for (const item of items) {
        const title = extractTagContent(item, 'title') || '';
        const audioUrl = extractEnclosureUrl(item);

        if (audioUrl && areTitlesSimilar(title, episodeTitle)) {
          console.log('RSS partial match:', title);
          return buildEpisodeInfo(item, title, audioUrl);
        }
      }
    }

    return null;
  } catch (error) {
    console.error('RSS parse error:', error);
    return null;
  }
}

function buildEpisodeInfo(item: string, title: string, audioUrl: string): PodcastInfo {
  const description = extractTagContent(item, 'itunes:summary') ||
    extractTagContent(item, 'description') || '';

  const imageMatch = item.match(/<itunes:image[^>]+href="([^"]+)"/);
  const coverUrl = imageMatch ? imageMatch[1] : '';

  const durationStr = extractTagContent(item, 'itunes:duration') || '';
  const duration = parseDuration(durationStr);

  return { title, description: cleanText(description), coverUrl, audioUrl, duration };
}

// ============ Tag extraction (supports CDATA) ============

function extractTagContent(xml: string, tagName: string): string | null {
  // Handle namespaced tags: itunes:summary -> both <itunes:summary> and <itunes_summary>
  const variants = [tagName, tagName.replace(':', '_')];

  for (const tag of variants) {
    // Match with CDATA: <tag><![CDATA[content]]></tag>
    const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) return cleanText(cdataMatch[1]);

    // Match normal: <tag>content</tag>
    const normalRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const normalMatch = xml.match(normalRegex);
    if (normalMatch) return cleanText(normalMatch[1]);
  }

  return null;
}

function extractEnclosureUrl(item: string): string {
  const match = item.match(/<enclosure[^>]+url="([^"]+)"/);
  return match ? match[1] : '';
}

// ============ Method 3: Xiaoyuzhou API ============

async function fetchFromXiaoyuzhouAPI(episodeId: string): Promise<PodcastInfo | null> {
  try {
    const apiUrls = [
      `https://www.xiaoyuzhoufm.com/api/episode/${episodeId}`,
      `https://api.xiaoyuzhoufm.com/v1/episodes/${episodeId}`,
    ];

    for (const apiUrl of apiUrls) {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
            'Accept': 'application/json',
            'Referer': 'https://www.xiaoyuzhoufm.com/',
          },
        });

        if (!response.ok) continue;

        const data = await response.json() as any;
        const episode = data.data || data.episode || data;
        const audioUrl = episode?.mediaUrl || episode?.audio || episode?.audioUrl;

        if (audioUrl) {
          return {
            title: episode.title || 'Unknown',
            description: episode.description || '',
            coverUrl: episode.cover || episode.image || '',
            audioUrl,
            duration: episode.duration || 0,
          };
        }
      } catch { continue; }
    }

    return null;
  } catch (error) {
    console.error('API fetch error:', error);
    return null;
  }
}

// ============ Method 4: Web Page Parsing ============

async function fetchFromWebPage(url: string, _episodeId: string): Promise<PodcastInfo | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    return {
      title: extractMetaContent(html, 'og:title') || extractTitle(html) || 'Unknown',
      description: extractMetaContent(html, 'og:description') || '',
      coverUrl: extractMetaContent(html, 'og:image') || '',
      audioUrl: extractAudioUrl(html) || '',
      duration: extractDuration(html),
    };
  } catch (error) {
    console.error('Web page error:', error);
    return null;
  }
}

// ============ Utility Functions ============

function areTitlesSimilar(title1: string, title2: string): boolean {
  if (!title1 || !title2) return false;

  const normalize = (s: string) => s.toLowerCase().replace(/[\s\u3000]+/g, '').replace(/["""'']/g, '').trim();
  const t1 = normalize(title1);
  const t2 = normalize(title2);

  if (t1 === t2) return true;
  if (t1.includes(t2) || t2.includes(t1)) return true;

  // Compute Jaccard similarity on character bigrams
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
    return set;
  };

  const b1 = bigrams(t1);
  const b2 = bigrams(t2);

  if (b1.size === 0 || b2.size === 0) return false;

  let intersection = 0;
  for (const b of b1) {
    if (b2.has(b)) intersection++;
  }

  const union = b1.size + b2.size - intersection;
  const similarity = intersection / union;

  return similarity >= 0.4;
}

function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .trim();
}

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(durationStr, 10) || 0;
}

function extractMetaContent(html: string, property: string): string | null {
  // Try property="..." format
  const regex1 = new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]+)"`, 'i');
  const match1 = html.match(regex1);
  if (match1) return match1[1];

  // Try content="..." property="..." format
  const regex2 = new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${property}"`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractAudioUrl(html: string): string | null {
  const patterns = [
    /"mediaUrl"\s*:\s*"([^"]+)"/,
    /"audioUrl"\s*:\s*"([^"]+)"/,
    /"audio"\s*:\s*"([^"]+)"/,
    /"(https:\/\/[^"]*\.xiaoyuzhoufm\.com[^"]*\.mp3[^"]*)"/,
    /"(https:\/\/media\.xyzcdn\.net[^"]*\.mp3[^"]*)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractDuration(html: string): number {
  const patterns = [/"duration"\s*:\s*(\d+)/, /"durationInSeconds"\s*:\s*(\d+)/];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}
