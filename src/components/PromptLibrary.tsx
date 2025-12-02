import React from 'react';
import { promptLibrary } from '../data/promptLibrary';
import { SparklesIcon } from './Icons';

interface PromptLibraryProps {
  onSelectPrompt: (prompt: string) => void;
}

const PromptLibrary: React.FC<PromptLibraryProps> = ({ onSelectPrompt }) => {
  return (
    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg w-full">
      <div className="flex items-center gap-2 mb-4">
        <SparklesIcon className="w-6 h-6 text-violet-500" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Prompt Library</h3>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {promptLibrary.map((category) => (
          <div key={category.category}>
            <h4 className="font-semibold text-slate-600 dark:text-slate-400 mb-2">{category.category}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {category.prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => onSelectPrompt(prompt)}
                  className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-md text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptLibrary;
