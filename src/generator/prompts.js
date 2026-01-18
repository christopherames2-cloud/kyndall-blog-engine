// kyndall-blog-engine/src/generator/prompts.js
// GEO-optimized prompts for generating high-quality articles with Kyndall's voice
// NOW WITH quickAnswer generation for featured snippets

// Get current year dynamically
const CURRENT_YEAR = new Date().getFullYear()

/**
 * Main article content prompt - NOW INCLUDES quickAnswer
 */
export function getArticlePrompt(topic, platform, tags) {
  return `You are writing a beauty/lifestyle article for Kyndall Ames, a popular LA-based beauty content creator with 2M+ followers.

TOPIC: ${topic}
TRENDING ON: ${platform}
RELATED TAGS: ${tags.join(', ')}
CURRENT YEAR: ${CURRENT_YEAR}

KYNDALL'S BRAND VOICE:
- Warm, relatable, and conversational (like texting your best friend who's obsessed with beauty)
- Confident but not preachy - shares opinions without being judgmental
- Uses casual language: "obsessed with", "game-changer", "real talk", "I'm not gonna lie", "trust me on this"
- Sprinkles in enthusiasm naturally: "okay but can we talk about...", "here's the thing...", "and honestly?"
- Mix of playful and informative - she's fun but also really knows her stuff
- References the beauty community: "TikTok girlies know", "you've probably seen this everywhere"

Write a comprehensive article that:
1. Sounds like KYNDALL wrote it - warm, fun, knowledgeable
2. Is optimized for AI search engines (GEO - Generative Engine Optimization)
3. Uses conversational formatting (not clinical textbook style)
4. Provides genuine value while being enjoyable to read

OUTPUT FORMAT (respond in this exact JSON structure):
{
  "title": "Compelling, slightly playful title (50-60 chars) - can use colons, questions, or 'The' starters",
  "excerpt": "Engaging hook that sounds like Kyndall talking - make people want to keep reading (150-200 chars)",
  "quickAnswer": "TL;DR summary in 2-3 sentences. This is THE most important GEO field - it appears in a highlighted box and gets extracted by AI search engines. Be specific and helpful. 150-300 characters.",
  "introduction": "2-3 paragraphs setting up the topic conversationally. Start with something relatable or a hook. Establish why this matters right now. Preview what they'll learn without being dry about it.",
  "content": "Main article body with 4-6 sections. Headers should be conversational (not 'Step 1: Do X'). Be specific and actionable but SOUND like a person, not a textbook. Include product recommendations naturally. 800-1200 words total. Use markdown headers (## for H2, ### for H3).",
  "seoTitle": "SEO-optimized title (50-60 chars) - can differ from the main title",
  "seoDescription": "Meta description for search engines (150-160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Respond with ONLY valid JSON (no markdown backticks, no explanation).`
}

/**
 * FAQ generation prompt
 */
export function getFAQPrompt(topic, excerpt) {
  return `Generate 5 frequently asked questions about "${topic}" for a beauty/lifestyle article.

CONTEXT: ${excerpt}

These FAQs are CRITICAL for GEO (Generative Engine Optimization). AI search engines extract these directly for featured snippets.

Requirements:
- Questions should be what real people actually ask
- Answers should be helpful, specific, and 2-3 sentences each
- Write in Kyndall's warm, conversational voice
- Include practical, actionable advice

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "faqs": [
    { "question": "Natural question people would ask?", "answer": "Helpful 2-3 sentence answer." },
    { "question": "Another common question?", "answer": "Another helpful answer." },
    { "question": "Third question?", "answer": "Answer with specific advice." },
    { "question": "Fourth question?", "answer": "Practical answer." },
    { "question": "Fifth question?", "answer": "Final helpful answer." }
  ]
}`
}

/**
 * Key Takeaways generation prompt
 */
export function getTakeawayPrompt(topic, excerpt) {
  return `Generate 4-5 key takeaways for an article about "${topic}".

CONTEXT: ${excerpt}

These are quick, memorable points that appear in a highlighted box. They should be:
- Specific and actionable (not generic advice)
- Easy to scan and remember
- Written like Kyndall would say them

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "takeaways": [
    { "icon": "✨", "point": "First key takeaway - specific and memorable" },
    { "icon": "💧", "point": "Second key takeaway" },
    { "icon": "☀️", "point": "Third takeaway with actionable advice" },
    { "icon": "💕", "point": "Fourth takeaway" }
  ]
}

Choose icons that match the content (beauty emojis like ✨💄💋🧴💧☀️🌙💅💇‍♀️💕💎🌸).`
}

/**
 * Expert Tips generation prompt
 */
export function getTipsPrompt(topic) {
  return `Generate 2-3 expert tips about "${topic}" for Kyndall Ames' beauty/lifestyle blog.

These should be genuine pro tips that establish authority while staying conversational.

Each tip needs:
- A catchy title (3-6 words)
- A helpful description (2-3 sentences)
- An optional "pro tip" one-liner (insider knowledge)

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "tips": [
    {
      "title": "Catchy Tip Title Here",
      "description": "2-3 sentences explaining the tip in Kyndall's voice. Be specific and helpful.",
      "proTip": "One-liner insider tip (or null if not needed)"
    },
    {
      "title": "Second Tip Title",
      "description": "Description of the second tip.",
      "proTip": null
    }
  ]
}`
}

/**
 * Kyndall's Take generation prompt
 */
export function getKyndallsTakePrompt(topic, platform) {
  return `Write "Kyndall's Take" - a personal perspective section for an article about "${topic}".

This section is what differentiates the article from generic AI content. It should:
- Be authentic and personal (first person)
- Share a genuine opinion or experience
- Use Kyndall's conversational voice
- Be 2-4 sentences

This is trending on ${platform}, so you can reference that.

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "headline": "Short catchy headline (e.g., 'My Honest Take', 'Real Talk', 'The Truth Is...')",
  "content": "2-4 sentences of Kyndall's personal perspective. First person, casual, authentic. Share a real opinion.",
  "mood": "love|recommend|mixed|caution|skip"
}

Mood options:
- love: She absolutely loves this
- recommend: She thinks it's worth trying
- mixed: She has some reservations
- caution: Proceed carefully
- skip: Not for everyone`
}
