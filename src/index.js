// kyndall-blog-engine/src/index.js
// Web server version - trigger via HTTP endpoint from Sanity Studio or cron service

import http from 'http'
import { fetchTikTokTrends } from './trends/tiktok.js'
import { fetchYouTubeTrends } from './trends/youtube.js'
import { fetchInstagramTrends } from './trends/instagram.js'
import { generateArticle } from './generator/article.js'
import { findRelatedContent } from './linker/internal.js'
import { initSanity, createDraftArticle, getRecentArticles } from './sanity.js'
import { searchUnsplashImage, trackDownload } from './images/unsplash.js'

// Configuration
const CONFIG = {
  articlesToGenerate: 5,
  trendSources: ['tiktok', 'youtube'],
  beautyKeywords: [
    'makeup', 'skincare', 'beauty', 'cosmetics', 'skin', 'face', 'lips', 'eyes',
    'foundation', 'concealer', 'blush', 'bronzer', 'highlighter', 'mascara',
    'eyeshadow', 'lipstick', 'skincare routine', 'serum', 'moisturizer', 'spf',
    'sunscreen', 'retinol', 'vitamin c', 'hyaluronic', 'niacinamide', 'cleanser',
    'toner', 'exfoliate', 'acne', 'anti-aging', 'glow', 'dewy', 'matte',
    'contour', 'brow', 'lash', 'nail', 'hair', 'hairstyle', 'haircare',
    'fashion', 'style', 'outfit', 'lifestyle', 'wellness', 'self-care',
    'grwm', 'get ready with me', 'tutorial', 'routine', 'favorites', 'drugstore',
    'luxury', 'dupe', 'viral', 'tiktok made me buy', 'holy grail', 'must have'
  ],
  minRelevanceScore: 0.1,
}

const PORT = process.env.PORT || 8080
const API_SECRET = process.env.API_SECRET || 'kyndall-blog-engine-secret'

// Track job status
let isRunning = false
let lastRunResult = null
let lastRunTime = null

// Initialize Sanity on startup
const sanityProjectId = process.env.SANITY_PROJECT_ID
const sanityDataset = process.env.SANITY_DATASET || 'production'
const sanityToken = process.env.SANITY_TOKEN

if (sanityProjectId && sanityToken) {
  initSanity(sanityProjectId, sanityDataset, sanityToken)
  console.log('✅ Sanity client initialized')
} else {
  console.error('⚠️ Missing Sanity credentials - will fail on run')
}

// ==================== MAIN GENERATION FUNCTION ====================

async function runArticleGeneration() {
  if (isRunning) {
    return { success: false, message: 'Job already running. Please wait.', status: 'busy' }
  }

  isRunning = true
  const startTime = Date.now()
  
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🚀 Kyndall Blog Engine - Starting article generation')
  console.log(`📅 ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST`)
  console.log('═══════════════════════════════════════════════════════════════')

  try {
    // Get recent articles to avoid duplicates
    const recentArticles = await getRecentArticles(30)
    const recentTopics = recentArticles.map(a => a.title?.toLowerCase() || '')
    console.log(`📚 Found ${recentArticles.length} recent articles to check against`)

    // Step 1: Fetch trending topics
    console.log('\n📊 STEP 1: Fetching trending topics...')
    
    const allTrends = []

    // TikTok trends
    if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) {
      console.log('\n🎵 Fetching TikTok trends...')
      try {
        const tiktokTrends = await fetchTikTokTrends()
        console.log(`   Found ${tiktokTrends.length} TikTok trends`)
        allTrends.push(...tiktokTrends.map(t => ({ ...t, platform: 'tiktok' })))
      } catch (error) {
        console.error('   ⚠️ TikTok fetch failed:', error.message)
      }
    } else {
      console.log('   ⏭️ Skipping TikTok (no credentials)')
    }

    // YouTube trends
    if (process.env.YOUTUBE_API_KEY) {
      console.log('\n📺 Fetching YouTube trends...')
      try {
        const youtubeTrends = await fetchYouTubeTrends()
        console.log(`   Found ${youtubeTrends.length} YouTube trends`)
        allTrends.push(...youtubeTrends.map(t => ({ ...t, platform: 'youtube' })))
      } catch (error) {
        console.error('   ⚠️ YouTube fetch failed:', error.message)
      }
    } else {
      console.log('   ⏭️ Skipping YouTube (no API key)')
    }

    // Instagram trends (placeholder)
    if (process.env.INSTAGRAM_ACCESS_TOKEN) {
      console.log('\n📸 Fetching Instagram trends...')
      try {
        const instagramTrends = await fetchInstagramTrends()
        console.log(`   Found ${instagramTrends.length} Instagram trends`)
        allTrends.push(...instagramTrends.map(t => ({ ...t, platform: 'instagram' })))
      } catch (error) {
        console.error('   ⚠️ Instagram fetch failed:', error.message)
      }
    } else {
      console.log('   ⏭️ Skipping Instagram (not configured yet)')
    }

    if (allTrends.length === 0) {
      isRunning = false
      lastRunResult = { success: false, message: 'No trends fetched from any source', articlesGenerated: 0 }
      lastRunTime = new Date().toISOString()
      return lastRunResult
    }

    console.log(`\n📈 Total trends collected: ${allTrends.length}`)

    // Step 2: Score and filter trends
    console.log('\n🎯 STEP 2: Scoring trends for beauty/lifestyle relevance...')
    
    const scoredTrends = allTrends.map(trend => {
      const relevanceScore = calculateRelevanceScore(trend, CONFIG.beautyKeywords)
      return { ...trend, relevanceScore }
    })

    const relevantTrends = scoredTrends
      .filter(t => t.relevanceScore >= CONFIG.minRelevanceScore)
      .sort((a, b) => {
        const aScore = a.relevanceScore * (a.trendingScore || 1)
        const bScore = b.relevanceScore * (b.trendingScore || 1)
        return bScore - aScore
      })

    console.log(`   ${relevantTrends.length} trends passed relevance filter`)

    // Step 3: Filter duplicates
    console.log('\n🔍 STEP 3: Filtering out already-covered topics...')
    
    const newTrends = relevantTrends.filter(trend => {
      const topicLower = (trend.topic || trend.title || '').toLowerCase()
      const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3)
      
      const alreadyCovered = recentTopics.some(recent => {
        const recentWords = recent.split(/\s+/).filter(w => w.length > 3)
        if (recentWords.length === 0 || topicWords.length === 0) return false
        
        const matchingWords = topicWords.filter(w => recentWords.includes(w))
        const overlapRatio = matchingWords.length / Math.min(topicWords.length, recentWords.length)
        
        return overlapRatio >= 0.7
      })
      
      if (alreadyCovered) {
        console.log(`   ⏭️ Skipping "${trend.topic}" (too similar to existing article)`)
      }
      return !alreadyCovered
    })

    console.log(`   ${newTrends.length} new topics to potentially cover`)

    const selectedTrends = newTrends.slice(0, CONFIG.articlesToGenerate)
    
    if (selectedTrends.length === 0) {
      isRunning = false
      lastRunResult = { 
        success: true, 
        message: 'No new relevant trends to write about today.', 
        articlesGenerated: 0,
        trendsChecked: allTrends.length
      }
      lastRunTime = new Date().toISOString()
      console.log('\n✅ No new relevant trends to write about today.')
      return lastRunResult
    }

    console.log(`\n📝 Selected ${selectedTrends.length} topics for article generation:`)
    selectedTrends.forEach((t, i) => {
      console.log(`   ${i + 1}. [${t.platform}] ${t.topic} (relevance: ${(t.relevanceScore * 100).toFixed(0)}%)`)
    })

    // Step 4: Generate articles
    console.log('\n✍️ STEP 4: Generating articles with Claude AI...')
    
    const generatedArticles = []
    
    for (let i = 0; i < selectedTrends.length; i++) {
      const trend = selectedTrends[i]
      console.log(`\n   📄 Article ${i + 1}/${selectedTrends.length}: "${trend.topic}"`)
      
      try {
        const article = await generateArticle(trend)
        console.log(`      ✅ Generated: "${article.title}"`)
        
        // Fetch featured image from Unsplash
        console.log(`      🖼️ Fetching featured image...`)
        const image = await searchUnsplashImage(trend.topic, article.category)
        if (image) {
          article.featuredImageUrl = image.url
          article.featuredImageAlt = image.alt
          article.imageCredit = image.credit
          article.attributionHtml = image.attributionHtml
          // Track download per Unsplash API guidelines
          await trackDownload(image.downloadUrl)
          console.log(`      ✅ Image found: "${image.alt}"`)
        } else {
          console.log(`      ⚠️ No image found - article will have no featured image`)
        }
        
        console.log(`      🔗 Finding related content...`)
        const relatedContent = await findRelatedContent(article, trend)
        article.relatedBlogPosts = relatedContent.blogPosts
        article.relatedArticles = relatedContent.articles
        
        generatedArticles.push({
          ...article,
          trendSource: {
            platform: trend.platform,
            trendingTopic: trend.topic,
            trendingScore: trend.trendingScore || null,
            detectedAt: new Date().toISOString(),
          }
        })
        
      } catch (error) {
        console.error(`      ❌ Failed to generate: ${error.message}`)
      }
      
      if (i < selectedTrends.length - 1) {
        await sleep(2000)
      }
    }

    // Step 5: Save to Sanity
    console.log('\n💾 STEP 5: Saving articles to Sanity as drafts...')
    
    let savedCount = 0
    const savedArticles = []
    
    for (const article of generatedArticles) {
      try {
        const result = await createDraftArticle(article)
        console.log(`   ✅ Saved: "${article.title}" (ID: ${result._id})`)
        savedCount++
        savedArticles.push({ id: result._id, title: article.title })
      } catch (error) {
        console.error(`   ❌ Failed to save "${article.title}": ${error.message}`)
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000)

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('📊 SUMMARY')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`   Trends fetched:     ${allTrends.length}`)
    console.log(`   Relevant trends:    ${relevantTrends.length}`)
    console.log(`   New topics:         ${newTrends.length}`)
    console.log(`   Articles generated: ${generatedArticles.length}`)
    console.log(`   Articles saved:     ${savedCount}`)
    console.log(`   Duration:           ${duration}s`)
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`✅ Done! ${savedCount} new article drafts ready for review.`)

    isRunning = false
    lastRunResult = {
      success: true,
      message: `Generated ${savedCount} article drafts`,
      articlesGenerated: savedCount,
      articles: savedArticles,
      trendsChecked: allTrends.length,
      duration: duration
    }
    lastRunTime = new Date().toISOString()
    
    return lastRunResult

  } catch (error) {
    console.error('💥 Fatal error:', error)
    isRunning = false
    lastRunResult = { success: false, message: error.message, error: true }
    lastRunTime = new Date().toISOString()
    return lastRunResult
  }
}

