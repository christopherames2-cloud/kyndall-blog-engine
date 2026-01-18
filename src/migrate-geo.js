// kyndall-blog-engine/src/migrate-geo.js
// One-time script to add GEO content to existing blog posts
// Run with: node src/migrate-geo.js

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@sanity/client'

// ============================================================
// CONFIGURATION
// ============================================================

const config = {
  sanity: {
    projectId: process.env.SANITY_PROJECT_ID || 'f9drkp1w',
    dataset: process.env.SANITY_DATASET || 'production',
    token: process.env.SANITY_API_TOKEN, // Needs write access
    apiVersion: '2024-01-01',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  // Set to true to actually update posts, false for dry run
  dryRun: false,
  // Process posts in batches to avoid rate limits
  batchSize: 5,
  delayBetweenBatches: 2000, // ms
}

// Initialize clients
const sanityClient = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn: false,
})

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey })

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateKey() {
  return Math.random().toString(36).substring(2, 10)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// FETCH ALL BLOG POSTS
// ============================================================

async function getAllBlogPosts() {
  console.log('📚 Fetching all blog posts...')
  
  const query = `*[_type == "blogPost"] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    category,
    excerpt,
    platform,
    videoUrl,
    htmlContent,
    content,
    quickAnswer,
    keyTakeaways,
    expertTips,
    faqSection,
    kyndallsTake,
    featuredProducts,
    productLinks,
    showInBlog,
    showInVideos
  }`
  
  const posts = await sanityClient.fetch(query)
  console.log(`   Found ${posts.length} total blog posts`)
  
  return posts
}

// ============================================================
// CHECK IF POST NEEDS GEO UPDATE
// ============================================================

function needsGeoUpdate(post) {
  // Check if missing key GEO fields
  const hasQuickAnswer = post.quickAnswer && post.quickAnswer.trim().length > 0
  const hasKeyTakeaways = post.keyTakeaways && post.keyTakeaways.length > 0
  const hasFaqs = post.faqSection && post.faqSection.length > 0
  const hasExpertTips = post.expertTips && post.expertTips.length > 0
  const hasKyndallsTake = post.kyndallsTake?.showKyndallsTake && post.kyndallsTake?.content
  
  // Need update if missing any of the main GEO components
  return !hasQuickAnswer || !hasKeyTakeaways || !hasFaqs
}

// ============================================================
// GENERATE GEO CONTENT WITH CLAUDE
// ============================================================

async function generateGeoContent(post) {
  // Get content text for analysis
  let contentText = ''
  
  if (post.htmlContent) {
    // Strip HTML tags
    contentText = post.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } else if (post.content && Array.isArray(post.content)) {
    // Extract text from Portable Text
    contentText = post.content
      .filter(block => block._type === 'block')
      .map(block => block.children?.map(child => child.text).join('') || '')
      .join('\n')
  }
  
  // Get product names for context
  const products = post.featuredProducts || post.productLinks || []
  const productNames = products
    .map(p => `${p.brand || ''} ${p.productName || p.name || ''}`.trim())
    .filter(Boolean)
    .join(', ')

  const prompt = `You are helping generate GEO (Generative Engine Optimization) content for an existing beauty/lifestyle blog post.

POST TITLE: ${post.title}

CATEGORY: ${post.category || 'lifestyle'}

EXCERPT: ${post.excerpt || 'No excerpt'}

PRODUCTS MENTIONED: ${productNames || 'None specified'}

POST CONTENT (first 2000 chars):
${contentText.substring(0, 2000)}

---

Generate the following GEO components. Write in Kyndall's voice - she's a beauty influencer talking to a friend. Casual, helpful, specific.

Respond with ONLY valid JSON (no markdown, no backticks):

{
  "quickAnswer": "2-3 sentence TL;DR that directly answers what this post is about. Be specific with product names and techniques. 150-300 characters. This appears in a highlighted box for AI engines.",
  
  "keyTakeaways": [
    { "icon": "✨", "point": "First key takeaway - specific and actionable" },
    { "icon": "💧", "point": "Second key takeaway" },
    { "icon": "☀️", "point": "Third key takeaway" },
    { "icon": "💕", "point": "Fourth key takeaway" }
  ],
  
  "expertTips": [
    {
      "title": "Short catchy tip title",
      "description": "2-3 sentences explaining the tip in detail",
      "proTip": "One-liner insider advice (or null)"
    },
    {
      "title": "Second tip title",
      "description": "Explanation of second tip",
      "proTip": null
    }
  ],
  
  "faqSection": [
    { "question": "Common question a viewer might ask about this topic?", "answer": "Helpful, conversational answer in 2-3 sentences." },
    { "question": "Another relevant question?", "answer": "Helpful answer." },
    { "question": "Third question?", "answer": "Answer." }
  ],
  
  "kyndallsTake": {
    "headline": "Short catchy headline for Kyndall's personal opinion",
    "content": "2-3 sentences of Kyndall's personal take on this topic. First person, casual, authentic.",
    "mood": "recommend"
  }
}

IMPORTANT:
- Make content specific to THIS post's topic
- Use product names when relevant
- Keep it conversational, not robotic
- FAQ answers should be genuinely helpful
- mood can be: "recommend", "love", "honest", "mixed", or "skip"`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text
    
    // Clean and parse JSON
    let cleanText = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanText = jsonMatch[0]
    }

    return JSON.parse(cleanText)
    
  } catch (error) {
    console.error(`   ❌ Claude error: ${error.message}`)
    return null
  }
}

