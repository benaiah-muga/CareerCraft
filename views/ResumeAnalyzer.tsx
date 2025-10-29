import React, { useState, useCallback } from 'react';
import { analyzeResume } from '../services/geminiService';
import type { ResumeAnalysisResult } from '../types';
import ScoreCircle from '../components/ScoreCircle';
import { ThumbsUpIcon, LightbulbIcon, TargetIcon, PlusCircleIcon, UploadIcon, HomeIcon, ChatBubbleLeftRightIcon } from '../components/icons';
import type { View } from '../App';

// Helper to remove markdown bolding
const cleanMarkdown = (text: string) => text.replace(/\*\*/g, '');

const FeedbackSection: React.FC<{ title: string; items: string[]; icon: React.ReactNode }> = ({ title, items, icon }) => (
    <div>
        <h3 className="text-lg font-semibold flex items-center text-gray-700 mb-2">
            {icon}
            <span className="ml-2">{title}</span>
        </h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
            {items.map((item, index) => <li key={index}>{cleanMarkdown(item)}</li>)}
        </ul>
    </div>
);

interface ResumeAnalyzerProps {
  setView: (view: View) => void;
}

const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({ setView }) => {
    const [resumeText, setResumeText] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setResumeText(text);
            };
            reader.onerror = () => {
                setError("Failed to read file.");
                setFileName(null);
            }
            reader.readAsText(file);
        }
    };

    const handleSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!resumeText.trim() || !jobTitle.trim()) {
            setError('Please provide your resume text and a target job title.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const result = await analyzeResume(resumeText, jobTitle, companyName, jobDescription);
            setAnalysis(result);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [resumeText, jobTitle, companyName, jobDescription]);

    return (
        <div className="w-full max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Analyze Your Resume</h2>
            <p className="text-center text-gray-500 mb-6">Upload or paste your resume for AI-powered feedback.</p>

            <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl shadow-md space-y-6">
                <div>
                    <label htmlFor="file-upload" className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                       <UploadIcon className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="font-semibold text-blue-600">Upload Resume File</span>
                        <span className="text-sm text-gray-500 mt-1">Supported formats: .txt</span>
                        {fileName && <span className="text-sm text-green-600 mt-2">File: {fileName}</span>}
                    </label>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".txt" />
                </div>
                 <div className="relative flex items-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>
                <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your full resume text here..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition h-40 text-gray-900 placeholder-gray-500"
                />
                <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Target Job Title (e.g., Senior Product Manager)"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900 placeholder-gray-500"
                    required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Name (optional)"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900 placeholder-gray-500"
                    />
                    <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Job Description (optional, for more tailored advice)"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition h-24 md:col-span-2 text-gray-900 placeholder-gray-500"
                    />
                </div>
                <div className="flex flex-col sm:flex-row-reverse gap-4">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full sm:w-auto flex-grow bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </>
                        ) : 'Analyze Resume'}
                    </button>
                     <button
                        type="button"
                        onClick={() => setView('home')}
                        disabled={isLoading}
                        className="w-full sm:w-auto flex-grow bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Back to Home
                    </button>
                </div>
                {error && <p className="text-red-500 text-center">{error}</p>}
            </form>

            {analysis && (
                <div className="mt-10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6">Resume Score</h2>
                    <div className="flex justify-center mb-10">
                        <ScoreCircle score={analysis.score} />
                    </div>
                    <div className="bg-white p-6 md:p-8 rounded-xl shadow-md space-y-8">
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-center mb-6 text-gray-800">Feedback Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                                <FeedbackSection title="Strengths" items={analysis.strengths} icon={<ThumbsUpIcon className="w-6 h-6 text-green-500" />} />
                                <FeedbackSection title="Weaknesses" items={analysis.weaknesses} icon={<LightbulbIcon className="w-6 h-6 text-yellow-500" />} />
                                <FeedbackSection title="ATS & Keyword Tips" items={analysis.atsKeywords} icon={<TargetIcon className="w-6 h-6 text-blue-500" />} />
                            </div>
                        </div>
                        <div className="border-t border-gray-200 pt-6">
                             <h3 className="text-lg sm:text-xl font-bold text-center mb-6 text-gray-800">Actionable Improvements</h3>
                             <div className="space-y-4">
                                {analysis.actionableImprovements.map((item, index) => (
                                    <div key={index} className="flex items-start">
                                        <PlusCircleIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1 mr-3" />
                                        <p className="text-gray-700">{cleanMarkdown(item)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                     <div className="mt-8 text-center">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6">What's Next?</h3>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                            <button
                                onClick={() => setView('interview')}
                                className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center"
                            >
                                <ChatBubbleLeftRightIcon className="h-6 w-6 mr-3" />
                                Practice Interview
                            </button>
                            <button
                                onClick={() => setView('home')}
                                className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center"
                            >
                                <HomeIcon className="h-6 w-6 mr-3" />
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResumeAnalyzer;