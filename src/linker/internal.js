// kyndall-blog-engine/src/linker/internal.js
// Finds and links related content for internal SEO linking

import { createClient } from '@sanity/client'

let client = null

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
export async function findRelatedContent(article, trend) {
  const sanityClient = getClient()
  
  // Extract keywords for matching
  const keywords = extractKeywords(article, trend)
  
  console.log(`         Keywords: ${keywords.slice(0, 5).join(', ')}...`)

  // Find related blog posts
  const blogPosts = await findRelatedBlogPosts(sanityClient, keywords, article.category)
  
  // Find related articles
  const articles = await findRelatedArticles(sanityClient, keywords, article.title)
  
  console.log(`         Found ${blogPosts.length} related blog posts, ${articles.length} related articles`)

  return {
    blogPosts,
    articles,
  }
}

/**
 * Extract keywords from article content for matching
 */
function extractKeywords(article, trend) {
  const keywords = new Set()
  
  // Add from trend
  if (trend.topic) {
    const words = trend.topic.toLowerCase().split(/\s+/)
    words.forEach(w => w.length > 3 && keywords.add(w))
  }
  if (trend.tags) {
    trend.tags.forEach(t => keywords.add(t.toLowerCase()))
  }
  
  // Add from article
  if (article.title) {
    const words = article.title.toLowerCase().split(/\s+/)
    words.forEach(w => w.length > 3 && keywords.add(w))
  }
  if (article.keywords) {
    article.keywords.forEach(k => keywords.add(k.toLowerCase()))
  }
  
  // Add category
  if (article.category) {
    keywords.add(article.category)
  }

  return Array.from(keywords)
}

/**
 * Find related blog posts
 */
async function findRelatedBlogPosts(client, keywords, category) {
  // Build search conditions
  const searchTerms = keywords.slice(0, 10).map(k => `"${k}"`).join(', ')
  
  // Query for related posts
  const query = `*[_type == "blogPost" && status == "published"] | score(
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
    const results = await client.fetch(query, { category })
    
    // Filter out low-relevance results
    return results.filter(post => {
      const titleLower = (post.title || '').toLowerCase()
      const hasMatch = keywords.some(k => titleLower.includes(k))
      return hasMatch || post.category === category
    }).slice(0, 3)
  } catch (error) {
    console.log(`         Blog post search error: ${error.message}`)
    
    // Fallback: simple category match
    try {
      const fallbackQuery = `*[_type == "blogPost" && status == "published" && category == $category] | order(publishedAt desc) [0...3] {
        _id,
        title,
        "slug": slug.current,
        category,
        thumbnail,
        thumbnailUrl
      }`
      return await client.fetch(fallbackQuery, { category })
    } catch (e) {
      return []
    }
  }
}

/**
 * Find related articles
 */
async function findRelatedArticles(client, keywords, currentTitle) {
  const searchTerms = keywords.slice(0, 10).map(k => `"${k}"`).join(', ')
  
  const query = `*[_type == "article" && status == "published" && title != $currentTitle] | score(
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
    const results = await client.fetch(query, { currentTitle })
    
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
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  
  let intersection = 0
  for (const word of words1) {
    if (words2.has(word)) intersection++
  }
  
  const union = words1.size + words2.size - intersection
  return union > 0 ? intersection / union : 0
}
