// kyndall-blog-engine/src/generator/prompts.js
// GEO-optimized prompts for generating high-quality articles with Kyndall's voice

// Get current year dynamically
const CURRENT_YEAR = new Date().getFullYear()

/**
 * Main article content prompt
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
  "introduction": "2-3 paragraphs setting up the topic conversationally. Start with something relatable or a hook. Establish why this matters right now. Preview what they'll learn without being dry about it.",
  "content": "Main article body with 4-6 sections. Headers should be conversational (not 'Step 1: Do X'). Be specific and actionable but SOUND like a person, not a textbook. Include product recommendations naturally. 800-1200 words total.",
  "seoTitle": "SEO-optimized title with primary keyword (50-60 chars)",
  "seoDescription": "Meta description with keyword and personality (150-160 chars)",
  "keywords": ["primary keyword", "secondary keyword", "related term 1", "related term 2", "related term 3"]
}

WRITING STYLE GUIDELINES:
- Write like you're talking to a friend, not giving a lecture
- Use "you" and "your" freely - make it personal
- Short paragraphs (2-4 sentences max) - easy to skim
- Vary sentence length - mix punchy short ones with longer explanations
- Include the "why" but make it interesting, not clinical
- Okay to use casual phrases: "here's the deal", "spoiler alert", "game-changer", "not gonna lie"
- Product mentions should feel like genuine recommendations, not ads
- Headers should be engaging, not boring (e.g., "The Lazy Girl's Secret Weapon" not "Step 3: Apply Moisturizer")

WHAT TO AVOID:
- Clinical/medical textbook language ("trans-epidermal water loss", "dermatological studies show")
- Stiff formal phrases ("it is important to note", "one should consider")
- Boring step-by-step headers ("Step 1:", "Step 2:")
- Walls of text - break it up!
- Being preachy or condescending
- Generic advice that could apply to anyone

EXAMPLE GOOD VS BAD:

❌ BAD (clinical): "Dermatological research indicates that the skin barrier requires approximately 28 days to undergo complete cellular turnover."

✅ GOOD (Kyndall): "Here's something I wish someone told me sooner: your skin needs about a month to really show changes. I know, I know - we all want overnight results. But trust the process, babe."

❌ BAD header: "Step 1: The 7-Day Simplification Period"
✅ GOOD header: "Week One: Strip It Back (Trust Me)"

❌ BAD header: "Strategic Active Ingredient Reintroduction"  
✅ GOOD header: "Slowly Bringing Back the Good Stuff"

YEAR REFERENCES:
- Current year is ${CURRENT_YEAR}
- Prefer timeless titles unless topic is specifically about trends
- Can reference "this year" or "lately" instead of the specific year

GEO OPTIMIZATION (do this while keeping the voice):
- Make clear, quotable statements AI can extract
- Define trendy terms when first used (but casually)
- Include specific details (ingredients, timing, techniques)
- Structure info so AI can understand and cite it`
}

/**
 * FAQ section prompt - CRITICAL for GEO
 */
export function getFAQPrompt(topic, excerpt) {
  return `Generate 5-7 FAQ items for an article about: "${topic}"

Context: ${excerpt}
Current Year: ${CURRENT_YEAR}

These FAQs are CRITICAL for GEO (Generative Engine Optimization). AI engines frequently extract and cite FAQ content.

Keep Kyndall's conversational voice in the answers - informative but warm and relatable.

OUTPUT FORMAT (respond as JSON array):
[
  {
    "question": "Natural question users would actually search for",
    "answer": "Clear, helpful answer in 2-3 sentences. Be specific but sound like a real person giving advice, not a medical pamphlet."
  }
]

GUIDELINES FOR EFFECTIVE FAQs:
1. Questions should sound like what real people type into Google
2. Answers should be helpful AND sound human
3. Include specific details (ingredients, timeframes, techniques)
4. Be definitive when possible - people want real answers
5. Each answer should be 40-80 words
6. Okay to use casual language: "honestly", "the key is", "most people find that"

QUESTION TYPES TO INCLUDE:
- "What is..." (definition)
- "How do you..." (how-to)
- "Is it okay to..." (permission/validation)
- "What's the best..." (recommendations)
- "How long does it take..." (expectations)
- "Can I..." (common concerns)

EXAMPLE GOOD FAQ:
Q: "How often should you use retinol?"
A: "Start slow - like 2-3 times a week max. Your skin needs time to get used to it! After about a month, you can bump it up to every night if your skin's handling it well. And always, always moisturize after. Your skin will thank you."`
}

