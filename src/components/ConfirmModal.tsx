import React from 'react';
import { AlertTriangle } from 'lucide-react';

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E1F20] rounded-[24px] w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-medium text-google-text dark:text-google-text-dark">{title}</div>
            <div className="text-xs text-google-text-secondary dark:text-google-text-secondary-dark mt-1">{description}</div>
          </div>
        </div>
        <div className="p-6 bg-gray-50/60 dark:bg-black/10 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-google-text-secondary hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-full text-sm font-medium text-white bg-google-red hover:opacity-90 transition-opacity shadow-lg shadow-google-red/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
