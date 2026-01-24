import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useEffect } from "react";

export function SuccessModal({ isOpen, onClose, message }: { isOpen: boolean; onClose: () => void; message: string }) {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, 2000); // Auto close after 2 seconds
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    {/* Backdrop - lighter than warning */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 20 }}
                        animate={{
                            scale: 1,
                            opacity: 1,
                            y: 0,
                            transition: { type: "spring", damping: 25, stiffness: 300 }
                        }}
                        exit={{ scale: 0.9, opacity: 0, y: -20 }}
                        className="bg-white rounded-2xl p-6 shadow-2xl relative z-10 w-[90%] max-w-sm flex flex-col items-center text-center border border-green-100 pointer-events-auto"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            >
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </motion.div>
                        </div>
                        <h3 className="font-bold text-xl text-gray-900 mb-2">성공!</h3>
                        <p className="text-gray-600 font-medium">{message}</p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
