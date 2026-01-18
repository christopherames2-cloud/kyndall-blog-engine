// kyndall-blog-engine/src/index.js
// Web server version - trigger via HTTP endpoint from Sanity Studio or cron service
// NOW WITH AUTO GEO MIGRATION + REFERENCES MIGRATION

import http from 'http'
import { fetchTikTokTrends } from './trends/tiktok.js'
import { fetchYouTubeTrends } from './trends/youtube.js'
import { fetchInstagramTrends } from './trends/instagram.js'
import { generateArticle } from './generator/article.js'
import { findRelatedContent } from './linker/internal.js'
import { initSanity, getSanityClient, createDraftArticle, getRecentArticles } from './sanity.js'
import { searchUnsplashImage, trackDownload } from './images/unsplash.js'
import { initGeoMigration, runGeoMigration } from './geo-migrate.js'
import { initReferencesMigration, runReferencesMigration } from './references-migrate.js'

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
  geoMigrationMaxArticles: 5,
  referencesMigrationMaxArticles: 5, // Max articles to add references per run
}

const PORT = process.env.PORT || 8080
const API_SECRET = process.env.API_SECRET || 'kyndall-blog-engine-secret'

// Track job status
let isRunning = false
let lastRunResult = null
let lastRunTime = null
let lastGeoMigrationResult = null
let lastReferencesMigrationResult = null

// Initialize Sanity on startup
const sanityProjectId = process.env.SANITY_PROJECT_ID
const sanityDataset = process.env.SANITY_DATASET || 'production'
const sanityToken = process.env.SANITY_TOKEN
const anthropicApiKey = process.env.ANTHROPIC_API_KEY

if (sanityProjectId && sanityToken) {
  initSanity(sanityProjectId, sanityDataset, sanityToken)
  console.log('✅ Sanity client initialized')
  
  // Initialize GEO Migration module
  if (anthropicApiKey) {
    try {
      const sanityClient = getSanityClient()
      initGeoMigration(anthropicApiKey, sanityClient)
      
      // Initialize References Migration module
      initReferencesMigration(anthropicApiKey, sanityClient)
      
      // Run GEO migration on startup (non-blocking)
      console.log('🎯 Running startup GEO migration check...')
      runGeoMigration(CONFIG.geoMigrationMaxArticles)
        .then(result => {
          lastGeoMigrationResult = result
          console.log(`✅ Startup GEO migration complete: ${result.updated} updated, ${result.errors} errors`)
        })
        .catch(err => {
          console.error('⚠️ Startup GEO migration error:', err.message)
        })
      
      // Run References migration on startup (non-blocking)
      console.log('📚 Running startup References migration check...')
      runReferencesMigration(CONFIG.referencesMigrationMaxArticles)
        .then(result => {
          lastReferencesMigrationResult = result
          console.log(`✅ Startup References migration complete: ${result.updated} updated, ${result.errors} errors`)
        })
        .catch(err => {
          console.error('⚠️ Startup References migration error:', err.message)
        })
        
    } catch (err) {
      console.error('⚠️ Could not initialize migration modules:', err.message)
    }
  } else {
    console.warn('⚠️ Missing ANTHROPIC_API_KEY - GEO and References migration disabled')
  }
} else {
  console.error('⚠️ Missing Sanity credentials - will fail on run')
}

// ==================== MAIN GENERATION FUNCTION ====================

