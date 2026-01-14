// kyndall-blog-engine/src/trends/youtube.js
// Fetches trending topics from YouTube API

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * Fetch trending beauty/lifestyle topics from YouTube
 */
export async function fetchYouTubeTrends() {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY')
  }

  const trends = []

  // Method 1: Search for trending beauty videos
  const searchTrends = await searchTrendingVideos(apiKey)
  trends.push(...searchTrends)

  // Method 2: Get popular videos in beauty category
  const categoryTrends = await getPopularInCategory(apiKey)
  trends.push(...categoryTrends)

  // Method 3: Analyze trending search queries (from video titles)
  const titleTrends = extractTrendsFromTitles(trends)
  
  // Combine and deduplicate
  const allTrends = [...trends, ...titleTrends]
  const seen = new Set()
  const uniqueTrends = allTrends.filter(t => {
    const key = t.topic.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return uniqueTrends.slice(0, 20)
}

/**
 * Search for currently trending beauty videos
 */
async function searchTrendingVideos(apiKey) {
  const trends = []
  
  // Search queries that capture trending beauty content
  const searchQueries = [
    'beauty trends 2024',
    'makeup tutorial viral',
    'skincare routine trending',
    'grwm makeup',
    'drugstore makeup haul',
    'skincare products worth it',
    'makeup hacks tiktok',
    'viral beauty products',
  ]

  for (const query of searchQueries.slice(0, 3)) { // Limit API calls
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/search`)
      url.searchParams.set('key', apiKey)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('q', query)
      url.searchParams.set('type', 'video')
      url.searchParams.set('order', 'viewCount')
      url.searchParams.set('publishedAfter', getDateDaysAgo(14))
      url.searchParams.set('maxResults', '10')
      url.searchParams.set('relevanceLanguage', 'en')
      url.searchParams.set('videoCategoryId', '26') // Howto & Style category

      const response = await fetch(url)
      
      if (!response.ok) {
        console.log(`      YouTube search failed for "${query}": ${response.status}`)
        continue
      }

      const data = await response.json()
      
      for (const item of (data.items || [])) {
        const title = item.snippet?.title || ''
        const description = item.snippet?.description || ''
        
        // Extract topic from video title
        const topic = extractTopicFromTitle(title)
        if (topic) {
          trends.push({
            topic,
            originalTitle: title,
            videoId: item.id?.videoId,
            channelTitle: item.snippet?.channelTitle,
            publishedAt: item.snippet?.publishedAt,
            trendingScore: 80,
            source: 'youtube_search',
          })
        }
      }
    } catch (error) {
      console.log(`      YouTube search error for "${query}": ${error.message}`)
    }
  }

  return trends
}

/**
 * Get popular videos in Howto & Style category
 */
async function getPopularInCategory(apiKey) {
  const trends = []
  
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('chart', 'mostPopular')
    url.searchParams.set('regionCode', 'US')
    url.searchParams.set('videoCategoryId', '26') // Howto & Style
    url.searchParams.set('maxResults', '20')

    const response = await fetch(url)
    
    if (!response.ok) {
      console.log(`      YouTube category fetch failed: ${response.status}`)
      return trends
    }

    const data = await response.json()
    
    for (const item of (data.items || [])) {
      const title = item.snippet?.title || ''
      const viewCount = parseInt(item.statistics?.viewCount || '0')
      
      // Filter for beauty-related content
      if (isBeautyRelated(title)) {
        const topic = extractTopicFromTitle(title)
        if (topic) {
          trends.push({
            topic,
            originalTitle: title,
            videoId: item.id,
            channelTitle: item.snippet?.channelTitle,
            viewCount,
            trendingScore: Math.min(100, Math.floor(viewCount / 100000)),
            source: 'youtube_trending',
          })
        }
      }
    }
  } catch (error) {
    console.log(`      YouTube category error: ${error.message}`)
  }

  return trends
}

/**
 * Extract trending patterns from video titles
 */
function extractTrendsFromTitles(videos) {
  const patterns = {}
  
  // Common trending patterns to look for
  const patternMatchers = [
    /best\s+(\w+\s+\w+)/gi,
    /(\w+)\s+tutorial/gi,
    /(\w+)\s+routine/gi,
    /(\w+)\s+for\s+(\w+)/gi,
    /how\s+to\s+(\w+\s+\w+)/gi,
    /(\w+)\s+tips/gi,
    /(\w+)\s+hacks/gi,
    /viral\s+(\w+)/gi,
    /(\w+)\s+review/gi,
  ]

  for (const video of videos) {
    const title = (video.originalTitle || video.topic || '').toLowerCase()
    
    for (const pattern of patternMatchers) {
      const matches = title.matchAll(pattern)
      for (const match of matches) {
        const extracted = match[1] || match[0]
        if (extracted && extracted.length > 3) {
          patterns[extracted] = (patterns[extracted] || 0) + 1
        }
      }
    }
  }

  // Convert to trends
  return Object.entries(patterns)
    .filter(([topic, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({
      topic: formatTopic(topic),
      trendingScore: count * 20,
      source: 'youtube_extracted',
    }))
}

/**
 * Extract a clean topic from a video title
 */
function extractTopicFromTitle(title) {
  if (!title) return null
  
  // Remove common YouTube title patterns
  let cleaned = title
    .replace(/\|.*$/g, '') // Remove everything after |
    .replace(/\(.*?\)/g, '') // Remove parentheses content
    .replace(/\[.*?\]/g, '') // Remove bracket content
    .replace(/[-–—].*$/g, '') // Remove everything after dash
    .replace(/\d{4}/g, '') // Remove years
    .replace(/[!?]+/g, '') // Remove excessive punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  // If too long, try to extract the main topic
  if (cleaned.length > 60) {
    // Look for common patterns
    const patterns = [
      /^(.*?)\s+tutorial/i,
      /^(.*?)\s+routine/i,
      /^(.*?)\s+review/i,
      /^how\s+to\s+(.*?)(?:\s+in|$)/i,
      /^(.*?)\s+tips/i,
      /^my\s+(.*?)\s+routine/i,
    ]
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern)
      if (match && match[1]) {
        cleaned = match[1].trim()
        break
      }
    }
  }

  // Final cleanup
  cleaned = cleaned
    .replace(/^(my|the|a|an)\s+/i, '')
    .trim()

  if (cleaned.length < 5 || cleaned.length > 80) {
    return null
  }

  return formatTopic(cleaned)
}

/**
 * Check if title is beauty-related
 */
function isBeautyRelated(title) {
  const titleLower = title.toLowerCase()
  const beautyKeywords = [
    'makeup', 'skincare', 'beauty', 'cosmetic', 'skin', 'face', 'lips', 'eyes',
    'foundation', 'concealer', 'blush', 'bronzer', 'highlighter', 'mascara',
    'eyeshadow', 'lipstick', 'serum', 'moisturizer', 'spf', 'sunscreen',
    'retinol', 'cleanser', 'toner', 'acne', 'glow', 'contour', 'brow',
    'lash', 'nail', 'hair', 'grwm', 'routine', 'tutorial', 'drugstore',
    'sephora', 'ulta', 'glossier', 'charlotte tilbury', 'rare beauty',
  ]
  
  return beautyKeywords.some(keyword => titleLower.includes(keyword))
}

/**
 * Format topic for display
 */
function formatTopic(topic) {
  return topic
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Keep acronyms uppercase
      if (['grwm', 'spf', 'diy'].includes(word)) {
        return word.toUpperCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Get ISO date string for N days ago
 */
function getDateDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}
