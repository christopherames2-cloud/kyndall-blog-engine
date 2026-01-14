// kyndall-blog-engine/src/generator/prompts.js
// GEO-optimized prompts for generating high-quality articles

/**
 * Main article content prompt
 */
export function getArticlePrompt(topic, platform, tags) {
  return `You are writing a beauty/lifestyle article for Kyndall Ames, a popular beauty content creator.

TOPIC: ${topic}
TRENDING ON: ${platform}
RELATED TAGS: ${tags.join(', ')}

Write a comprehensive, authoritative article that:
1. Positions Kyndall as an expert in this topic
2. Is optimized for AI search engines (GEO - Generative Engine Optimization)
3. Uses clear, scannable formatting
4. Provides genuine value to readers

OUTPUT FORMAT (respond in this exact JSON structure):
{
  "title": "Compelling, keyword-rich title (50-60 chars)",
  "excerpt": "Engaging summary that hooks readers and includes main keyword (150-200 chars)",
  "introduction": "2-3 paragraphs introducing the topic, establishing expertise, and previewing what readers will learn",
  "content": "Main article body with 4-6 sections. Use clear headers. Be specific and actionable. Include product recommendations where relevant. 800-1200 words total.",
  "seoTitle": "SEO-optimized title with primary keyword (50-60 chars)",
  "seoDescription": "Meta description with keyword and call-to-action (150-160 chars)",
  "keywords": ["primary keyword", "secondary keyword", "related term 1", "related term 2", "related term 3"]
}

WRITING GUIDELINES:
- Write in a warm, knowledgeable tone (like talking to a friend who happens to be a beauty expert)
- Be specific - mention actual techniques, ingredients, or products
- Include the "why" behind recommendations
- Use transition words for flow
- Avoid fluff - every sentence should add value
- Don't use "I" - write in third person or address the reader directly with "you"
- Include data points or specifics where possible (e.g., "apply in upward strokes for 60 seconds")

IMPORTANT FOR GEO:
- Use clear, declarative statements that AI can extract
- Define terms when first used
- Structure information hierarchically
- Include specific, factual information AI can cite`
}

/**
 * FAQ section prompt - CRITICAL for GEO
 */
export function getFAQPrompt(topic, excerpt) {
  return `Generate 5-7 FAQ items for an article about: "${topic}"

Context: ${excerpt}

These FAQs are CRITICAL for GEO (Generative Engine Optimization). AI engines like ChatGPT, Claude, and Perplexity frequently extract and cite FAQ content.

OUTPUT FORMAT (respond as JSON array):
[
  {
    "question": "Natural question users would actually search for",
    "answer": "Clear, concise answer in 2-3 sentences. Be specific and authoritative. Include actionable advice."
  }
]

GUIDELINES FOR EFFECTIVE FAQs:
1. Start questions with: What, How, Why, When, Can, Is, Does, Should
2. Use the exact phrases people search for
3. Answers should be self-contained (make sense without the article)
4. Include specific details (ingredients, timeframes, techniques)
5. Be definitive - avoid "it depends" unless necessary
6. Each answer should be 40-80 words

QUESTION TYPES TO INCLUDE:
- Definition/explanation question ("What is...")
- How-to question ("How do you...")
- Comparison question ("What's the difference between...")
- Best practice question ("What's the best way to...")
- Troubleshooting question ("Why does... happen?")
- Recommendation question ("What products are best for...")

Example good FAQ:
Q: "How often should you use retinol?"
A: "Start with retinol 2-3 times per week, allowing your skin to build tolerance. After 4-6 weeks, you can increase to nightly use if your skin isn't experiencing irritation. Always apply retinol at night and follow with moisturizer to minimize dryness."`
}

/**
 * Key Takeaways prompt
 */
export function getTakeawayPrompt(topic, excerpt) {
  return `Generate 3-5 key takeaways for an article about: "${topic}"

Context: ${excerpt}

Key takeaways should be:
- Scannable bullet points readers remember
- Actionable and specific
- The main value propositions of the article

OUTPUT FORMAT (respond as JSON array):
[
  {
    "point": "Clear, memorable takeaway in one sentence (under 100 chars)",
    "icon": "emoji that matches the point (✨💡⭐🎯💕🔥✅)"
  }
]

GUIDELINES:
- Each point should stand alone
- Start with action verbs when possible
- Include specific details (numbers, ingredients, techniques)
- Make them "tweet-able" - shareable insights
- Avoid generic advice - be specific to this topic

Example good takeaways:
✨ "Double cleansing removes 90% more sunscreen than single cleansing"
💡 "Apply vitamin C before sunscreen for maximum protection"
🎯 "Pat, don't rub - tapping motions increase product absorption by 30%"`
}

/**
 * Expert Tips prompt
 */
export function getTipsPrompt(topic) {
  return `Generate 3-4 expert tips for: "${topic}"

These tips should position Kyndall as a knowledgeable beauty expert sharing insider knowledge.

OUTPUT FORMAT (respond as JSON array):
[
  {
    "title": "Short, catchy tip title (5-8 words)",
    "description": "Detailed explanation of the tip with specific instructions (2-3 sentences)",
    "proTip": "Optional bonus tip for advanced users (1 sentence, or null)"
  }
]

GUIDELINES:
- Tips should feel like insider knowledge, not obvious advice
- Include specific techniques or methods
- Explain the "why" behind each tip
- Pro tips should be genuinely advanced/extra

Example good tip:
{
  "title": "The Sandwich Method for Retinol",
  "description": "Apply moisturizer, then retinol, then another layer of moisturizer. This 'sandwich' technique reduces irritation while maintaining retinol's effectiveness. It's perfect for sensitive skin or retinol beginners.",
  "proTip": "Add a drop of facial oil to your final moisturizer layer for extra barrier protection."
}`
}

/**
 * Kyndall's Take prompt - adds unique perspective
 */
export function getKyndallsTakePrompt(topic, platform) {
  return `Write "Kyndall's Take" - a personal perspective section for an article about: "${topic}"

This section differentiates the article from generic AI content by adding authentic voice and opinion.

ABOUT KYNDALL:
- Los Angeles-based beauty content creator
- Known for honest, no-BS product reviews
- Focuses on makeup, skincare, and lifestyle
- Values products that actually work over hype
- Appreciates both drugstore and luxury finds
- Trending topic found on: ${platform}

OUTPUT FORMAT (respond as JSON):
{
  "headline": "Catchy section header like 'My Honest Take' or 'Real Talk' (3-5 words)",
  "content": "2-3 paragraphs of authentic perspective. Include personal observations, honest opinions, and relatable commentary. Can mention trying products, experiences, or observations from the beauty community. 150-250 words.",
  "mood": "love|recommend|mixed|caution|skip"
}

TONE GUIDELINES:
- Conversational and authentic
- Honest but not harsh
- Include specific observations
- Can be opinionated
- Should feel like advice from a trusted friend
- Mention what works and what doesn't
- Reference the ${platform} beauty community if relevant

Example opening lines:
- "Okay, real talk about this trend..."
- "I've been seeing this everywhere and here's what I actually think..."
- "After testing this for two weeks, I have thoughts..."
- "The beauty community is divided on this, but here's where I stand..."`
}
