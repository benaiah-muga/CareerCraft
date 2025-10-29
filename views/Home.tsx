import React from 'react';
import type { View } from '../App';
import { ArrowPathIcon, ChatBubbleLeftRightIcon } from '../components/icons';

interface HomeProps {
  setView: (view: View) => void;
}

const Home: React.FC<HomeProps> = ({ setView }) => {
  return (
    <div className="w-full max-w-lg text-center flex flex-col items-center justify-end h-full pb-20 sm:pb-32">
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-4">
        Get instant, AI-driven feedback to land your dream job.
      </h2>
      <div className="mt-8 space-y-4 w-full sm:w-80">
        <button
          onClick={() => setView('resume')}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center"
        >
          <ArrowPathIcon className="h-6 w-6 mr-3" />
          Analyze My Resume
        </button>
        <button
          onClick={() => setView('interview')}
          className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6 mr-3" />
          Simulate Interview
        </button>
      </div>
    </div>
  );
};

export default Home;