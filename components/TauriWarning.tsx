import React from 'react';
import { AlertCircle } from 'lucide-react';
import { isTauriAvailable } from '../services/mockService';

export const TauriWarning: React.FC = () => {
  if (isTauriAvailable()) {
    return null; // Don't show warning if Tauri is available
  }

  return (
    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3 text-yellow-400">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold mb-1">Tauri Backend Not Available</div>
        <div className="text-sm text-yellow-300/80 mb-2">
          The application is running in web preview mode. For full functionality including downloads, please run:
        </div>
        <code className="block bg-yellow-500/20 px-3 py-2 rounded font-mono text-sm text-yellow-200 border border-yellow-500/30">
          npm run tauri:dev
        </code>
        <div className="text-xs text-yellow-300/60 mt-2">
          This will start the Tauri desktop application with full backend support.
        </div>
      </div>
    </div>
  );
};

