"use client";

import { useEffect, useState } from "react";
import { X, ChevronRight, FileText, RefreshCw, CheckCircle, MousePointer2 } from "lucide-react";
import { motion } from "framer-motion";

export function GuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [step, setStep] = useState(1);

    // Reset step when opened
    useEffect(() => {
        if (isOpen) setStep(1);
    }, [isOpen]);

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
        } else {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />

            {/* Morphing Card */}
            <motion.div
                layoutId="guide-modal-trigger"
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative mx-4 pointer-events-auto overflow-hidden"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Progress Indicators */}
                <div className="flex justify-center space-x-2 mb-8">
                    <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-indigo-600' : 'w-2 bg-gray-200'}`}></div>
                    <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-indigo-600' : 'w-2 bg-gray-200'}`}></div>
                </div>

                {/* Content - Step 1 */}
                {step === 1 && (
                    <div className="text-center space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <motion.div layoutId="guide-icon" className="relative mx-auto w-24 h-24 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 mb-6 group">
                            <FileText className="w-10 h-10 text-indigo-600" />
                            <div className="absolute -bottom-2 -right-2 bg-white shadow-lg p-2 rounded-lg border border-gray-100 animate-bounce">
                                <MousePointer2 className="w-5 h-5 text-indigo-500 fill-indigo-500" />
                            </div>
                        </motion.div>

                        <div>
                            <motion.h3 layoutId="guide-text" className="text-2xl font-bold text-gray-900 mb-3 block">
                                1. 문서를 불러오세요
                            </motion.h3>
                            <p className="text-gray-500 leading-relaxed">
                                구글 문서의 <span className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded">URL 주소</span>를 복사해서 붙여넣기만 하면 됩니다.
                            </p>
                        </div>
                    </div>
                )}

                {/* Content - Step 2 */}
                {step === 2 && (
                    <div className="text-center space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="relative mx-auto w-24 h-24 bg-purple-50 rounded-2xl flex items-center justify-center border border-purple-100 mb-6">
                            <RefreshCw className="w-10 h-10 text-purple-600 animate-spin-slow" />
                            <div className="absolute top-0 right-0 -mr-2 -mt-2">
                                <CheckCircle className="w-8 h-8 text-green-500 bg-white rounded-full border-2 border-white" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                2. 클릭 한 번으로 끝!
                            </h3>
                            <p className="text-gray-500 leading-relaxed">
                                원하는 너비(cm)를 설정하고 버튼을 누르면<br />
                                <span className="font-bold text-purple-600 bg-purple-50 px-1 rounded">이미지 크기</span>가 자동으로 맞춰집니다.
                            </p>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <div className="mt-10">
                    <button
                        onClick={handleNext}
                        className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg shadow-xl shadow-gray-200 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center"
                    >
                        {step === 1 ? (
                            <>
                                <span>다음 단계</span>
                                <ChevronRight className="w-5 h-5 ml-1" />
                            </>
                        ) : (
                            "시작하기"
                        )}
                    </button>
                    {step === 1 && (
                        <button onClick={onClose} className="w-full mt-4 text-sm text-gray-400 font-medium hover:text-gray-600">
                            건너뛰기
                        </button>
                    )}
                </div>

            </motion.div>
        </div>
    );
}