/**
 * Key Takeaways prompt
 */
export function getTakeawayPrompt(topic, excerpt) {
  return `Generate 3-5 key takeaways for an article about: "${topic}"

Context: ${excerpt}
Current Year: ${CURRENT_YEAR}

These should be the "aha moments" readers remember and want to share.

OUTPUT FORMAT (respond as JSON array):
[
  {
    "point": "Clear, memorable takeaway that sounds like friendly advice (under 100 chars)",
    "icon": "emoji that matches the vibe (✨💡⭐🎯💕🔥✅💖🙌)"
  }
]

GUIDELINES:
- Should sound like tips you'd text your bestie
- Specific and actionable, not generic fluff
- Mix of practical ("do this") and mindset ("remember this")
- Make them quotable/shareable

EXAMPLE GOOD TAKEAWAYS:
✨ "Your skin needs a full month to show real changes - patience is everything"
💡 "One new product at a time, always. Your skin will tell you what it loves"
🔥 "Hydration layering isn't extra - it's the secret to that glass skin look"
💕 "Consistency beats intensity every single time"`
}

/**
 * Expert Tips prompt
 */
export function getTipsPrompt(topic) {
  return `Generate 3-4 expert tips for: "${topic}"

Current Year: ${CURRENT_YEAR}

These tips should feel like insider secrets from someone who really knows their stuff - but shared in a friendly, accessible way.

OUTPUT FORMAT (respond as JSON array):
[
  {
    "title": "Short, catchy tip title (5-8 words)",
    "description": "The actual tip with specific how-to details. Sound like you're sharing a secret with a friend, not reading from a textbook. (2-3 sentences)",
    "proTip": "Optional extra insider knowledge for the overachievers (1 sentence, or null)"
  }
]

GUIDELINES:
- Tips should feel like "omg why didn't anyone tell me this sooner"
- Be specific - vague tips are useless tips
- The proTip is for the beauty nerds who want to go deeper
- Keep it real and actionable

EXAMPLE GOOD TIP:
{
  "title": "The Damp Skin Trick That Changes Everything",
  "description": "Apply your serums and moisturizers while your skin is still slightly damp from cleansing. It helps everything absorb way better and your products actually work harder. Game-changer for dry skin especially.",
  "proTip": "For extra glow, mist your face with a hydrating toner between each layer."
}`
}

/**
 * Kyndall's Take prompt - adds unique perspective
 */
export function getKyndallsTakePrompt(topic, platform) {
  return `Write "Kyndall's Take" - a personal perspective section for an article about: "${topic}"

This is the most important section for authenticity - it's what makes the article KYNDALL'S, not just generic content.

ABOUT KYNDALL:
- LA-based beauty creator with 2M+ followers
- Known for being real and honest - no fake enthusiasm
- Loves finding what actually works (drugstore or luxury)
- Part of the ${platform} beauty community
- Her followers trust her because she keeps it 100

CURRENT YEAR: ${CURRENT_YEAR}

OUTPUT FORMAT (respond as JSON):
{
  "headline": "Something that sounds like her - 'Real Talk', 'My Honest Take', 'Okay But Actually...', 'Here's What I Really Think' (3-6 words)",
  "content": "2-3 paragraphs of genuine perspective. Share what you actually think about this trend/topic. Be honest - if something is overhyped, say so. If you're obsessed, show that enthusiasm. Include specific observations. Can reference trying things, community reactions, or what you've seen work. 150-250 words.",
  "mood": "love|recommend|mixed|caution|skip"
}

TONE:
- This should sound the MOST like Kyndall talking
- Honest opinions - not everything is "amazing"
- Specific observations ("I noticed that...", "What actually works is...")
- Can be opinionated - that's the point
- Reference the ${platform} community naturally
- End with clear guidance (what to try, what to skip, who this is for)

EXAMPLE OPENERS:
- "Okay real talk? I was skeptical about this at first..."
- "The ${platform} girlies are going crazy for this and honestly? I get it."
- "I've been testing this for weeks now and here's where I've landed..."
- "This is one of those trends that sounds better than it actually is..."
- "Not gonna lie, this one exceeded my expectations..."`
}
