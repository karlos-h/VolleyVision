import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../middleware/errorHandler';
import type { MatchReportData } from './report.service';

export async function narrateMatchReport(report: MatchReportData): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError(500, 'AI narration is not configured.');

  const client = new Anthropic({ apiKey });

  const prompt = `You are given a structured volleyball match report. Write a concise coaching summary (3-5 paragraphs) that highlights the result, key moments, top performer contributions, attacking efficiency, serving effectiveness, and one or two actionable coaching observations. Use a professional, analytical tone appropriate for a head coach reviewing match footage.

Match Report:
${JSON.stringify(report, null, 2)}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are an expert volleyball analyst and coaching assistant. Produce clear, concise, and actionable match summaries for coaching staff.',
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}
