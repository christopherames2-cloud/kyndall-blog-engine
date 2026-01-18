// kyndall-blog-engine/src/generator/prompts.js
// GEO-optimized prompts for generating high-quality articles with Kyndall's voice
// UPDATED: Ensures schema-safe FAQ answers (plain text, no markdown)

// Get current year dynamically
const CURRENT_YEAR = new Date().getFullYear()

/**
 * Main article content prompt - includes quickAnswer
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
  "quickAnswer": "Direct 1-2 sentence answer to the main question this article addresses. No fluff, just the key insight. This gets pulled into AI search results, so make it count. 100-200 characters.",
  "introduction": "2-3 paragraphs setting up the topic conversationally. Start with something relatable or a hook. Establish why this matters right now. Preview what they'll learn without being dry about it.",
  "content": "Main article body with 4-6 sections. Headers should be conversational (not 'Step 1: Do X'). Be specific and actionable but SOUND like a person, not a textbook. Include product recommendations naturally. 800-1200 words total. Use markdown headers (## for H2, ### for H3).",
  "seoTitle": "SEO-optimized title (50-60 chars) - can differ from the main title",
  "seoDescription": "Meta description for search engines (150-160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Respond with ONLY valid JSON (no markdown backticks, no explanation).`
}

/**
 * FAQ generation prompt - CRITICAL: answers must be plain text for schema.org
 */
export function getFAQPrompt(topic, excerpt) {
  return `Generate 5-7 frequently asked questions about "${topic}" for a beauty/lifestyle article.

CONTEXT: ${excerpt}

These FAQs are CRITICAL for GEO (Generative Engine Optimization). AI search engines extract these directly for featured snippets and voice search results.

REQUIREMENTS:
1. Questions should be REAL queries people type into Google or ask voice assistants
2. Start questions with: "What", "How", "Why", "Can", "Is", "Does", "Should", "When"
3. Answers must be PLAIN TEXT ONLY - no markdown, no bullet points, no formatting
4. Each answer should be 2-4 sentences, directly addressing the question
5. Write in Kyndall's warm, conversational voice
6. Include specific, actionable information
7. DO NOT include disclaimers like "consult a dermatologist" unless medically necessary
8. DO NOT use phrases like "it depends" without giving actual guidance

EXAMPLES OF GOOD Q&A:
Q: "How long does it take to see results from retinol?"
A: "Most people start noticing smoother skin texture within 4-6 weeks of consistent use. For more significant changes like reduced fine lines, give it 3-6 months. Starting slow with 2-3 times per week helps your skin adjust without irritation."

Q: "Can I use vitamin C and niacinamide together?"
A: "Yes, you absolutely can! The old myth about them canceling each other out has been debunked. I actually layer them in my morning routine - vitamin C first, then niacinamide. Your skin will thank you for the brightening boost."

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "faqs": [
    { "question": "Natural question phrased as users would search?", "answer": "Direct, helpful 2-4 sentence answer. Plain text only. No bullet points or markdown." },
    { "question": "Another common question about this topic?", "answer": "Another helpful plain text answer with specific advice." },
    { "question": "Third question users frequently ask?", "answer": "Answer with actionable tips in conversational tone." },
    { "question": "Fourth question?", "answer": "Practical answer." },
    { "question": "Fifth question?", "answer": "Helpful answer." },
    { "question": "Sixth question?", "answer": "Final useful answer." }
  ]
}`
}

/**
 * Key Takeaways generation prompt
 */
export function getTakeawayPrompt(topic, excerpt) {
  return `Generate 4-6 key takeaways for an article about "${topic}".

CONTEXT: ${excerpt}

These are quick, memorable points that appear in a highlighted box at the top of the article. They're perfect for:
- Featured snippets in Google
- Quick scanning by readers
- AI extraction for summaries

REQUIREMENTS:
- Each takeaway should be ONE specific, actionable insight
- Use active voice and present tense
- Be concrete, not vague (bad: "skincare is important" / good: "apply SPF 30+ every morning, even on cloudy days")
- Write like Kyndall would say them - casual but knowledgeable
- Start each point with an action verb when possible

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "takeaways": [
    { "icon": "✨", "point": "First key takeaway - specific and actionable" },
    { "icon": "💧", "point": "Second key takeaway with concrete advice" },
    { "icon": "☀️", "point": "Third takeaway that readers can immediately use" },
    { "icon": "💕", "point": "Fourth takeaway" },
    { "icon": "💡", "point": "Fifth takeaway if relevant" }
  ]
}

Choose icons that match the content:
- Skincare: 💧✨🧴💆‍♀️☀️🌙
- Makeup: 💄💋👁️🎨💅
- Hair: 💇‍♀️✂️🧴
- General: 💕💡⭐💎✅`
}

/**
 * Expert Tips generation prompt
 */
export function getTipsPrompt(topic) {
  return `Generate 2-3 expert tips about "${topic}" for Kyndall Ames' beauty/lifestyle blog.

These should be genuine pro tips that establish authority while staying conversational. Think "insider knowledge from a friend who really knows her stuff."

EACH TIP NEEDS:
1. Title: Catchy, 3-6 words, sounds like advice from a friend
2. Description: 2-3 sentences explaining the tip. Be specific! Include product types, techniques, or timeframes.
3. Pro Tip (optional): One-liner bonus insight - the kind of thing you learn from experience

EXAMPLES:
{
  "title": "Layer Thinnest to Thickest",
  "description": "Always apply your skincare from the lightest consistency to the heaviest. This means essence before serum, serum before moisturizer. It helps each product actually penetrate instead of just sitting on top.",
  "proTip": "Wait 30-60 seconds between layers for better absorption!"
}

{
  "title": "Set Your Under-Eyes Last",
  "description": "Instead of setting your whole face at once, leave your under-eyes for last. This prevents that dry, cakey look and keeps your concealer looking fresh all day.",
  "proTip": null
}

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
      "description": "Description of the second tip with specific advice.",
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

This section is what differentiates the article from generic AI content. It should feel like Kyndall is sharing her honest opinion with a friend.

REQUIREMENTS:
- First person voice ("I", "my", "I've been")
- Share a genuine opinion or personal experience
- 2-4 sentences maximum
- Can reference the trend/platform: "I've been seeing this all over ${platform}"
- Be authentic - it's okay to have mixed feelings or caveats
- End with something actionable or encouraging

MOOD OPTIONS (pick the most honest one):
- love: She's genuinely obsessed with this
- recommend: She thinks it's worth trying for most people
- mixed: She sees pros and cons, or it's not for everyone
- caution: There are things to watch out for
- skip: Honestly, most people can pass on this

EXAMPLES:
{
  "headline": "My Honest Take",
  "content": "Okay real talk - I was skeptical when I first saw this trending, but after trying it for two weeks? I'm converted. My skin has never looked this glowy in the morning. That said, if you have super sensitive skin, maybe start with once a week.",
  "mood": "recommend"
}

{
  "headline": "The Truth Is...",
  "content": "I've tried this three different times hoping I'd finally get it, and honestly? It's just not for me. The formula is beautiful but the shade range is so limited. If you're fair to light-medium, you might love it - but I wish brands would do better.",
  "mood": "mixed"
}

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "headline": "Short catchy headline (e.g., 'My Honest Take', 'Real Talk', 'The Truth Is...')",
  "content": "2-4 sentences of Kyndall's personal perspective. First person, casual, authentic. Share a real opinion.",
  "mood": "love|recommend|mixed|caution|skip"
}`
}
