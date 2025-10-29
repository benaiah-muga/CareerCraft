import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './views/Home';
import ResumeAnalyzer from './views/ResumeAnalyzer';
import InterviewSimulator from './views/InterviewSimulator';

export type View = 'home' | 'resume' | 'interview';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');

  const renderView = () => {
    switch (currentView) {
      case 'resume':
        return <ResumeAnalyzer setView={setCurrentView} />;
      case 'interview':
        return <InterviewSimulator />;
      case 'home':
      default:
        return <Home setView={setCurrentView} />;
    }
  };
  
  const goHome = () => setCurrentView('home');

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800">
      <Header goHome={goHome} />
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12 flex flex-col items-center">
        {renderView()}
      </main>
      <Footer />
    </div>
  );
};

export default App;