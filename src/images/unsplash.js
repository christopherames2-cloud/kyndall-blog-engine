// kyndall-blog-engine/src/images/unsplash.js
// Fetches royalty-free images from Unsplash for articles

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

// Beauty/skincare related search term mappings
const CATEGORY_SEARCH_TERMS = {
  makeup: ['makeup tutorial', 'cosmetics flatlay', 'beauty products', 'lipstick aesthetic'],
  skincare: ['skincare routine', 'skincare products', 'face serum', 'glowing skin'],
  nails: ['nail art', 'manicure', 'nail polish'],
  hair: ['hairstyle', 'hair care', 'beautiful hair'],
  fashion: ['fashion aesthetic', 'outfit flatlay', 'style'],
  lifestyle: ['self care', 'wellness aesthetic', 'lifestyle flatlay'],
  trending: ['beauty trends', 'viral beauty', 'aesthetic flatlay'],
}

/**
 * Search Unsplash for a relevant image
 */
export async function searchUnsplashImage(topic, category = 'lifestyle') {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('   ⚠️ No Unsplash API key - skipping image')
    return null
  }

  // UTM parameters for attribution (required by Unsplash)
  const UTM_PARAMS = '?utm_source=kyndall_ames_blog&utm_medium=referral'

  try {
    // Build search query from topic + category terms
    const categoryTerms = CATEGORY_SEARCH_TERMS[category] || CATEGORY_SEARCH_TERMS.lifestyle
    const randomTerm = categoryTerms[Math.floor(Math.random() * categoryTerms.length)]
    
    // Extract key words from topic
    const topicWords = topic.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .filter(w => w.length > 3)
      .slice(0, 3)
      .join(' ')
    
    const searchQuery = `${topicWords} ${randomTerm}`.trim()
    console.log(`   🔍 Searching Unsplash: "${searchQuery}"`)

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    )

    if (!response.ok) {
      console.log(`   ⚠️ Unsplash API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      // Fallback to just category search
      console.log(`   🔄 No results, trying category fallback...`)
      return await searchFallback(randomTerm, UTM_PARAMS)
    }

    // Pick a random image from top results for variety
    const randomIndex = Math.floor(Math.random() * Math.min(3, data.results.length))
    const photo = data.results[randomIndex]

    console.log(`   ✅ Found image by ${photo.user.name}`)

    return {
      url: photo.urls.regular, // Hotlinked URL (required by Unsplash)
      thumbnailUrl: photo.urls.small,
      alt: photo.alt_description || `${topic} - beauty tips`,
      credit: {
        name: photo.user.name,
        username: photo.user.username,
        // Links with UTM parameters (required by Unsplash)
        photographerUrl: `${photo.user.links.html}${UTM_PARAMS}`,
        unsplashUrl: `https://unsplash.com${UTM_PARAMS}`,
      },
      unsplashId: photo.id,
      downloadUrl: photo.links.download_location, // For tracking (required by Unsplash)
      // Pre-formatted attribution text for display
      attributionHtml: `Photo by <a href="${photo.user.links.html}${UTM_PARAMS}" target="_blank" rel="noopener noreferrer">${photo.user.name}</a> on <a href="https://unsplash.com${UTM_PARAMS}" target="_blank" rel="noopener noreferrer">Unsplash</a>`,
      attributionText: `Photo by ${photo.user.name} on Unsplash`,
    }

  } catch (error) {
    console.error('   ❌ Unsplash error:', error.message)
    return null
  }
}

/**
 * Fallback search with simpler terms
 */
async function searchFallback(term, UTM_PARAMS) {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=5&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    if (!data.results || data.results.length === 0) return null

    const photo = data.results[0]
    
    return {
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      alt: photo.alt_description || 'Beauty and skincare tips',
      credit: {
        name: photo.user.name,
        username: photo.user.username,
        photographerUrl: `${photo.user.links.html}${UTM_PARAMS}`,
        unsplashUrl: `https://unsplash.com${UTM_PARAMS}`,
      },
      unsplashId: photo.id,
      downloadUrl: photo.links.download_location,
      attributionHtml: `Photo by <a href="${photo.user.links.html}${UTM_PARAMS}" target="_blank" rel="noopener noreferrer">${photo.user.name}</a> on <a href="https://unsplash.com${UTM_PARAMS}" target="_blank" rel="noopener noreferrer">Unsplash</a>`,
      attributionText: `Photo by ${photo.user.name} on Unsplash`,
    }
  } catch (error) {
    return null
  }
}

/**
 * Track download (Unsplash API requirement)
 */
export async function trackDownload(downloadUrl) {
  if (!UNSPLASH_ACCESS_KEY || !downloadUrl) return
  
  try {
    await fetch(downloadUrl, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    })
  } catch (error) {
    // Silent fail - not critical
  }
}
