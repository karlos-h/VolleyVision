import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../middleware/errorHandler';
import type { MatchReportData } from './report.service';

export async function narrateMatchReport(report: MatchReportData): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError(500, 'AI narration is not configured.');

  const client = new Anthropic({ apiKey });

  const prompt = `You are given a structured volleyball match report as JSON. Write a concise coaching summary (3–5 paragraphs) covering: the match result and set scores; top performer contributions (name specific stats from the report); attacking efficiency (cite the exact figures present); serving effectiveness (cite the exact figures present); and up to two coaching observations — each observation must explicitly reference the specific number from the report that supports it (e.g. "hitting percentage of .180 suggests…"). Do not mention any dimension of play that has no corresponding data in the report. Do not infer trends, tendencies, or patterns beyond what a single match's numbers directly show.

Match Report:
${JSON.stringify(report, null, 2)}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are an expert volleyball analyst and coaching assistant. Your role is to produce factual, data-grounded match summaries for coaching staff. STRICT RULE: every statement you make — including all coaching observations — must be a direct, traceable interpretation of a specific value present in the JSON report you are given. Never invent, estimate, extrapolate, or imply any statistic, trend, player quality, or tactical recommendation that cannot be pinned to a concrete field in the data. If the data does not support a claim, omit the claim entirely. Do not fill gaps with plausible-sounding volleyball knowledge.',
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}
