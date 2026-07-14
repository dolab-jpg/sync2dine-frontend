import { buildChatSystemPrompt } from './aiPromptBuilder';
import { integrationService } from './integrations/integrationService';

export async function sendChatMessage(
  messages: { role: string; content: string }[],
  pageContext: Record<string, unknown>,
  tradeName: string | null
): Promise<string> {
  const openaiConfig = integrationService.getConfig('openai');
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        systemPrompt: buildChatSystemPrompt(tradeName, pageContext),
        apiKey: integrationService.getLiveOpenAIApiKey(),
        model: openaiConfig.staffModel || 'gpt-4o-mini',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.content ?? data.message ?? 'No response';
    }
  } catch {
    // mock
  }

  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? '';
  if (last.includes('quote') || last.includes('estimate')) {
    return "Right — describe the job and chuck us a few photos if you've got them. I'll sketch a ballpark figure; someone from the team will confirm on site before anything's final.";
  }
  if (last.includes('price') || last.includes('cost')) {
    return "Tell me what sort of job it is and roughly how big — I'll work up an indicative range. Proper quote follows a site look.";
  }
  return "TradePro AI here (mock mode). Ask about quotes, site photos, or project updates — or set OPENAI_API_KEY in Settings for the full experience.";
}
