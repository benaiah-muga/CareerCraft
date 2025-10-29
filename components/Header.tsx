
import React from 'react';

interface HeaderProps {
    goHome: () => void;
}

const Header: React.FC<HeaderProps> = ({ goHome }) => {
  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <button onClick={goHome} className="flex items-center space-x-3 cursor-pointer">
            <div className="bg-blue-500 text-white p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-9.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
                </svg>
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-800">CareerCraft AI</h1>
                <p className="text-sm text-gray-500">Your Smart Resume & Interview Coach</p>
            </div>
        </button>
      </div>
    </header>
  );
};

export default Header;
