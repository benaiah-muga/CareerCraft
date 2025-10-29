import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { InterviewMessage, InterviewSummary, InterviewFeedback } from '../types';
import { startInterview, getNextInterviewStep, getInterviewSummary } from '../services/geminiService';
import ScoreCircle from '../components/ScoreCircle';
import { CheckCircleIcon, LightbulbIcon, TargetIcon, ThumbsUpIcon } from '../components/icons';

type InterviewPhase = 'setup' | 'live' | 'summary';

const InterviewSimulator: React.FC = () => {
    const [phase, setPhase] = useState<InterviewPhase>('setup');
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [history, setHistory] = useState<InterviewMessage[]>([]);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<InterviewSummary | null>(null);
    const [questionCount, setQuestionCount] = useState(0);
    const totalQuestions = 5;

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history]);

    const handleStartInterview = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!jobTitle) {
            setError("Please enter a job title to begin.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const firstQuestion = await startInterview(jobTitle, companyName, jobDescription);
            setHistory([{ role: 'model', content: firstQuestion }]);
            setPhase('live');
            setQuestionCount(1);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [jobTitle, companyName, jobDescription]);

    const handleAnswerSubmit = useCallback(async () => {
        if (!currentAnswer.trim()) return;
        
        const newHistory: InterviewMessage[] = [...history, { role: 'user', content: currentAnswer }];
        setHistory(newHistory);
        setCurrentAnswer('');
        setIsLoading(true);

        try {
            if (questionCount >= totalQuestions) {
                const summaryResult = await getInterviewSummary(newHistory, jobTitle);
                setSummary(summaryResult);
                setPhase('summary');
            } else {
                const { feedback, nextQuestion } = await getNextInterviewStep(newHistory, jobTitle);
                setHistory(prev => {
                    const updatedHistory = [...prev];
                    const lastUserMessage = updatedHistory[updatedHistory.length - 1];
                    if(lastUserMessage.role === 'user') {
                        lastUserMessage.feedback = feedback;
                    }
                    return [...updatedHistory, { role: 'model', content: nextQuestion }];
                });
                setQuestionCount(prev => prev + 1);
            }
        } catch (err: any) {
            setError(err.message);
            setHistory(prev => prev.slice(0, -1)); // Revert user message on error
        } finally {
            setIsLoading(false);
        }
    }, [currentAnswer, history, jobTitle, questionCount]);

    const resetInterview = () => {
        setHistory([]);
        setCurrentAnswer('');
        setIsLoading(false);
        setError(null);
        setSummary(null);
        setQuestionCount(0);
        setPhase('setup');
    };

    const restartWithSameRole = () => {
        setHistory([]);
        setCurrentAnswer('');
        setIsLoading(false);
        setError(null);
        setSummary(null);
        setQuestionCount(0);
        handleStartInterview(new Event('submit') as any);
    }

    const renderSetup = () => (
        <div className="w-full max-w-lg mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Interview Simulator</h2>
            <p className="text-center text-gray-500 mb-6">Prepare for your next big role. Fill in the details below to start your mock interview.</p>
            <form onSubmit={handleStartInterview} className="bg-white p-6 sm:p-8 rounded-xl shadow-md space-y-4">
                <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Product Manager" className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500" required/>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Name (Optional)" className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500"/>
                <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Job Description (Optional)" className="w-full p-3 border border-gray-300 rounded-lg h-24 text-gray-900 placeholder-gray-500"/>
                <p className="text-xs text-gray-400 text-center">Your data is private and is not stored.</p>
                <button type="submit" disabled={isLoading} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-blue-300">
                    {isLoading ? 'Starting...' : 'Start Interview'}
                </button>
                {error && <p className="text-red-500 text-center">{error}</p>}
            </form>
        </div>
    );

    const FeedbackPill: React.FC<{ icon: React.ReactNode, label: string, text: string }> = ({ icon, label, text }) => (
        <div className="flex items-start text-sm">
            <div className="flex-shrink-0">{icon}</div>
            <div className="ml-2">
                <span className="font-semibold">{label}:</span> {text}
            </div>
        </div>
    );

    const renderLive = () => (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg flex flex-col h-[80vh]">
             <div className="p-4 border-b border-gray-200">
                <div className="flex items-center">
                    <button onClick={resetInterview} className="text-gray-500 hover:text-gray-800 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h3 className="font-bold">Live Interview</h3>
                        <p className="text-sm text-gray-500">Question {questionCount} of {totalQuestions}</p>
                    </div>
                </div>
            </div>
            <div className="flex-grow p-6 overflow-y-auto space-y-6">
                {history.map((msg, index) => (
                    <div key={index}>
                        {msg.role === 'model' ? (
                            <div className="flex items-start space-x-3">
                                <div className="bg-gray-200 text-gray-700 p-2 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                </div>
                                <div className="bg-gray-100 rounded-lg p-3 max-w-lg">
                                    <p>{msg.content}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end">
                                <div className="bg-blue-500 text-white rounded-lg p-3 max-w-lg">
                                    <p>{msg.content}</p>
                                </div>
                                {msg.feedback && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg w-full max-w-lg space-y-2">
                                        <h4 className="font-semibold text-sm text-green-800">Feedback on your answer:</h4>
                                        <FeedbackPill icon={<CheckCircleIcon className="w-5 h-5 text-green-600"/>} label="Clarity" text={msg.feedback.clarity} />
                                        <FeedbackPill icon={<CheckCircleIcon className="w-5 h-5 text-green-600"/>} label="Confidence" text={msg.feedback.confidence} />
                                        <FeedbackPill icon={<CheckCircleIcon className="w-5 h-5 text-green-600"/>} label="Relevance" text={msg.feedback.relevance} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-200">
                <div className="relative">
                    <textarea
                        value={currentAnswer}
                        onChange={e => setCurrentAnswer(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnswerSubmit(); }}}
                        placeholder="Type your answer..."
                        className="w-full p-3 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none text-gray-900 placeholder-gray-500"
                        rows={2}
                        disabled={isLoading}
                    />
                    <button onClick={handleAnswerSubmit} disabled={isLoading || !currentAnswer.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-500 text-white rounded-lg px-4 py-2 font-semibold disabled:bg-blue-300">
                        {isLoading ? '...' : 'Send'}
                    </button>
                </div>
                 {error && <p className="text-red-500 text-center mt-2">{error}</p>}
            </div>
        </div>
    );
    
    const renderSummary = () => (
        <div className="w-full max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Interview Complete!</h2>
            <p className="text-gray-500 mb-6">Here is your performance summary.</p>
            {summary && (
                <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md space-y-6">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Overall Performance</h3>
                    <div className="flex justify-center">
                        <ScoreCircle score={summary.overallScore} />
                    </div>
                    <p className="text-gray-600">You demonstrated strong potential. Focus on the improvement areas to excel.</p>
                    <div className="text-left grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                        <div>
                            <h4 className="font-bold text-lg mb-3 flex items-center"><ThumbsUpIcon className="w-6 h-6 text-green-500 mr-2"/>Your Strengths</h4>
                            <ul className="space-y-2">
                                {summary.strengths.map((s, i) => <li key={i} className="flex items-start"><CheckCircleIcon className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0"/><span>{s}</span></li>)}
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-bold text-lg mb-3 flex items-center"><LightbulbIcon className="w-6 h-6 text-yellow-500 mr-2"/>Areas for Improvement</h4>
                            <ul className="space-y-2">
                                {summary.areasForImprovement.map((a, i) => <li key={i} className="flex items-start"><TargetIcon className="w-5 h-5 text-yellow-500 mr-2 mt-1 flex-shrink-0"/><span>{a}</span></li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            <div className="mt-8 space-y-3 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center">
                <button onClick={restartWithSameRole} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg">Restart Interview</button>
                <button onClick={resetInterview} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg">Try Another Role</button>
            </div>
        </div>
    );

    switch (phase) {
        case 'live': return renderLive();
        case 'summary': return renderSummary();
        case 'setup':
        default: return renderSetup();
    }
};

export default InterviewSimulator;