// ============================================================
// UPDATE POST WITH GEO CONTENT
// ============================================================

async function updatePostWithGeo(postId, geoContent) {
  const patch = {
    quickAnswer: geoContent.quickAnswer || null,
    
    keyTakeaways: (geoContent.keyTakeaways || []).map(t => ({
      _type: 'takeaway',
      _key: generateKey(),
      point: t.point,
      icon: t.icon || '✨'
    })),
    
    expertTips: (geoContent.expertTips || []).map(t => ({
      _type: 'tip',
      _key: generateKey(),
      title: t.title,
      description: t.description,
      proTip: t.proTip || null
    })),
    
    faqSection: (geoContent.faqSection || []).map(f => ({
      _type: 'faqItem',
      _key: generateKey(),
      question: f.question,
      answer: f.answer
    })),
    
    kyndallsTake: geoContent.kyndallsTake ? {
      showKyndallsTake: true,
      headline: geoContent.kyndallsTake.headline || "Kyndall's Take",
      content: geoContent.kyndallsTake.content,
      mood: geoContent.kyndallsTake.mood || 'recommend'
    } : undefined
  }
  
  // Remove undefined values
  Object.keys(patch).forEach(key => {
    if (patch[key] === undefined) delete patch[key]
  })
  
  await sanityClient
    .patch(postId)
    .set(patch)
    .commit()
}

// ============================================================
// MIGRATE PRODUCTS TO NEW FORMAT
// ============================================================

async function migrateProducts(postId, productLinks) {
  if (!productLinks || productLinks.length === 0) return
  
  const featuredProducts = productLinks.map(p => ({
    _type: 'product',
    _key: generateKey(),
    productName: p.name || p.productName || 'Product',
    brand: p.brand || null,
    shopmyUrl: p.shopmyUrl || null,
    amazonUrl: p.amazonUrl || null,
    productNote: p.productNote || null,
    hasShopMyLink: p.shopmyUrl ? 'yes' : 'pending',
    hasAmazonLink: p.amazonUrl ? 'yes' : 'pending'
  }))
  
  await sanityClient
    .patch(postId)
    .set({ featuredProducts })
    .commit()
}

// ============================================================
// MAIN MIGRATION FUNCTION
// ============================================================

