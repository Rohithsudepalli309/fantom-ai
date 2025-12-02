import React from 'react';

interface JsonOutputProps {
  jsonString: string;
}

const JsonOutput: React.FC<JsonOutputProps> = ({ jsonString }) => {
  let formattedJson: string;
  try {
    // This ensures the input is parsed and re-stringified for consistent formatting
    const jsonObj = JSON.parse(jsonString);
    formattedJson = JSON.stringify(jsonObj, null, 2);
  } catch (error) {
    // If the string is not valid JSON, display it as is.
    // This can happen if the model fails to return perfect JSON.
    formattedJson = jsonString;
  }

  return (
    <div className="bg-slate-100 dark:bg-slate-900 rounded-md text-sm">
      <pre className="whitespace-pre-wrap break-words p-4 text-xs sm:text-sm">
        <code>{formattedJson}</code>
      </pre>
    </div>
  );
};

export default JsonOutput;