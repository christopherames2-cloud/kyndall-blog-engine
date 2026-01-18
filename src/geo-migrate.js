// kyndall-blog-engine/src/geo-migrate.js
// GEO Content Migration Module
// Automatically adds missing GEO content to existing articles
// Runs on startup and after each generation cycle as a safety net

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
// FETCH ARTICLES NEEDING GEO UPDATE
// ============================================================

async function getArticlesNeedingGeoUpdate(limit = 10) {
  // Query for articles missing any of the core GEO fields
  const query = `*[_type == "article" && (
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
    introduction,
    mainContent,
    quickAnswer,
    keyTakeaways,
    expertTips,
    faqSection,
    kyndallsTake
  }`
  
  return sanityClient.fetch(query, { limit })
}

// ============================================================
// EXTRACT TEXT FROM PORTABLE TEXT
// ============================================================

function extractTextFromPortableText(blocks) {
  if (!blocks || !Array.isArray(blocks)) return ''
  
  return blocks
    .filter(block => block._type === 'block')
    .map(block => block.children?.map(child => child.text).join('') || '')
    .join('\n')
}

// ============================================================
// GENERATE GEO CONTENT WITH CLAUDE
// ============================================================

async function generateGeoContent(article) {
  // Get content text for analysis
  const introText = extractTextFromPortableText(article.introduction)
  const mainText = extractTextFromPortableText(article.mainContent)
  const contentText = `${introText}\n\n${mainText}`.trim()

  const prompt = `You are helping generate GEO (Generative Engine Optimization) content for an existing beauty/lifestyle article.

ARTICLE TITLE: ${article.title}
CATEGORY: ${article.category || 'lifestyle'}
EXCERPT: ${article.excerpt || 'No excerpt'}

ARTICLE CONTENT (first 2500 chars):
${contentText.substring(0, 2500)}

---

Generate GEO components. Write in Kyndall's voice - a beauty influencer talking to a friend. Casual, helpful, specific.

Respond with ONLY valid JSON (no markdown, no backticks):

{
  "quickAnswer": "2-3 sentence TL;DR that directly answers what this article is about. Be specific. 150-300 characters.",
  
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
    
    // Clean up response - remove markdown formatting if present
    let cleanText = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()
    
    // Extract JSON object
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
// UPDATE ARTICLE WITH GEO CONTENT
// ============================================================

async function updateArticleWithGeo(articleId, geoContent) {
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
    .patch(articleId)
    .set(patch)
    .commit()
}

// ============================================================
// MAIN MIGRATION FUNCTION
// ============================================================

export async function runGeoMigration(maxArticles = 5) {
  if (!anthropicClient || !sanityClient) {
    console.log('⚠️  GEO Migration not initialized, skipping...')
    return { updated: 0, errors: 0 }
  }
  
  console.log('\n🎯 Checking for articles needing GEO content...')
  
  try {
    const articlesNeedingUpdate = await getArticlesNeedingGeoUpdate(maxArticles)
    
    if (articlesNeedingUpdate.length === 0) {
      console.log('   ✅ All articles have GEO content!')
      return { updated: 0, errors: 0 }
    }
    
    console.log(`   Found ${articlesNeedingUpdate.length} articles needing GEO update`)
    
    let updated = 0
    let errors = 0
    
    for (const article of articlesNeedingUpdate) {
      console.log(`   📝 "${article.title.substring(0, 50)}..."`)
      
      // Generate GEO content
      const geoContent = await generateGeoContent(article)
      
      if (!geoContent) {
        errors++
        continue
      }
      
      // Update article
      try {
        await updateArticleWithGeo(article._id, geoContent)
        console.log(`      ✅ Added GEO content`)
        updated++
      } catch (err) {
        console.log(`      ❌ Update error: ${err.message}`)
        errors++
      }
      
      // Small delay between articles to avoid rate limits
      await sleep(1000)
    }
    
    console.log(`   🎯 GEO Migration: ${updated} updated, ${errors} errors`)
    
    return { updated, errors }
    
  } catch (error) {
    console.error('❌ GEO Migration error:', error.message)
    return { updated: 0, errors: 1 }
  }
}

export default {
  initGeoMigration,
  runGeoMigration
}