async function runMigration() {
  console.log('🚀 Starting GEO Content Migration')
  console.log(`   Mode: ${config.dryRun ? '🔍 DRY RUN (no changes)' : '✏️  LIVE (will update posts)'}`)
  console.log('')
  
  // Fetch all posts
  const allPosts = await getAllBlogPosts()
  
  // Filter posts needing update
  const postsNeedingUpdate = allPosts.filter(needsGeoUpdate)
  console.log(`   ${postsNeedingUpdate.length} posts need GEO content`)
  console.log('')
  
  // Also check for posts with productLinks but no featuredProducts
  const postsNeedingProductMigration = allPosts.filter(p => 
    p.productLinks?.length > 0 && (!p.featuredProducts || p.featuredProducts.length === 0)
  )
  console.log(`   ${postsNeedingProductMigration.length} posts need product migration`)
  console.log('')
  
  if (postsNeedingUpdate.length === 0 && postsNeedingProductMigration.length === 0) {
    console.log('✅ All posts are up to date!')
    return
  }
  
  // Process in batches
  let processed = 0
  let errors = 0
  let skipped = 0
  
  // Migrate products first
  if (postsNeedingProductMigration.length > 0) {
    console.log('📦 Migrating products to new format...')
    for (const post of postsNeedingProductMigration) {
      console.log(`   ${post.title.substring(0, 50)}...`)
      
      if (!config.dryRun) {
        try {
          await migrateProducts(post._id, post.productLinks)
          console.log(`   ✅ Products migrated`)
        } catch (err) {
          console.log(`   ❌ Error: ${err.message}`)
          errors++
        }
      } else {
        console.log(`   🔍 Would migrate ${post.productLinks.length} products`)
      }
    }
    console.log('')
  }
  
  // Process GEO updates
  console.log('🎯 Generating GEO content...')
  console.log('')
  
  for (let i = 0; i < postsNeedingUpdate.length; i += config.batchSize) {
    const batch = postsNeedingUpdate.slice(i, i + config.batchSize)
    
    console.log(`📦 Batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(postsNeedingUpdate.length / config.batchSize)}`)
    
    for (const post of batch) {
      const statusIcon = post.showInBlog ? '✅' : '📝'
      console.log(`   ${statusIcon} "${post.title.substring(0, 50)}..."`)
      
      // Generate GEO content
      const geoContent = await generateGeoContent(post)
      
      if (!geoContent) {
        console.log(`      ❌ Failed to generate GEO content`)
        errors++
        continue
      }
      
      console.log(`      ✨ Quick Answer: ${geoContent.quickAnswer?.substring(0, 50)}...`)
      console.log(`      📋 ${geoContent.keyTakeaways?.length || 0} takeaways, ${geoContent.faqSection?.length || 0} FAQs, ${geoContent.expertTips?.length || 0} tips`)
      
      if (!config.dryRun) {
        try {
          await updatePostWithGeo(post._id, geoContent)
          console.log(`      ✅ Updated!`)
          processed++
        } catch (err) {
          console.log(`      ❌ Update error: ${err.message}`)
          errors++
        }
      } else {
        console.log(`      🔍 Would update (dry run)`)
        skipped++
      }
      
      // Small delay between posts
      await sleep(500)
    }
    
    // Delay between batches
    if (i + config.batchSize < postsNeedingUpdate.length) {
      console.log(`   ⏳ Waiting ${config.delayBetweenBatches / 1000}s before next batch...`)
      await sleep(config.delayBetweenBatches)
    }
    
    console.log('')
  }
  
  // Summary
  console.log('═══════════════════════════════════════')
  console.log('📊 Migration Complete!')
  console.log(`   ✅ Updated: ${processed}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`   🔍 Skipped (dry run): ${skipped}`)
  console.log('═══════════════════════════════════════')
  
  if (config.dryRun) {
    console.log('')
    console.log('💡 This was a DRY RUN. To actually update posts, set dryRun: false in config.')
  }
}

// ============================================================
// RUN
// ============================================================

runMigration().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
