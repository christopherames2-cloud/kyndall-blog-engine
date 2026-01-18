// kyndall-blog-engine/src/linker/internal.js
// Finds and links related content for internal SEO linking

import { createClient } from '@sanity/client'

let client = null

// Keywords that should NEVER be filtered out (even if short)
const PRESERVE_KEYWORDS = [
  'men', 'man', 'male', 'boy', 'guy',
  'women', 'woman', 'female', 'girl', 'gal',
  'teen', 'kid', 'kids', 'baby', 'mom', 'dad',
  'oily', 'dry', 'acne', 'glow', 'dewy', 'matte',
  'lip', 'eye', 'brow', 'lash', 'nail', 'hair',
  'spf', 'diy', 'bbw', 'asmr'
]

function getClient() {
  if (!client) {
    client = createClient({
      projectId: process.env.SANITY_PROJECT_ID,
      dataset: process.env.SANITY_DATASET || 'production',
      token: process.env.SANITY_TOKEN,
      apiVersion: '2024-01-01',
      useCdn: false,
    })
  }
  return client
}

/**
 * Find related content for an article
 * Returns blog posts and articles that are topically related
 */
export async function findRelatedContent(articleTitle, articleCategory) {
  const sanityClient = getClient()
  
  // Handle undefined inputs
  const title = articleTitle || ''
  const category = articleCategory || 'lifestyle'
  
  // Extract keywords from title
  const keywords = extractKeywordsFromTitle(title, category)
  
  console.log(`         Keywords: ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? '...' : ''}`)

  // Find related blog posts
  const blogPosts = await findRelatedBlogPosts(sanityClient, keywords, category)
  
  // Find related articles
  const articles = await findRelatedArticles(sanityClient, keywords, title)
  
  console.log(`         Found ${blogPosts.length} related blog posts, ${articles.length} related articles`)

  return {
    blogPosts,
    articles,
  }
}

/**
 * Extract keywords from title and category
 */
function extractKeywordsFromTitle(title, category) {
  const keywords = new Set()
  
  // Helper to check if word should be kept
  const shouldKeepWord = (w) => {
    if (!w) return false
    if (PRESERVE_KEYWORDS.includes(w)) return true
    return w.length > 3
  }
  
  // Add from title
  if (title) {
    const words = title.toLowerCase().split(/\s+/)
    words.forEach(w => shouldKeepWord(w) && keywords.add(w))
  }
  
  // Add category
  if (category) {
    keywords.add(category.toLowerCase())
  }

  return Array.from(keywords)
}

/**
 * Find related blog posts
 */
async function findRelatedBlogPosts(client, keywords, category) {
  // Ensure category is defined
  const safeCategory = category || 'lifestyle'
  
  // Build search conditions
  const searchTerms = keywords.slice(0, 10).map(k => `"${k}"`).join(', ')
  
  // Query for related posts - use showInBlog instead of status
  const query = `*[_type == "blogPost" && showInBlog == true] | score(
    title match [${searchTerms}],
    category == $category,
    excerpt match [${searchTerms}],
    boost(category == $category, 3)
  ) | order(_score desc) [0...5] {
    _id,
    title,
    "slug": slug.current,
    category,
    thumbnail,
    thumbnailUrl,
    excerpt
  }`

  try {
    const results = await client.fetch(query, { category: safeCategory })
    
    // Filter out low-relevance results
    return results.filter(post => {
      const titleLower = (post.title || '').toLowerCase()
      const hasMatch = keywords.some(k => titleLower.includes(k))
      return hasMatch || post.category === safeCategory
    }).slice(0, 3)
  } catch (error) {
    console.log(`         Blog post search error: ${error.message}`)
    
    // Fallback: simple category match
    try {
      const fallbackQuery = `*[_type == "blogPost" && showInBlog == true && category == $category] | order(publishedAt desc) [0...3] {
        _id,
        title,
        "slug": slug.current,
        category,
        thumbnail,
        thumbnailUrl
      }`
      return await client.fetch(fallbackQuery, { category: safeCategory })
    } catch (e) {
      return []
    }
  }
}

/**
 * Find related articles
 */
async function findRelatedArticles(client, keywords, currentTitle) {
  // Ensure currentTitle is defined
  const safeTitle = currentTitle || ''
  
  const searchTerms = keywords.slice(0, 10).map(k => `"${k}"`).join(', ')
  
  // Query for related articles - use showOnSite instead of status
  const query = `*[_type == "article" && showOnSite == true && title != $currentTitle] | score(
    title match [${searchTerms}],
    excerpt match [${searchTerms}]
  ) | order(_score desc) [0...3] {
    _id,
    title,
    "slug": slug.current,
    category,
    featuredImage
  }`

  try {
    const results = await client.fetch(query, { currentTitle: safeTitle })
    
    // Filter for relevance
    return results.filter(article => {
      const titleLower = (article.title || '').toLowerCase()
      return keywords.some(k => titleLower.includes(k))
    }).slice(0, 2)
  } catch (error) {
    console.log(`         Article search error: ${error.message}`)
    return []
  }
}

/**
 * Calculate content similarity score
 * Used for more advanced matching if needed
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3 || PRESERVE_KEYWORDS.includes(w)))
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3 || PRESERVE_KEYWORDS.includes(w)))
  
  let intersection = 0
  for (const word of words1) {
    if (words2.has(word)) intersection++
  }
  
  const union = words1.size + words2.size - intersection
  return union > 0 ? intersection / union : 0
}
