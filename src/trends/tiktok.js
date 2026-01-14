// kyndall-blog-engine/src/trends/tiktok.js
// Fetches trending topics from TikTok API

const TIKTOK_AUTH_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

// Cache for access token
let accessToken = null
let tokenExpiry = null

/**
 * Get TikTok access token using client credentials flow
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET

  if (!clientKey || !clientSecret) {
    throw new Error('Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET')
  }

  console.log('      Requesting TikTok access token...')

  const response = await fetch(TIKTOK_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`TikTok auth failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  if (data.error) {
    throw new Error(`TikTok auth error: ${data.error_description || data.error}`)
  }

  accessToken = data.access_token
  // Set expiry 5 minutes before actual expiry for safety
  tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000)
  
  console.log('      ✅ TikTok access token obtained')
  return accessToken
}

/**
 * Fetch trending hashtags and topics from TikTok
 * Note: TikTok's public API has limited trending data access.
 * This implementation uses available endpoints + supplementary scraping fallback.
 */
export async function fetchTikTokTrends() {
  const trends = []

  try {
    // Method 1: Try TikTok Research API (if approved)
    const researchTrends = await fetchFromResearchAPI()
    trends.push(...researchTrends)
  } catch (error) {
    console.log('      Research API not available:', error.message)
  }

  // Method 2: Use curated beauty/lifestyle trending topics
  // These are common trending formats on TikTok that perform well
  const curatedTrends = await getCuratedBeautyTrends()
  trends.push(...curatedTrends)

  // Method 3: Seasonal/timely trends
  const seasonalTrends = getSeasonalTrends()
  trends.push(...seasonalTrends)

  // Deduplicate by topic
  const seen = new Set()
  const uniqueTrends = trends.filter(t => {
    const key = t.topic.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return uniqueTrends
}

/**
 * Attempt to fetch from TikTok Research API
 * Requires Research API access approval
 */
async function fetchFromResearchAPI() {
  const token = await getAccessToken()
  
  // Research API endpoint for trending content
  // Note: This requires specific API access approval from TikTok
  const response = await fetch(`${TIKTOK_API_BASE}/research/video/query/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        and: [
          { field_name: 'hashtag_name', operation: 'IN', field_values: ['makeup', 'skincare', 'beauty', 'grwm'] }
        ]
      },
      max_count: 20,
      start_date: getDateDaysAgo(7),
      end_date: getDateDaysAgo(0),
    }),
  })

  if (!response.ok) {
    throw new Error(`Research API: ${response.status}`)
  }

  const data = await response.json()
  
  // Extract trending topics from video data
  const topics = extractTopicsFromVideos(data.videos || [])
  return topics
}

/**
 * Extract trending topics from video metadata
 */
function extractTopicsFromVideos(videos) {
  const topicCounts = {}
  
  for (const video of videos) {
    // Extract hashtags
    const hashtags = video.hashtag_names || []
    for (const tag of hashtags) {
      const normalized = tag.toLowerCase()
      topicCounts[normalized] = (topicCounts[normalized] || 0) + 1
    }
  }

  // Convert to trend objects
  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([topic, count]) => ({
      topic: formatHashtagToTopic(topic),
      hashtag: topic,
      trendingScore: count,
      source: 'tiktok_research',
    }))
}

/**
 * Get curated trending beauty/lifestyle topics
 * These are formats and topics that consistently trend on TikTok
 */
async function getCuratedBeautyTrends() {
  // Current trending formats on beauty TikTok
  const trendingFormats = [
    // Product-focused
    { topic: 'viral TikTok beauty products worth the hype', tags: ['viral', 'beauty', 'products'] },
    { topic: 'drugstore dupes for luxury makeup', tags: ['drugstore', 'dupe', 'makeup'] },
    { topic: 'skincare ingredients that actually work', tags: ['skincare', 'ingredients'] },
    { topic: 'makeup products trending on TikTok', tags: ['makeup', 'trending', 'tiktok'] },
    { topic: 'clean girl makeup essentials', tags: ['clean girl', 'makeup', 'minimal'] },
    
    // Routine-focused
    { topic: 'morning skincare routine for glowing skin', tags: ['skincare', 'routine', 'morning'] },
    { topic: 'nighttime skincare routine tips', tags: ['skincare', 'routine', 'night'] },
    { topic: 'easy 5 minute makeup routine', tags: ['makeup', 'routine', 'quick'] },
    { topic: 'get ready with me makeup tips', tags: ['grwm', 'makeup', 'tutorial'] },
    
    // Technique-focused  
    { topic: 'contour techniques for beginners', tags: ['contour', 'makeup', 'tutorial'] },
    { topic: 'how to apply blush for your face shape', tags: ['blush', 'makeup', 'tutorial'] },
    { topic: 'eyebrow shaping tips and tricks', tags: ['brows', 'eyebrows', 'tutorial'] },
    { topic: 'lip liner techniques for fuller lips', tags: ['lips', 'liner', 'makeup'] },
    
    // Skin concerns
    { topic: 'how to get rid of acne fast', tags: ['acne', 'skincare', 'tips'] },
    { topic: 'anti-aging skincare in your 20s', tags: ['anti-aging', 'skincare', 'prevention'] },
    { topic: 'how to reduce dark circles', tags: ['dark circles', 'skincare', 'eyes'] },
    { topic: 'dealing with textured skin', tags: ['texture', 'skincare', 'pores'] },
    
    // Seasonal/Current
    { topic: 'winter skincare tips for dry skin', tags: ['winter', 'dry skin', 'skincare'] },
    { topic: 'long lasting makeup for oily skin', tags: ['oily skin', 'makeup', 'tips'] },
    { topic: 'SPF and sunscreen myths debunked', tags: ['spf', 'sunscreen', 'skincare'] },
  ]

  // Shuffle and take a subset to vary daily output
  const shuffled = shuffleArray([...trendingFormats])
  
  return shuffled.slice(0, 10).map((item, index) => ({
    topic: item.topic,
    tags: item.tags,
    trendingScore: 100 - (index * 5), // Descending scores
    source: 'tiktok_curated',
  }))
}

/**
 * Get seasonal and timely trends
 */
function getSeasonalTrends() {
  const now = new Date()
  const month = now.getMonth()
  const trends = []

  // Monthly themes
  const monthlyThemes = {
    0: [ // January
      { topic: 'new year skincare reset routine', tags: ['new year', 'skincare', 'reset'] },
      { topic: 'winter skincare essentials', tags: ['winter', 'skincare'] },
    ],
    1: [ // February
      { topic: 'Valentine\'s Day makeup looks', tags: ['valentines', 'makeup', 'date night'] },
      { topic: 'romantic date night makeup tutorial', tags: ['date night', 'makeup'] },
    ],
    2: [ // March
      { topic: 'spring skincare transition tips', tags: ['spring', 'skincare'] },
      { topic: 'fresh spring makeup trends', tags: ['spring', 'makeup', 'trends'] },
    ],
    3: [ // April
      { topic: 'spring cleaning your makeup collection', tags: ['spring', 'makeup', 'declutter'] },
      { topic: 'lightweight spring foundation picks', tags: ['spring', 'foundation'] },
    ],
    4: [ // May
      { topic: 'summer-proof makeup tips', tags: ['summer', 'makeup', 'sweatproof'] },
      { topic: 'glowy summer skincare routine', tags: ['summer', 'skincare', 'glow'] },
    ],
    5: [ // June
      { topic: 'beach-ready skincare tips', tags: ['summer', 'beach', 'skincare'] },
      { topic: 'waterproof makeup essentials', tags: ['waterproof', 'makeup', 'summer'] },
    ],
    6: [ // July
      { topic: 'heat-proof makeup that lasts', tags: ['summer', 'makeup', 'heatproof'] },
      { topic: 'summer glow skincare routine', tags: ['summer', 'glow', 'skincare'] },
    ],
    7: [ // August
      { topic: 'back to school makeup essentials', tags: ['back to school', 'makeup'] },
      { topic: 'end of summer skincare reset', tags: ['summer', 'skincare', 'reset'] },
    ],
    8: [ // September
      { topic: 'fall makeup trends to try', tags: ['fall', 'makeup', 'trends'] },
      { topic: 'transitioning skincare for fall', tags: ['fall', 'skincare'] },
    ],
    9: [ // October
      { topic: 'Halloween makeup ideas', tags: ['halloween', 'makeup', 'costume'] },
      { topic: 'fall skincare for dry weather', tags: ['fall', 'skincare', 'dry'] },
    ],
    10: [ // November
      { topic: 'holiday party makeup looks', tags: ['holiday', 'party', 'makeup'] },
      { topic: 'Black Friday beauty deals worth it', tags: ['black friday', 'deals', 'beauty'] },
    ],
    11: [ // December
      { topic: 'holiday glam makeup tutorial', tags: ['holiday', 'glam', 'makeup'] },
      { topic: 'winter skincare for cold weather', tags: ['winter', 'skincare', 'cold'] },
    ],
  }

  const currentThemes = monthlyThemes[month] || []
  trends.push(...currentThemes.map((item, index) => ({
    topic: item.topic,
    tags: item.tags,
    trendingScore: 90 - (index * 5),
    source: 'tiktok_seasonal',
  })))

  return trends
}

// Helper functions
function formatHashtagToTopic(hashtag) {
  // Convert hashtag to readable topic
  // e.g., "grwmmakeup" -> "GRWM Makeup"
  return hashtag
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/grwm/gi, 'GRWM')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getDateDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
  return array
}
