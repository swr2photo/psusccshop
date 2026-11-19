// Shared TypeScript types for AI-powered form comment analysis & organization.

export type FormAiSentiment = 'positive' | 'neutral' | 'negative';
export type FormAiThemeSentiment = FormAiSentiment | 'mixed';

export interface FormAiTheme {
  id: string;
  title: string;
  sentiment: FormAiThemeSentiment;
  count: number;
  summary: string;
  quotes: string[];
  tags: string[];
}

export interface FormAiOrganizedComment {
  index: number;
  category: string;
  sentiment: FormAiSentiment;
  shortSummary: string;
  originalText: string;
  questionTitle: string;
  choiceContext?: string;
}

export interface FormAiAnalysis {
  formId: string;
  generatedAt: string;
  model: string;
  responseCount: number;
  commentCount: number;
  lastResponseAt: string | null;
  executiveSummary: string;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  themes: FormAiTheme[];
  highlights: {
    supporting: string[];
    concerns: string[];
    suggestions: string[];
  };
  recommendations: string[];
  formalDraft: string;
  organizedComments: FormAiOrganizedComment[];
}