async function runArticleGeneration() {
  if (isRunning) {
    return { success: false, message: 'Job already running. Please wait.' }
  }

  isRunning = true
  lastRunTime = new Date().toISOString()
  
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🚀 Starting Article Generation')
  console.log(`   Time: ${lastRunTime}`)
  console.log('═══════════════════════════════════════════════════════════════')

  const result = {
    success: true,
    articlesCreated: 0,
    errors: [],
    trends: { tiktok: 0, youtube: 0, instagram: 0 },
    geoMigration: null,
    referencesMigration: null,
  }

  try {
    // Step 1: Fetch trends from all sources
    console.log('\n📊 Fetching trending topics...')
    
    let allTrends = []
    
    if (CONFIG.trendSources.includes('tiktok')) {
      try {
        const tiktokTrends = await fetchTikTokTrends()
        result.trends.tiktok = tiktokTrends.length
        allTrends = [...allTrends, ...tiktokTrends.map(t => ({ ...t, platform: 'tiktok' }))]
        console.log(`   TikTok: ${tiktokTrends.length} trends`)
      } catch (err) {
        console.log(`   TikTok: Error - ${err.message}`)
        result.errors.push(`TikTok: ${err.message}`)
      }
    }
    
    if (CONFIG.trendSources.includes('youtube')) {
      try {
        const youtubeTrends = await fetchYouTubeTrends()
        result.trends.youtube = youtubeTrends.length
        allTrends = [...allTrends, ...youtubeTrends.map(t => ({ ...t, platform: 'youtube' }))]
        console.log(`   YouTube: ${youtubeTrends.length} trends`)
      } catch (err) {
        console.log(`   YouTube: Error - ${err.message}`)
        result.errors.push(`YouTube: ${err.message}`)
      }
    }
    
    if (CONFIG.trendSources.includes('instagram')) {
      try {
        const instagramTrends = await fetchInstagramTrends()
        result.trends.instagram = instagramTrends.length
        allTrends = [...allTrends, ...instagramTrends.map(t => ({ ...t, platform: 'instagram' }))]
        console.log(`   Instagram: ${instagramTrends.length} trends`)
      } catch (err) {
        console.log(`   Instagram: Error - ${err.message}`)
        result.errors.push(`Instagram: ${err.message}`)
      }
    }

    if (allTrends.length === 0) {
      result.success = false
      result.message = 'No trends found from any source'
      return result
    }

    // Step 2: Score and filter trends
    console.log('\n🎯 Scoring trends for relevance...')
    
    const scoredTrends = allTrends.map(trend => ({
      ...trend,
      relevanceScore: calculateRelevanceScore(trend, CONFIG.beautyKeywords)
    }))
    
    const relevantTrends = scoredTrends
      .filter(t => t.relevanceScore >= CONFIG.minRelevanceScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, CONFIG.articlesToGenerate)
    
    console.log(`   ${relevantTrends.length} relevant trends selected`)

    if (relevantTrends.length === 0) {
      result.success = false
      result.message = 'No relevant beauty/lifestyle trends found'
      return result
    }

    // Step 3: Check for recent duplicates
    console.log('\n🔍 Checking for duplicates...')
    const recentArticles = await getRecentArticles(7)
    const recentTitles = recentArticles.map(a => a.title.toLowerCase())
    
    const uniqueTrends = relevantTrends.filter(trend => {
      const topic = (trend.topic || trend.title || '').toLowerCase()
      return !recentTitles.some(title => 
        title.includes(topic) || topic.includes(title)
      )
    })
    
    console.log(`   ${uniqueTrends.length} unique topics (${relevantTrends.length - uniqueTrends.length} duplicates removed)`)

    // Step 4: Generate articles
    console.log('\n✍️ Generating articles...')
    
    for (let i = 0; i < Math.min(uniqueTrends.length, CONFIG.articlesToGenerate); i++) {
      const trend = uniqueTrends[i]
      console.log(`\n   [${i + 1}/${Math.min(uniqueTrends.length, CONFIG.articlesToGenerate)}] "${trend.topic || trend.title}"`)
      console.log(`      Platform: ${trend.platform}, Score: ${trend.relevanceScore.toFixed(2)}`)
      
      try {
        // Generate article content (now includes references!)
        const article = await generateArticle(trend)
        
        // Log references generated
        if (article.references && article.references.length > 0) {
          console.log(`      📚 References: ${article.references.length} sources`)
        }
        
        // Find related content for internal linking
        console.log(`      🔗 Finding related content...`)
        const relatedContent = await findRelatedContent(article.title, article.category)
        article.relatedPosts = relatedContent
        
        // Get featured image from Unsplash
        console.log(`      🖼️ Searching for featured image...`)
        const imageResult = await searchUnsplashImage(trend.topic || trend.title, article.category)
        if (imageResult) {
          article.featuredImageUrl = imageResult.url
          article.featuredImageAlt = imageResult.alt
          article.imageAttribution = imageResult.attribution
          
          // Track download for Unsplash compliance
          if (imageResult.downloadUrl) {
            await trackDownload(imageResult.downloadUrl)
          }
        }
        
        // Save to Sanity
        console.log(`      💾 Saving to Sanity...`)
        const created = await createDraftArticle(article)
        console.log(`      ✅ Created: ${created._id}`)
        
        result.articlesCreated++
        
        // Small delay between articles
        await sleep(2000)
        
      } catch (err) {
        console.log(`      ❌ Error: ${err.message}`)
        result.errors.push(`Article "${trend.topic}": ${err.message}`)
      }
    }

    // Step 5: Run GEO migration to catch any articles missing GEO content
    console.log('\n🎯 Running post-generation GEO migration...')
    try {
      const geoResult = await runGeoMigration(CONFIG.geoMigrationMaxArticles)
      result.geoMigration = geoResult
      lastGeoMigrationResult = geoResult
      console.log(`   GEO Migration: ${geoResult.updated} articles updated, ${geoResult.errors} errors`)
    } catch (err) {
      console.log(`   ⚠️ GEO Migration error: ${err.message}`)
      result.geoMigration = { updated: 0, errors: 1, error: err.message }
    }

    // Step 6: Run References migration for any articles missing references
    console.log('\n📚 Running post-generation References migration...')
    try {
      const refResult = await runReferencesMigration(CONFIG.referencesMigrationMaxArticles)
      result.referencesMigration = refResult
      lastReferencesMigrationResult = refResult
      console.log(`   References Migration: ${refResult.updated} articles updated, ${refResult.errors} errors`)
    } catch (err) {
      console.log(`   ⚠️ References Migration error: ${err.message}`)
      result.referencesMigration = { updated: 0, errors: 1, error: err.message }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('📊 Generation Complete!')
    console.log(`   Articles created: ${result.articlesCreated}`)
    console.log(`   Errors: ${result.errors.length}`)
    if (result.geoMigration) {
      console.log(`   GEO backfills: ${result.geoMigration.updated}`)
    }
    if (result.referencesMigration) {
      console.log(`   References backfills: ${result.referencesMigration.updated}`)
    }
    console.log('═══════════════════════════════════════════════════════════════')

    result.message = `Created ${result.articlesCreated} articles`
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    result.success = false
    result.message = error.message
    result.errors.push(error.message)
  } finally {
    isRunning = false
    lastRunResult = result
  }

  return result
}

// ==================== HTTP SERVER ====================

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }))
    return
  }

  // Status endpoint
  if (url.pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      isRunning,
      lastRunTime,
      lastRunResult,
      lastGeoMigrationResult,
      lastReferencesMigrationResult,
    }))
    return
  }

  // Generate endpoint (requires auth)
  if (url.pathname === '/generate') {
    // Check auth
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    
    if (token !== API_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
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

  // Manual GEO migration endpoint
  if (url.pathname === '/geo-migrate') {
    // Check auth
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    
    if (token !== API_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
      return
    }

    console.log('🎯 Manual GEO migration triggered...')
    
    try {
      const result = await runGeoMigration(CONFIG.geoMigrationMaxArticles)
      lastGeoMigrationResult = result
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        message: 'GEO migration complete',
        ...result
      }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    
    return
  }

  // Manual References migration endpoint
  if (url.pathname === '/backfill-references') {
    // Check auth
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    
    if (token !== API_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
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
        error: 'Another job is running',
        message: 'Please wait for the current job to complete.',
        isRunning: true
      }))
      return
    }

    console.log('📚 Manual References migration triggered...')
    
    // Run async and respond immediately
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      message: '📚 References backfill started!',
      status: 'started',
      maxArticles: CONFIG.referencesMigrationMaxArticles,
      checkStatusAt: '/status'
    }))

    // Run in background
    runReferencesMigration(CONFIG.referencesMigrationMaxArticles)
      .then(result => {
        lastReferencesMigrationResult = result
        console.log(`📚 References migration complete: ${result.updated} updated, ${result.errors} errors`)
      })
      .catch(err => {
        console.error('📚 References migration error:', err.message)
        lastReferencesMigrationResult = { updated: 0, errors: 1, error: err.message }
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
  console.log(`  GET  /health             - Health check`)
  console.log(`  GET  /status             - Job status & last run info`)
  console.log(`  POST /generate           - Trigger article generation (requires auth)`)
  console.log(`  POST /geo-migrate        - Manual GEO migration (requires auth)`)
  console.log(`  POST /backfill-references - Add references to articles (requires auth)`)
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
