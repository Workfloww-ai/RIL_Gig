import React from 'react';
import { XCircle, CheckCircle } from 'lucide-react';

interface StatusModalProps {
  visible: boolean;
  title: string;
  message: string;
  isError?: boolean;
  onClose: () => void;
}

export default function StatusModal({ visible, title, message, isError = false, onClose }: StatusModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl overflow-hidden flex flex-col items-center">
        {/* Left Red Bar */}
        <div className="absolute -bottom-5 left-0 w-2.5 h-[60%] bg-[#D32F2F] z-10 skew-y-[45deg]" />
        
        {/* Right Green Bar */}
        <div className="absolute -top-5 right-0 w-2.5 h-[60%] bg-[#0B5B31] z-10 skew-y-[45deg]" />

        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {isError ? <XCircle className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
        
        <p className="text-[15px] text-gray-600 text-center leading-relaxed mb-6">
          {message}
        </p>
        
        <button 
          onClick={onClose} 
          className="bg-gray-100 hover:bg-gray-200 py-3 px-6 rounded-lg w-full text-center text-gray-600 font-semibold text-[15px] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
