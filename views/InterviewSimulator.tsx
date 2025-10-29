import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { InterviewMessage, InterviewSummary } from '../types';
import { getInterviewSummary } from '../services/geminiService';
import ScoreCircle from '../components/ScoreCircle';
import { CheckCircleIcon, LightbulbIcon, TargetIcon, ThumbsUpIcon, MicrophoneIcon, StopCircleIcon } from '../components/icons';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

type InterviewPhase = 'setup' | 'live' | 'summary';
// Fix: Use import.meta.env.VITE_GEMINI_API_KEY for Vite environment variables.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const totalQuestions = 5;

// --- Audio Helper Functions ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
// --- End Audio Helper Functions ---

const InterviewSimulator: React.FC = () => {
    const [phase, setPhase] = useState<InterviewPhase>('setup');
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [history, setHistory] = useState<InterviewMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<InterviewSummary | null>(null);
    const [questionCount, setQuestionCount] = useState(0);

    const [isConnecting, setIsConnecting] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [currentInputTranscription, setCurrentInputTranscription] = useState('');
    const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');
    
    const sessionPromiseRef = useRef<ReturnType<typeof ai.live.connect> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSources = useRef(new Set<AudioBufferSourceNode>());

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history]);

    const stopRecording = useCallback(() => {
        if (scriptProcessorRef.current && audioContextRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setIsRecording(false);
    }, []);

    const startRecording = useCallback(async () => {
        if (isRecording || !sessionPromiseRef.current) return;
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }
            if (audioContextRef.current.state === 'suspended') {
                 await audioContextRef.current.resume();
            }

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsRecording(true);

            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromiseRef.current?.then((session) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            };

            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Microphone access was denied. Please allow microphone access to use this feature.');
            setIsRecording(false);
        }
    }, [isRecording]);


    const handleMicToggle = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };
    
    const handleStartInterview = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!jobTitle) {
            setError("Please enter a job title to begin.");
            return;
        }
        
        const loadingMessages = ["Interviewer preparing...", "Reviewing job description...", "Finalizing questions..."];
        let messageIndex = 0;
        const intervalId = setInterval(() => {
            setLoadingMessage(loadingMessages[messageIndex]);
            messageIndex = (messageIndex + 1) % loadingMessages.length;
        }, 1500);

        setIsConnecting(true);
        setLoadingMessage(loadingMessages[0]);
        setError(null);

        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const outputNode = outputAudioContextRef.current.createGain();
        outputNode.connect(outputAudioContextRef.current.destination);

        const systemInstruction = `You are a friendly and professional AI interview coach. The user is preparing for a "${jobTitle}" role ${companyName ? `at "${companyName}"` : ''}. 
        ${jobDescription ? `Here is the job description: "${jobDescription}"` : ''}
        Start the interview by introducing yourself briefly and asking the first behavioral question. Keep your responses concise. You will conduct an interview of ${totalQuestions} questions.`;

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                systemInstruction: systemInstruction,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {},
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        setCurrentInputTranscription(prev => prev + message.serverContent.inputTranscription.text);
                    }
                    if (message.serverContent?.outputTranscription) {
                        setCurrentOutputTranscription(prev => prev + message.serverContent.outputTranscription.text);
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        source.addEventListener('ended', () => audioSources.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        audioSources.current.add(source);
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of audioSources.current.values()) {
                          source.stop();
                          audioSources.current.delete(source);
                        }
                        nextStartTimeRef.current = 0;
                    }

                    if (message.serverContent?.turnComplete) {
                        const finalInput = currentInputTranscription;
                        const finalOutput = currentOutputTranscription;
                        setCurrentInputTranscription('');
                        setCurrentOutputTranscription('');

                        setHistory(prev => {
                            let newHistory = [...prev];
                            if (finalInput) newHistory.push({ role: 'user', content: finalInput });
                            if (finalOutput) newHistory.push({ role: 'model', content: finalOutput });
                            return newHistory;
                        });

                        if (isConnecting) {
                           setIsConnecting(false);
                           setPhase('live');
                           clearInterval(intervalId);
                           await startRecording();
                        }
                         
                         const newQuestionCount = questionCount + 1;
                         setQuestionCount(newQuestionCount);

                         if (newQuestionCount >= totalQuestions && finalInput) {
                            setIsConnecting(true);
                            setLoadingMessage("Compiling your feedback...");
                            stopRecording();
                            sessionPromiseRef.current?.then(s => s.close());
                            
                            // Use a timeout to allow the final audio to play
                            setTimeout(async () => {
                                const summaryResult = await getInterviewSummary(
                                    [...history, {role: 'user', content: finalInput}, {role: 'model', content: finalOutput}], 
                                    jobTitle
                                );
                                setSummary(summaryResult);
                                setPhase('summary');
                                setIsConnecting(false);
                            }, 3000);
                         }
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Session error:', e);
                    setError('A connection error occurred. Please try again.');
                    setIsConnecting(false);
                    clearInterval(intervalId);
                },
                onclose: (e: CloseEvent) => {
                    stopRecording();
                },
            },
        });
    }, [jobTitle, companyName, jobDescription, history, isConnecting, questionCount, currentInputTranscription, currentOutputTranscription, startRecording, stopRecording]);

    const cleanUp = useCallback(() => {
        stopRecording();
        sessionPromiseRef.current?.then(s => s.close()).catch(console.error);
        sessionPromiseRef.current = null;
        if(audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if(outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
    }, [stopRecording]);

    useEffect(() => {
        return () => {
            cleanUp();
        };
    }, [cleanUp]);

    const resetInterview = () => {
        cleanUp();
        setHistory([]);
        setError(null);
        setSummary(null);
        setQuestionCount(0);
        setPhase('setup');
        setIsConnecting(false);
        setIsRecording(false);
        setCurrentInputTranscription('');
        setCurrentOutputTranscription('');
    };

    const renderSetup = () => (
        <div className="w-full max-w-lg mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Interview Simulator</h2>
            <p className="text-center text-gray-500 mb-6">Prepare for your next big role. Fill in the details below to start your mock interview.</p>
            <form onSubmit={handleStartInterview} className="bg-white p-6 sm:p-8 rounded-xl shadow-md space-y-4">
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

    const renderLive = () => (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg flex flex-col h-[80vh]">
             <div className="p-4 border-b border-gray-200">
                <div className="flex items-center">
                    <button onClick={resetInterview} className="text-gray-500 hover:text-gray-800 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h3 className="font-bold">Live Interview</h3>
                        <p className="text-sm text-gray-500">Question {Math.min(questionCount, totalQuestions)} of {totalQuestions}</p>
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
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-200">
                 <div className="flex items-center space-x-4">
                     <p className="flex-grow p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 min-h-[50px] italic">
                         {currentInputTranscription || (isRecording ? "Listening..." : "Click mic to speak")}
                     </p>
                    <button onClick={handleMicToggle} className={`p-3 rounded-full text-white transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                        {isRecording ? <StopCircleIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
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
            {isConnecting && <FullScreenLoader />}
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