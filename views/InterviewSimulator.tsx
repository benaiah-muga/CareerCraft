import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { InterviewMessage, InterviewSummary, InterviewFeedback } from '../types';
import { getInterviewResponse, getInterviewSummary } from '../services/geminiService';
import ScoreCircle from '../components/ScoreCircle';
import { CheckCircleIcon, LightbulbIcon, TargetIcon, ThumbsUpIcon, MicrophoneIcon, StopCircleIcon } from '../components/icons';

type InterviewPhase = 'setup' | 'live' | 'summary';

const totalQuestions = 5;

// FIX: Cast window to any to access SpeechRecognition properties which may not be in the default type definition.
// Check for browser speech recognition support
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
// FIX: Use the renamed variable to avoid name collision.
const isSpeechRecognitionSupported = !!SpeechRecognitionAPI;

const InterviewSimulator: React.FC = () => {
    const [phase, setPhase] = useState<InterviewPhase>('setup');
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    
    const [history, setHistory] = useState<InterviewMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<InterviewSummary | null>(null);
    
    const [isLoading, setIsLoading] = useState(false); // For initial loading
    const [isAiThinking, setIsAiThinking] = useState(false); // For turn-based loading
    
    const [loadingMessage, setLoadingMessage] = useState('');
    
    const [isRecording, setIsRecording] = useState(false);
    // FIX: Use `any` for the ref type as SpeechRecognition type is not available and there's a name collision with the variable.
    const recognitionRef = useRef<any | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isAiThinking]);
    
    // --- Speech Recognition Logic ---
    useEffect(() => {
        if (!isSpeechRecognitionSupported) {
            console.warn("SpeechRecognition is not supported by this browser.");
            return;
        }

        // FIX: Use renamed variable `SpeechRecognitionAPI` to create a new instance.
        recognitionRef.current = new SpeechRecognitionAPI();
        const recognition = recognitionRef.current;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setCurrentMessage(prev => prev + finalTranscript + interimTranscript);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };
        
        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setError(`Speech recognition error: ${event.error}`);
            setIsRecording(false);
        };

        return () => {
            recognition.stop();
        };
    }, []);

    const handleMicToggle = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
        } else {
            setCurrentMessage(''); // Clear previous text before starting new transcription
            recognitionRef.current?.start();
        }
        setIsRecording(!isRecording);
    };
    // --- End Speech Recognition Logic ---

    const startInterview = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setHistory([]);
        
        const loadingMessages = ["Interviewer preparing...", "Reviewing job description...", "Finalizing questions..."];
        let messageIndex = 0;
        const intervalId = setInterval(() => {
            setLoadingMessage(loadingMessages[messageIndex]);
            messageIndex = (messageIndex + 1) % loadingMessages.length;
        }, 1500);

        setTimeout(async () => {
            try {
                const response = await getInterviewResponse([], jobTitle, companyName, jobDescription);
                setHistory([{ role: 'model', content: response.nextQuestion }]);
            } catch (err: any) {
                setError(err.message);
            } finally {
                clearInterval(intervalId);
                setIsLoading(false);
                setPhase('live');
            }
        }, 4000); // Simulate preparation time
        
    }, [jobTitle, companyName, jobDescription]);

    const handleStartInterviewSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!jobTitle) {
            setError("Please enter a job title to begin.");
            return;
        }
        startInterview();
    };

    const handleSendMessage = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentMessage.trim()) return;

        const newUserMessage: InterviewMessage = { role: 'user', content: currentMessage };
        const newHistory = [...history, newUserMessage];
        setHistory(newHistory);
        setCurrentMessage('');
        setIsAiThinking(true);
        setError(null);

        // End interview after reaching question limit
        const questionCount = history.filter(m => m.role === 'model').length;
        if (questionCount >= totalQuestions) {
            setIsLoading(true);
            setLoadingMessage("Compiling your feedback...");
            try {
                const summaryResult = await getInterviewSummary(newHistory, jobTitle);
                setSummary(summaryResult);
                setPhase('summary');
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
                setIsAiThinking(false);
            }
            return;
        }

        try {
            const response = await getInterviewResponse(newHistory, jobTitle, companyName, jobDescription);
            const newModelMessage: InterviewMessage = {
                role: 'model',
                content: response.nextQuestion,
                feedback: response.feedback ?? undefined
            };
            setHistory(prev => [...prev, newModelMessage]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAiThinking(false);
        }
    };
    
    const resetInterview = () => {
        setHistory([]);
        setError(null);
        setSummary(null);
        setPhase('setup');
        setIsLoading(false);
        setIsAiThinking(false);
        setCurrentMessage('');
    };
    
    const cleanMarkdown = (text: string) => text.replace(/\*\*/g, '');

    const renderSetup = () => (
        <div className="w-full max-w-lg mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Interview Simulator</h2>
            <p className="text-center text-gray-500 mb-6">Prepare for your next big role. Fill in the details below to start your mock interview.</p>
            <form onSubmit={handleStartInterviewSubmit} className="bg-white p-6 sm:p-8 rounded-xl shadow-md space-y-4">
                <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Product Manager" className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500" required/>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Name (Optional)" className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500"/>
                <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Job Description (Optional)" className="w-full p-3 border border-gray-300 rounded-lg h-24 text-gray-900 placeholder-gray-500"/>
                <p className="text-xs text-gray-400 text-center">Your data is private and is not stored.</p>
                <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg">
                    Start Interview
                </button>
                {error && <p className="text-red-500 text-center">{error}</p>}
            </form>
        </div>
    );
    
    const FullScreenLoader = () => (
      <div className="fixed inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin mx-auto h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-semibold text-gray-700 transition-opacity duration-500">{loadingMessage}</p>
        </div>
      </div>
    );
    
    const FeedbackDisplay: React.FC<{ feedback: InterviewFeedback }> = ({ feedback }) => (
        <div className="mt-2 ml-10 border-l-2 border-gray-200 pl-4 animate-fadeIn">
            <h4 className="text-sm font-semibold text-gray-600 mb-2">Feedback on your answer:</h4>
            <div className="space-y-1 text-sm">
                <p className="flex items-start"><CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" /> <strong>Clarity:</strong> {cleanMarkdown(feedback.clarity)}</p>
                <p className="flex items-start"><ThumbsUpIcon className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" /> <strong>Confidence:</strong> {cleanMarkdown(feedback.confidence)}</p>
                <p className="flex items-start"><TargetIcon className="w-4 h-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" /> <strong>Relevance:</strong> {cleanMarkdown(feedback.relevance)}</p>
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
                        <p className="text-sm text-gray-500">Question {Math.min(history.filter(m => m.role === 'model').length, totalQuestions)} of {totalQuestions}</p>
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
                                    <p>{cleanMarkdown(msg.content)}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col items-end">
                                    <div className="bg-blue-500 text-white rounded-lg p-3 max-w-lg">
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                                {history[index+1]?.feedback && <FeedbackDisplay feedback={history[index+1].feedback!} />}
                            </>
                        )}
                    </div>
                ))}
                {isAiThinking && (
                    <div className="flex items-start space-x-3">
                        <div className="bg-gray-200 text-gray-700 p-2 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3 max-w-lg flex items-center space-x-2">
                           <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                           <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                           <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                 <div className="flex items-center space-x-2">
                     <textarea
                        value={currentMessage}
                        onChange={e => setCurrentMessage(e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900 placeholder-gray-500 resize-none"
                        rows={2}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                     />
                    {isSpeechRecognitionSupported && (
                        <button type="button" onClick={handleMicToggle} className={`p-3 rounded-full text-white transition-colors flex-shrink-0 ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                            {isRecording ? <StopCircleIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
                        </button>
                    )}
                    <button type="submit" disabled={isAiThinking} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-5 rounded-lg transition-colors disabled:bg-blue-300">Send</button>
                </div>
                 {error && <p className="text-red-500 text-center mt-2">{error}</p>}
            </form>
        </div>
    );
    
    const renderSummary = () => (
        <div className="w-full max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Interview Complete!</h2>
            <p className="text-gray-500 mb-6">Here is your performance summary.</p>
            {summary ? (
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
                                {summary.strengths.map((s, i) => <li key={i} className="flex items-start"><CheckCircleIcon className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0"/><span>{cleanMarkdown(s)}</span></li>)}
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-bold text-lg mb-3 flex items-center"><LightbulbIcon className="w-6 h-6 text-yellow-500 mr-2"/>Areas for Improvement</h4>
                            <ul className="space-y-2">
                                {summary.areasForImprovement.map((a, i) => <li key={i} className="flex items-start"><TargetIcon className="w-5 h-5 text-yellow-500 mr-2 mt-1 flex-shrink-0"/><span>{cleanMarkdown(a)}</span></li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            ) : (
                <p>Generating your summary...</p>
            )}
            <div className="mt-8 space-y-3 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center">
                <button onClick={resetInterview} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg">Try Another Role</button>
            </div>
        </div>
    );

    return (
        <>
            {isLoading && <FullScreenLoader />}
            {(() => {
                switch (phase) {
                    case 'live': return renderLive();
                    case 'summary': return renderSummary();
                    case 'setup':
                    default: return renderSetup();
                }
            })()}
        </>
    );
};

export default InterviewSimulator;