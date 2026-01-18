// kyndall-blog-engine/src/sanity.js
// Sanity CMS Service with image upload support
// NOW WITH getSanityClient() export for GEO migration module
// UPDATED: Added references field for E-E-A-T and GEO

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
 * Export the client instance for other modules (like geo-migrate)
 */
export function getSanityClient() {
  if (!client) throw new Error('Sanity client not initialized')
  return client
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
 * Helper: Generate unique key for Sanity arrays
 */
function generateKey() {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * Helper: Convert text to Portable Text blocks
 */
function ensurePortableText(content) {
  if (!content) return []
  
  // If already portable text array, return as-is
  if (Array.isArray(content)) return content
  
  // Convert string to portable text blocks
  if (typeof content === 'string') {
    // Split by double newlines for paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim())
    
    return paragraphs.map(para => {
      // Check if it's a header
      const h2Match = para.match(/^##\s+(.+)$/)
      const h3Match = para.match(/^###\s+(.+)$/)
      
      let style = 'normal'
      let text = para.trim()
      
      if (h2Match) {
        style = 'h2'
        text = h2Match[1]
      } else if (h3Match) {
        style = 'h3'
        text = h3Match[1]
      }
      
      return {
        _type: 'block',
        _key: generateKey(),
        style,
        markDefs: [],
        children: [
          {
            _type: 'span',
            _key: generateKey(),
            text,
            marks: [],
          },
        ],
      }
    })
  }
  
  return []
}

/**
 * Create a draft article in Sanity
 */
export async function createDraftArticle(article) {
  if (!client) throw new Error('Sanity client not initialized')

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
      showKyndallsTake: true,
      headline: article.kyndallsTake.headline || "Kyndall's Take",
      content: article.kyndallsTake.content,
      mood: article.kyndallsTake.mood || 'recommend',
    } : undefined,
    
    // GEO Content - Critical for AI search optimization!
    // Quick Answer is THE most important GEO field for featured snippets
    quickAnswer: article.quickAnswer || null,
    
    keyTakeaways: (article.keyTakeaways || []).map(t => ({
      _type: 'takeaway',
      _key: generateKey(),
      point: t.point,
      icon: t.icon || '✨',
    })),
    
    expertTips: (article.expertTips || []).map(t => ({
      _type: 'tip',
      _key: generateKey(),
      title: t.title,
      description: t.description,
      proTip: t.proTip || null,
    })),
    
    faqSection: (article.faqSection || []).map(f => ({
      _type: 'faqItem',
      _key: generateKey(),
      question: f.question,
      answer: f.answer,
    })),
    
    // References - for E-E-A-T and GEO authority signals
    references: (article.references || []).map(ref => ({
      _type: 'sourceReference',
      _key: generateKey(),
      title: ref.title,
      publisher: ref.publisher,
      url: ref.url,
      note: ref.note || null,
      supportedSections: ref.supportedSections || [],
      dateAccessed: ref.dateAccessed || new Date().toISOString().split('T')[0],
    })),
    
    // SEO
    seoTitle: article.seoTitle || article.title,
    seoDescription: article.seoDescription || article.excerpt,
    keywords: article.keywords || [],
    
    // Metadata
    autoGenerated: true,
    publishedAt: article.publishedAt || new Date().toISOString(),
    
    // Image attribution (for Unsplash compliance)
    imageAttribution: article.imageAttribution || null,
  }

  // Remove undefined fields
  Object.keys(doc).forEach(key => {
    if (doc[key] === undefined) delete doc[key]
  })

  const result = await client.create(doc)
  console.log(`         References: ${article.references?.length || 0}`)
  return result
}

/**
 * Get recent articles to avoid duplicates
 */
export async function getRecentArticles(days = 7) {
  if (!client) throw new Error('Sanity client not initialized')
  
  const since = new Date()
  since.setDate(since.getDate() - days)
  
  const query = `*[_type == "article" && publishedAt > $since] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    category,
    publishedAt
  }`
  
  return client.fetch(query, { since: since.toISOString() })
}

/**
 * Get existing blog posts for internal linking
 */
export async function getExistingContent() {
  if (!client) throw new Error('Sanity client not initialized')
  
  const query = `{
    "blogPosts": *[_type == "blogPost" && (showInBlog == true || showInVideos == true)] | order(publishedAt desc)[0...50] {
      _id,
      title,
      "slug": slug.current,
      category,
      excerpt
    },
    "articles": *[_type == "article" && showOnSite == true] | order(publishedAt desc)[0...50] {
      _id,
      title,
      "slug": slug.current,
      category,
      excerpt
    }
  }`
  
  return client.fetch(query)
}
