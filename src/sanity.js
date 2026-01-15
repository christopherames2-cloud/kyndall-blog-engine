// kyndall-blog-engine/src/sanity.js
// Sanity CMS Service with image upload support

import { createClient } from '@sanity/client'

let client = null

/**
 * Initialize Sanity client
 */
export function initSanity(projectId, dataset, token) {
  client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  })
}

/**
 * Upload image to Sanity from URL
 */
export async function uploadImageFromUrl(imageUrl, filename = 'article-image') {
  if (!client) throw new Error('Sanity client not initialized')
  if (!imageUrl) return null

  try {
    console.log(`   📸 Uploading image to Sanity...`)
    
    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.log(`   ⚠️ Failed to fetch image: ${response.status}`)
      return null
    }
    
    // Get as array buffer and convert to Node.js Buffer (NOT Blob!)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    console.log(`   📦 Image fetched, size: ${buffer.length} bytes`)
    
    // Upload to Sanity using Buffer (works in Node.js)
    const asset = await client.assets.upload('image', buffer, {
      filename: `${filename}.jpg`,
      contentType: response.headers.get('content-type') || 'image/jpeg',
    })
    
    console.log(`   ✅ Image uploaded: ${asset._id}`)
    
    return {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: asset._id,
      },
    }
  } catch (error) {
    console.error(`   ❌ Image upload failed:`, error.message)
    return null
  }
}

/**
 * Create a draft article in Sanity
 */
export async function createDraftArticle(article) {
  if (!client) throw new Error('Sanity client not initialized')
  
  const generateKey = () => Math.random().toString(36).substring(2, 10)

  // Upload featured image if provided
  let featuredImage = null
  if (article.featuredImageUrl) {
    featuredImage = await uploadImageFromUrl(
      article.featuredImageUrl, 
      article.slug || 'article'
    )
    
    // Only set alt text if image upload succeeded
    if (featuredImage && article.featuredImageAlt) {
      featuredImage.alt = article.featuredImageAlt
    }
  }

  const doc = {
    _type: 'article',
    
    // Basic info
    title: article.title,
    slug: {
      _type: 'slug',
      current: article.slug,
    },
    
    // VISIBILITY: Start hidden until reviewed!
    showOnSite: false,
    
    category: article.category,
    excerpt: article.excerpt,
    
    // Featured image (may be null if upload failed)
    featuredImage: featuredImage,
    
    // Content sections
    introduction: ensurePortableText(article.introduction),
    mainContent: ensurePortableText(article.mainContent),
    
    // Kyndall's Take
    kyndallsTake: article.kyndallsTake ? {
      headline: article.kyndallsTake.headline || "Kyndall's Take",
      content: ensurePortableText(article.kyndallsTake.content),
      mood: article.kyndallsTake.mood || 'recommend',
    } : null,
    
    // FAQ Section (with keys)
    faqSection: (article.faqSection || []).map(faq => ({
      _type: 'faqItem',
      _key: generateKey(),
      question: faq.question,
      answer: faq.answer,
    })),
    
    // Key Takeaways (with keys)
    keyTakeaways: (article.keyTakeaways || []).map(takeaway => ({
      _type: 'takeaway',
      _key: generateKey(),
      point: takeaway.point,
      icon: takeaway.icon || '✨',
    })),
    
    // Expert Tips (with keys)
    expertTips: (article.expertTips || []).map(tip => ({
      _type: 'tip',
      _key: generateKey(),
      title: tip.title,
      description: tip.description,
      proTip: tip.proTip || null,
    })),
    
    // SEO
    seoTitle: article.seoTitle || article.title,
    seoDescription: article.seoDescription || article.excerpt,
    keywords: article.keywords || [],
    
    // Related content (references)
    relatedBlogPosts: (article.relatedBlogPosts || []).map(post => ({
      _type: 'reference',
      _ref: post._id,
      _key: generateKey(),
    })),
    relatedArticles: (article.relatedArticles || []).map(art => ({
      _type: 'reference',
      _ref: art._id,
      _key: generateKey(),
    })),
    
    // Trend source
    trendSource: article.trendSource ? {
      platform: article.trendSource.platform,
      trendingTopic: article.trendSource.trendingTopic,
      trendingScore: article.trendSource.trendingScore,
      detectedAt: article.trendSource.detectedAt,
    } : null,
    
    // Image credit (for Unsplash attribution - stored as separate field, NOT on featuredImage)
    imageCredit: article.imageCredit ? {
      name: article.imageCredit.name,
      username: article.imageCredit.username,
      photographerUrl: article.imageCredit.photographerUrl,
      unsplashUrl: article.imageCredit.unsplashUrl,
      source: 'Unsplash',
    } : null,
    
    // Pre-formatted attribution for display
    imageAttribution: article.attributionHtml || null,
    
    // Metadata
    autoGenerated: true,
    publishedAt: article.publishedAt || new Date().toISOString(),
  }

  const result = await client.create(doc)
  return result
}

/**
 * Get recent articles to avoid duplicates
 */
export async function getRecentArticles(days = 30) {
  if (!client) throw new Error('Sanity client not initialized')
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  
  const query = `*[_type == "article" && publishedAt > $cutoffDate] | order(publishedAt desc) {
    _id,
    title,
    category,
    "slug": slug.current,
    trendSource
  }`

  return client.fetch(query, { cutoffDate: cutoffDate.toISOString() })
}

/**
 * Get article generation stats
 */
export async function getStats() {
  if (!client) throw new Error('Sanity client not initialized')
  
  const query = `{
    "totalArticles": count(*[_type == "article"]),
    "visibleArticles": count(*[_type == "article" && showOnSite == true]),
    "hiddenArticles": count(*[_type == "article" && showOnSite != true]),
    "autoGenerated": count(*[_type == "article" && autoGenerated == true]),
    "lastGenerated": *[_type == "article" && autoGenerated == true] | order(publishedAt desc)[0].publishedAt
  }`

  return client.fetch(query)
}

/**
 * Ensure content is in Portable Text format
 */
function ensurePortableText(content) {
  if (!content) return []
  if (Array.isArray(content)) {
    return content.map(block => ({
      ...block,
      _key: block._key || Math.random().toString(36).substring(2, 10),
      children: (block.children || []).map(child => ({
        ...child,
        _key: child._key || Math.random().toString(36).substring(2, 10),
      })),
    }))
  }
  
  if (typeof content === 'string') {
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim())
    return paragraphs.map(para => ({
      _type: 'block',
      _key: Math.random().toString(36).substring(2, 10),
      style: 'normal',
      children: [
        {
          _type: 'span',
          _key: Math.random().toString(36).substring(2, 10),
          text: para.trim(),
          marks: [],
        }
      ],
      markDefs: [],
    }))
  }
  
  return []
}
