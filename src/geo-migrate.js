// kyndall-blog-engine/src/geo-migrate.js
// GEO Content Migration Module
// Automatically adds missing GEO content to existing blog posts
// Import and call runGeoMigration() from main index.js

import Anthropic from '@anthropic-ai/sdk'

let anthropicClient = null
let sanityClient = null

// ============================================================
// INITIALIZATION
// ============================================================

export function initGeoMigration(anthropicApiKey, sanityClientInstance) {
  anthropicClient = new Anthropic({ apiKey: anthropicApiKey })
  sanityClient = sanityClientInstance
  console.log('✅ GEO Migration module initialized')
}

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
// CHECK IF POST NEEDS GEO UPDATE
// ============================================================

function needsGeoUpdate(post) {
  const hasQuickAnswer = post.quickAnswer && post.quickAnswer.trim().length > 0
  const hasKeyTakeaways = post.keyTakeaways && post.keyTakeaways.length > 0
  const hasFaqs = post.faqSection && post.faqSection.length > 0
  
  // Need update if missing any of the main GEO components
  return !hasQuickAnswer || !hasKeyTakeaways || !hasFaqs
}

// ============================================================
// FETCH POSTS NEEDING UPDATE
// ============================================================

async function getPostsNeedingGeoUpdate(limit = 10) {
  const query = `*[_type == "blogPost" && (
    quickAnswer == null || 
    !defined(quickAnswer) || 
    quickAnswer == "" ||
    !defined(keyTakeaways) || 
    count(keyTakeaways) == 0 ||
    !defined(faqSection) || 
    count(faqSection) == 0
  )] | order(publishedAt desc)[0...$limit] {
    _id,
    title,
    "slug": slug.current,
    category,
    excerpt,
    platform,
    htmlContent,
    content,
    quickAnswer,
    keyTakeaways,
    expertTips,
    faqSection,
    kyndallsTake,
    featuredProducts,
    productLinks
  }`
  
  return sanityClient.fetch(query, { limit })
}

// ============================================================
// GENERATE GEO CONTENT WITH CLAUDE
// ============================================================

async function generateGeoContent(post) {
  // Get content text for analysis
  let contentText = ''
  
  if (post.htmlContent) {
    contentText = post.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } else if (post.content && Array.isArray(post.content)) {
    contentText = post.content
      .filter(block => block._type === 'block')
      .map(block => block.children?.map(child => child.text).join('') || '')
      .join('\n')
  }
  
  // Get product names
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

Generate GEO components. Write in Kyndall's voice - a beauty influencer talking to a friend. Casual, helpful, specific.

Respond with ONLY valid JSON (no markdown, no backticks):

{
  "quickAnswer": "2-3 sentence TL;DR that directly answers what this post is about. Be specific. 150-300 characters.",
  
  "keyTakeaways": [
    { "icon": "✨", "point": "First key takeaway - specific and actionable" },
    { "icon": "💧", "point": "Second key takeaway" },
    { "icon": "☀️", "point": "Third key takeaway" },
    { "icon": "💕", "point": "Fourth key takeaway" }
  ],
  
  "expertTips": [
    {
      "title": "Short catchy tip title",
      "description": "2-3 sentences explaining the tip",
      "proTip": "One-liner insider advice (or null)"
    },
    {
      "title": "Second tip title", 
      "description": "Explanation of second tip",
      "proTip": null
    }
  ],
  
  "faqSection": [
    { "question": "Common question about this topic?", "answer": "Helpful answer in 2-3 sentences." },
    { "question": "Another relevant question?", "answer": "Helpful answer." },
    { "question": "Third question?", "answer": "Answer." }
  ],
  
  "kyndallsTake": {
    "headline": "Short catchy headline",
    "content": "2-3 sentences of Kyndall's personal take. First person, casual, authentic.",
    "mood": "recommend"
  }
}`

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text
    
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
    console.error(`   ❌ GEO generation error: ${error.message}`)
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

async function migrateProductsIfNeeded(post) {
  // Check if has productLinks but no featuredProducts
  if (post.productLinks?.length > 0 && (!post.featuredProducts || post.featuredProducts.length === 0)) {
    const featuredProducts = post.productLinks.map(p => ({
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
      .patch(post._id)
      .set({ featuredProducts })
      .commit()
    
    return true
  }
  return false
}

// ============================================================
// MAIN MIGRATION FUNCTION
// ============================================================

export async function runGeoMigration(maxPosts = 5) {
  if (!anthropicClient || !sanityClient) {
    console.log('⚠️  GEO Migration not initialized, skipping...')
    return { updated: 0, errors: 0 }
  }
  
  console.log('\n🎯 Checking for posts needing GEO content...')
  
  try {
    const postsNeedingUpdate = await getPostsNeedingGeoUpdate(maxPosts)
    
    if (postsNeedingUpdate.length === 0) {
      console.log('   ✅ All posts have GEO content!')
      return { updated: 0, errors: 0 }
    }
    
    console.log(`   Found ${postsNeedingUpdate.length} posts needing GEO update`)
    
    let updated = 0
    let errors = 0
    let productsMigrated = 0
    
    for (const post of postsNeedingUpdate) {
      console.log(`   📝 "${post.title.substring(0, 40)}..."`)
      
      // Migrate products if needed
      const didMigrateProducts = await migrateProductsIfNeeded(post)
      if (didMigrateProducts) {
        productsMigrated++
        console.log(`      📦 Migrated products to new format`)
      }
      
      // Generate GEO content
      const geoContent = await generateGeoContent(post)
      
      if (!geoContent) {
        errors++
        continue
      }
      
      // Update post
      try {
        await updatePostWithGeo(post._id, geoContent)
        console.log(`      ✅ Added GEO content`)
        updated++
      } catch (err) {
        console.log(`      ❌ Update error: ${err.message}`)
        errors++
      }
      
      // Small delay between posts
      await sleep(1000)
    }
    
    console.log(`   🎯 GEO Migration: ${updated} updated, ${errors} errors, ${productsMigrated} products migrated`)
    
    return { updated, errors, productsMigrated }
    
  } catch (error) {
    console.error('❌ GEO Migration error:', error.message)
    return { updated: 0, errors: 1 }
  }
}

export default {
  initGeoMigration,
  runGeoMigration
}
