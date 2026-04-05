import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { ParsedGearRequest, GearCategory, UrgencyLevel, RequestAction } from '../types';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Stable system prompt — kept frozen so it can be cached
const SYSTEM_PROMPT = `You are a gear request parser for a live-event equipment marketplace.
Users are musicians, DJs, sound engineers, and event technicians.
Parse the user's natural language message into JSON.

Rules:
- equipment: specific gear name (e.g. "XLR cable", "SM58 microphone", "DI box", "power strip")
- category: exactly one of: cables, microphones, speakers, stands, pedals, instruments, lighting, dj_gear, power, adapters, accessories
- quantity: integer, default 1
- urgency:
    "emergency" = show is live or starts in under 15 min, or words like "now", "asap", "right now", "5 min"
    "urgent"    = under 1 hour, words like "soon", "quickly", "hurry", "30 min", "45 min"
    "soon"      = today or tonight, words like "tonight", "this evening", "few hours"
    "normal"    = no rush, or just browsing
- action: "lend" (free + temporary) | "rent" (paid + temporary) | "sell" (buying/selling)
    Default to "lend" unless user mentions paying, buying, or money
- confidence: float 0.0–1.0, how certain you are about the parse
- notes: optional string, any extra context from the user's message

Respond ONLY with valid JSON matching this exact shape:
{
  "equipment": string,
  "category": string,
  "quantity": number,
  "urgency": "normal" | "soon" | "urgent" | "emergency",
  "action": "rent" | "lend" | "sell",
  "confidence": number,
  "notes": string | null
}

No explanation, no markdown, no code blocks. Raw JSON only.`.trim();

export async function parseGearRequest(rawText: string): Promise<ParsedGearRequest> {
  try {
    const response = await client.messages.create({
      // Haiku: fast + cheap — this is called on every request creation
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawText }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    const parsed = JSON.parse(text) as ParsedGearRequest;

    // Sanitize: ensure values are within valid enums
    const validCategories: GearCategory[] = [
      'cables','microphones','speakers','stands','pedals',
      'instruments','lighting','dj_gear','power','adapters','accessories',
    ];
    const validUrgencies: UrgencyLevel[] = ['normal','soon','urgent','emergency'];
    const validActions: RequestAction[] = ['rent','lend','sell'];

    return {
      equipment:  String(parsed.equipment ?? rawText.slice(0, 80)),
      category:   validCategories.includes(parsed.category as GearCategory)
                    ? parsed.category
                    : 'accessories',
      quantity:   typeof parsed.quantity === 'number' && parsed.quantity > 0
                    ? Math.floor(parsed.quantity)
                    : 1,
      urgency:    validUrgencies.includes(parsed.urgency as UrgencyLevel)
                    ? parsed.urgency
                    : 'normal',
      action:     validActions.includes(parsed.action as RequestAction)
                    ? parsed.action
                    : 'lend',
      confidence: typeof parsed.confidence === 'number'
                    ? Math.max(0, Math.min(1, parsed.confidence))
                    : 0.5,
      notes:      parsed.notes ?? undefined,
    };
  } catch {
    // Fallback: return minimal structure — stored with low confidence for review
    return {
      equipment:  rawText.slice(0, 80),
      category:   'accessories',
      quantity:   1,
      urgency:    'normal',
      action:     'lend',
      confidence: 0.05,
      notes:      'parser_fallback',
    };
  }
}
