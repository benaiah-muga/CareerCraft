
import { GoogleGenAI, Type } from "@google/genai";
import type { ResumeAnalysisResult, InterviewMessage, InterviewSummary, InterviewFeedback } from '../types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const resumeSchema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.INTEGER, description: "A score from 1 to 100 for the resume." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Concise bullet points on what the resume does well." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Concise bullet points on areas for improvement." },
        atsKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of suggested keywords to improve ATS compatibility." },
        actionableImprovements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific, actionable steps the user can take to improve their resume." },
    },
    required: ["score", "strengths", "weaknesses", "atsKeywords", "actionableImprovements"],
};

const interviewFeedbackSchema = {
    type: Type.OBJECT,
    properties: {
        feedback: {
            type: Type.OBJECT,
            properties: {
                clarity: { type: Type.STRING, description: "Feedback on the clarity of the user's response." },
                confidence: { type: Type.STRING, description: "Feedback on the confidence projected in the response." },
                relevance: { type: Type.STRING, description: "Feedback on the relevance of the response to the question." },
            },
            required: ["clarity", "confidence", "relevance"],
        },
        nextQuestion: { type: Type.STRING, description: "The next interview question to ask the user." },
    },
    required: ["feedback", "nextQuestion"],
};

const interviewSummarySchema = {
    type: Type.OBJECT,
    properties: {
        overallScore: { type: Type.INTEGER, description: "An overall performance score from 1 to 100." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key strengths demonstrated during the interview." },
        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific areas for improvement." },
    },
    required: ["overallScore", "strengths", "areasForImprovement"],
};

export const analyzeResume = async (resumeText: string, jobTitle: string, companyName?: string, jobDescription?: string): Promise<ResumeAnalysisResult> => {
    const prompt = `You are an expert career coach and resume reviewer. Analyze the following resume for the target role of "${jobTitle}" ${companyName ? `at "${companyName}"` : ''}. 
    ${jobDescription ? `Here is the job description: "${jobDescription}"` : ''}
    The resume text is: "${resumeText}".
    Provide a detailed analysis in JSON format. The feedback should be concise, professional, and encouraging.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: resumeSchema,
            },
        });
        const parsedResult = JSON.parse(response.text);
        return parsedResult as ResumeAnalysisResult;
    } catch (error) {
        console.error("Error analyzing resume:", error);
        throw new Error("Failed to get analysis from AI. Please try again.");
    }
};

export const startInterview = async (jobTitle: string, companyName?: string, jobDescription?: string): Promise<string> => {
    const prompt = `You are a friendly and professional AI interview coach. I am preparing for a "${jobTitle}" role ${companyName ? `at "${companyName}"` : ''}. 
    ${jobDescription ? `Here is the job description: "${jobDescription}"` : ''}
    Please start the interview by introducing yourself briefly and asking me the first question.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error starting interview:", error);
        throw new Error("Failed to start the interview. Please try again.");
    }
};

export const getNextInterviewStep = async (history: InterviewMessage[], jobTitle: string): Promise<{ feedback: InterviewFeedback; nextQuestion: string; }> => {
    const transcript = history.map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`).join('\n');
    const lastAnswer = [...history].reverse().find(msg => msg.role === 'user')?.content || '';

    const prompt = `You are an AI interview coach. Here is the transcript of our interview so far for the role of "${jobTitle}":\n${transcript}\n
    My most recent answer was: "${lastAnswer}". 
    Please provide brief, constructive feedback on my answer in JSON format, and then provide the next interview question. The feedback should be very short, one sentence per category.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: interviewFeedbackSchema,
            }
        });
        const parsedResult = JSON.parse(response.text);
        return parsedResult;
    } catch (error) {
        console.error("Error getting next interview step:", error);
        throw new Error("Failed to get next question. Please try again.");
    }
};

export const getInterviewSummary = async (history: InterviewMessage[], jobTitle: string): Promise<InterviewSummary> => {
    const transcript = history.map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`).join('\n');
    const prompt = `You are an AI interview coach. The interview for the "${jobTitle}" role is now complete. Here is the full transcript:\n${transcript}\n
    Please provide a final performance summary in JSON format. The feedback should be constructive and encouraging, focusing on high-level themes.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: interviewSummarySchema,
            },
        });
        const parsedResult = JSON.parse(response.text);
        return parsedResult as InterviewSummary;
    } catch (error) {
        console.error("Error getting interview summary:", error);
        throw new Error("Failed to get interview summary. Please try again.");
    }
};
