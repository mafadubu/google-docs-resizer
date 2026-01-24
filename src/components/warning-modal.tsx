"use client";

import { useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export function WarningModal({ isOpen, onClose, message }: { isOpen: boolean; onClose: () => void; message: string }) {

    // Auto close after 3 seconds
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            {/* Backdrop (Optional, maybe lighter for warning) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />

            {/* Genie Effect Card */}
            <motion.div
                layoutId="warning-modal-trigger"
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: 50 }}
                className="bg-white rounded-2xl p-6 shadow-2xl relative mx-4 pointer-events-auto max-w-sm w-full border-2 border-red-100"
                transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
            >
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">앗! 확인해 주세요</h3>
                        <p className="text-gray-600 text-sm">{message}</p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors"
                    >
                        확인했습니다
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
