
export interface ResumeAnalysisResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  atsKeywords: string[];
  actionableImprovements: string[];
}

export interface InterviewFeedback {
  clarity: string;
  confidence: string;
  relevance: string;
}

export interface InterviewMessage {
  role: 'user' | 'model';
  content: string;
  feedback?: InterviewFeedback;
}

export interface InterviewSummary {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
}
