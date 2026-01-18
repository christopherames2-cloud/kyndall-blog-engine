// kyndall-blog-engine/src/references-migrate.js
// References Migration Module
// Automatically adds references to existing articles missing them
// Can run on startup, after generation, or via /backfill-references endpoint

import Anthropic from '@anthropic-ai/sdk'

let anthropicClient = null
let sanityClient = null

// ============================================================
// INITIALIZATION
// ============================================================

export function initReferencesMigration(anthropicApiKey, sanityClientInstance) {
  anthropicClient = new Anthropic({ apiKey: anthropicApiKey })
  sanityClient = sanityClientInstance
  console.log('✅ References Migration module initialized')
  
  // Auto-run type migration on init (fixes old 'reference' -> 'sourceReference')
  migrateReferenceTypes().catch(err => {
    console.error('⚠️ Reference type migration error:', err.message)
  })
}

// ============================================================
// FIX OLD REFERENCE TYPES (one-time auto-migration)
// ============================================================

async function migrateReferenceTypes() {
  if (!sanityClient) return
  
  console.log('🔧 Checking for old reference types to migrate...')
  
  // Find articles with references that have wrong _type
  const articles = await sanityClient.fetch(`
    *[_type == "article" && defined(references) && count(references) > 0] {
      _id,
      title,
      references
    }
  `)
  
  let migrated = 0
  
  for (const article of articles) {
    const needsMigration = article.references?.some(ref => ref._type === 'reference')
    
    if (!needsMigration) continue
    
    const updatedReferences = article.references.map(ref => ({
      ...ref,
      _type: 'sourceReference',
    }))
    
    try {
      await sanityClient
        .patch(article._id)
        .set({ references: updatedReferences })
        .commit()
      
      migrated++
      console.log(`   ✅ Fixed reference types: ${article.title.substring(0, 40)}...`)
    } catch (error) {
      console.error(`   ❌ Migration error for ${article._id}: ${error.message}`)
    }
  }
  
  if (migrated > 0) {
    console.log(`🔧 Migrated ${migrated} article(s) to new reference type`)
  } else {
    console.log('🔧 No reference type migrations needed')
  }
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
// FETCH ARTICLES NEEDING REFERENCES
// ============================================================

async function getArticlesNeedingReferences(limit = 10) {
  const query = `*[_type == "article" && (
    !defined(references) || 
    references == null ||
    count(references) == 0
  )] | order(publishedAt desc)[0...$limit] {
    _id,
    title,
    "slug": slug.current,
    category,
    excerpt,
    quickAnswer,
    introduction,
    mainContent,
    faqSection[] { question, answer },
    references
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
// GENERATE REFERENCES WITH CLAUDE
// ============================================================

async function generateReferencesForArticle(article) {
  const introText = extractTextFromPortableText(article.introduction)
  const mainText = extractTextFromPortableText(article.mainContent)
  const contentSummary = `${introText}\n\n${mainText}`.substring(0, 1000)
  const faqText = article.faqSection?.map(f => `Q: ${f.question}`).join('\n') || ''

  const prompt = `You are a research assistant finding authoritative references for a beauty/lifestyle article.

ARTICLE TITLE: ${article.title}
CATEGORY: ${article.category || 'beauty'}
EXCERPT: ${article.excerpt || ''}
QUICK ANSWER: ${article.quickAnswer || ''}

CONTENT SUMMARY:
${contentSummary}

FAQ QUESTIONS:
${faqText}

YOUR TASK:
Find 3-5 REAL, AUTHORITATIVE references that support claims in this article.

═══════════════════════════════════════════════════════════════
⚠️  CRITICAL: SOURCE VERIFICATION RULES
═══════════════════════════════════════════════════════════════

1. ONLY cite sources you are CERTAIN exist with REAL URLs
2. If you're not 100% sure a URL exists, DO NOT include it
3. Better to return 2-3 verified sources than 5 questionable ones

SOURCE QUALITY HIERARCHY (prefer higher tiers):

TIER 1 - BEST (medical/scientific claims):
- PubMed studies: https://pubmed.ncbi.nlm.nih.gov/[ID]/
- NIH resources: https://www.nih.gov/...
- FDA: https://www.fda.gov/...
- AAD (dermatology): https://www.aad.org/...

TIER 2 - GOOD (health content):
- Healthline: https://www.healthline.com/...
- WebMD: https://www.webmd.com/...
- Mayo Clinic: https://www.mayoclinic.org/...
- Cleveland Clinic: https://my.clevelandclinic.org/...

TIER 3 - ACCEPTABLE (beauty/lifestyle):
- Allure: https://www.allure.com/...
- Byrdie: https://www.byrdie.com/...
- Vogue: https://www.vogue.com/...

NEVER USE:
- Random blogs, Pinterest, Reddit, Quora
- Affiliate sites, Wikipedia
- Any URL you're not certain exists

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "references": [
    {
      "title": "Exact Title of Article or Study",
      "publisher": "Publication Name",
      "url": "https://verified-real-url.com/path",
      "note": "Supports the claim about [specific claim].",
      "supportedSections": ["Quick Answer", "Section Name"]
    }
  ]
}

If you cannot find enough verified sources, return fewer. Quality over quantity.
Respond with ONLY valid JSON.`

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const refs = parsed.references || []
      
      // Validate and format for Sanity
      const today = new Date().toISOString().split('T')[0]
      return refs
        .filter(ref => ref.title && ref.publisher && ref.url?.startsWith('http'))
        .map(ref => ({
          _type: 'sourceReference',
          _key: generateKey(),
          title: ref.title,
          publisher: ref.publisher,
          url: ref.url,
          note: ref.note || null,
          supportedSections: ref.supportedSections || [],
          dateAccessed: today,
        }))
    }
  } catch (error) {
    console.error(`   ❌ Error generating references: ${error.message}`)
  }
  
  return []
}

// ============================================================
// UPDATE ARTICLE WITH REFERENCES
// ============================================================

async function updateArticleReferences(articleId, references) {
  try {
    await sanityClient
      .patch(articleId)
      .set({ references })
      .commit()
    return true
  } catch (error) {
    console.error(`   ❌ Failed to update ${articleId}: ${error.message}`)
    return false
  }
}

// ============================================================
// MAIN MIGRATION FUNCTION
// ============================================================

export async function runReferencesMigration(maxArticles = 5) {
  if (!anthropicClient || !sanityClient) {
    console.log('⚠️  References Migration not initialized')
    return { processed: 0, updated: 0, errors: 0 }
  }

  console.log('\n📚 REFERENCES MIGRATION')
  console.log('═══════════════════════════════════════')

  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    articles: []
  }

  try {
    // Fetch articles needing references
    const articles = await getArticlesNeedingReferences(maxArticles)
    console.log(`   Found ${articles.length} article(s) needing references`)

    if (articles.length === 0) {
      console.log('   ✅ All articles have references!')
      return results
    }

    for (const article of articles) {
      console.log(`\n   📝 Processing: ${article.title.substring(0, 50)}...`)
      results.processed++

      try {
        // Generate references
        const references = await generateReferencesForArticle(article)

        if (references.length === 0) {
          console.log(`      ⚠️  No references generated`)
          results.skipped++
          continue
        }

        console.log(`      ✓ Generated ${references.length} references`)
        references.forEach((ref, i) => {
          console.log(`         ${i + 1}. ${ref.publisher}: ${ref.title.substring(0, 40)}...`)
        })

        // Update article
        const success = await updateArticleReferences(article._id, references)

        if (success) {
          console.log(`      ✅ Updated successfully`)
          results.updated++
          results.articles.push({
            title: article.title,
            slug: article.slug,
            referencesAdded: references.length
          })
        } else {
          results.errors++
        }

        // Rate limiting
        await sleep(2000)

      } catch (error) {
        console.error(`      ❌ Error: ${error.message}`)
        results.errors++
      }
    }

  } catch (error) {
    console.error(`   ❌ Migration error: ${error.message}`)
    results.errors++
  }

  console.log('\n═══════════════════════════════════════')
  console.log(`   Processed: ${results.processed}`)
  console.log(`   Updated:   ${results.updated}`)
  console.log(`   Skipped:   ${results.skipped}`)
  console.log(`   Errors:    ${results.errors}`)
  console.log('═══════════════════════════════════════\n')

  return results
}

export default runReferencesMigration