// ==================== HTTP SERVER ====================

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Health check
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'kyndall-blog-engine',
      isRunning,
      lastRunTime,
      lastRunResult: lastRunResult ? {
        success: lastRunResult.success,
        articlesGenerated: lastRunResult.articlesGenerated || 0
      } : null
    }))
    return
  }

  // Status endpoint
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      isRunning,
      lastRunTime,
      lastRunResult
    }))
    return
  }

  // Trigger endpoint
  if (url.pathname === '/generate' || url.pathname === '/trigger') {
    // Check auth
    const authHeader = req.headers.authorization || ''
    const providedSecret = authHeader.replace('Bearer ', '')
    
    if (providedSecret !== API_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized. Provide valid API_SECRET.' }))
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
      return
    }

    if (isRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: 'Job already running',
        message: 'Please wait for the current job to complete.',
        isRunning: true
      }))
      return
    }

    // Start generation in background
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      message: '🚀 Article generation started!',
      status: 'started',
      checkStatusAt: '/status'
    }))

    // Run async (don't await - let it run in background)
    runArticleGeneration().catch(err => {
      console.error('Background job error:', err)
    })
    
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🚀 Kyndall Blog Engine - Web Server Started')
  console.log(`📡 Listening on port ${PORT}`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('Endpoints:')
  console.log(`  GET  /health   - Health check`)
  console.log(`  GET  /status   - Job status & last run info`)
  console.log(`  POST /generate - Trigger article generation (requires auth)`)
  console.log('═══════════════════════════════════════════════════════════════')
})

// ==================== HELPERS ====================

function calculateRelevanceScore(trend, keywords) {
  const text = [
    trend.topic,
    trend.title,
    trend.description,
    ...(trend.tags || [])
  ].filter(Boolean).join(' ').toLowerCase()

  if (!text) return 0

  let matchCount = 0

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase()
    if (text.includes(keywordLower)) {
      const weight = keywordLower.split(' ').length
      matchCount += weight
    }
  }

  if (matchCount === 0) return 0
  if (matchCount === 1) return 0.15
  if (matchCount === 2) return 0.3
  if (matchCount === 3) return 0.45
  if (matchCount === 4) return 0.6
  return Math.min(1, 0.6 + (matchCount - 4) * 0.1)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
