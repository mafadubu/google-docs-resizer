"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Loader2, Search, FileText, Layout, RefreshCw, LogOut, CheckCircle, ShieldCheck, ChevronUp, User, ChevronLeft, ImageIcon, MousePointerClick, Grid3X3, Maximize2, Columns } from "lucide-react";
import { GuideModal } from "@/components/guide-modal";
import { WarningModal } from "@/components/warning-modal";
import { SuccessModal } from "@/components/success-modal";
import { AnimatePresence, motion } from "framer-motion";

export function Dashboard() {
    const { data: session } = useSession();
    const [docUrl, setDocUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [structure, setStructure] = useState<any>(null);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid');
    const [gridCols, setGridCols] = useState<number>(3);
    const [carouselIndex, setCarouselIndex] = useState<number>(0);
    const [selectedScopes, setSelectedScopes] = useState<Array<{ start: number; end: number; label: string }>>([]);
    const [highlightedChapterId, setHighlightedChapterId] = useState<string | null>(null);
    // Wait, the user wants "Whole Document" click to fill all checkboxes.
    // If I fill all checkboxes, the array has all items.
    // If I uncheck all, the array is empty.
    // Backend logic: "Empty array" -> "ALL".
    // This creates a UI mismatch. "Empty UI" = "Process ALL". "Full UI" = "Process ALL".
    // I should change backend default to ONLY process if scopes exist, OR handle the "Select All" button as just clearing the array (which enables ALL mode) but VISUALLY showing all checked?
    // User requested: "Click Select All -> All selected".
    // Let's make "Select All" actually fill the array. And "Empty Array" means... truly nothing selected?
    // Actually, safest is: empty array = process WHOLE document (default).
    // If user clicks "Select All", I fill array. Backend treats "Full array" == "Process these ranges". Result is same.
    // But if user clicks "Select All" again (deselect), array is empty. Backend treats as WHOLE document.
    // This is confusing. 
    // BETTER APPROACH: "Whole Document" button CLEARS the array (Empty).
    // And I clearly label it as "Whole Document Mode".
    // But user wants "Select All" visual. 
    // Let's stick to user request: "Select All" populates the array.
    // Then "Empty Array" -> Error? Or assume ALL?
    // Let's assume Empty Array = ALL for now to maintain compatibility with "I entered URL and clicked Resize immediately".
    // If user manually unchecks everything, it becomes empty -> ALL. This is weird but maybe acceptable?
    // "Select All" -> All Checked -> Array Full -> Resize specific ranges (which cover entire doc).
    // "Deselect All" -> None Checked -> Array Empty -> Resize ALL (Backend default).
    // So functional result is identical. I will proceed with this.
    const [showGuide, setShowGuide] = useState(false);

    const [showWarning, setShowWarning] = useState(false);
    const [warningMsg, setWarningMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [isUrlInvalid, setIsUrlInvalid] = useState(false);

    // UI State: Controls whether the input is locked (Document Loaded state)
    // We separate this from 'structure' so we can Reset the input without clearing the screen
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInputFolded, setIsInputFolded] = useState(false);

    // Handle token refresh errors
    useEffect(() => {
        // @ts-ignore
        if (session?.error === "RefreshAccessTokenError") {
            setWarningMsg("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
            setShowWarning(true);
            setTimeout(() => {
                signOut();
            }, 3000);
        }
    }, [session]);

    // Automatically fold input when document is loaded
    useEffect(() => {
        if (isLoaded) {
            setIsInputFolded(true);
        }
    }, [isLoaded]);

    // Check guide status on mount
    useEffect(() => {
        const hasSeenGuide = localStorage.getItem("has-seen-guide");
        if (!hasSeenGuide) {
            setShowGuide(true);
        }
    }, []);

    const closeGuide = () => {
        setShowGuide(false);
        localStorage.setItem("has-seen-guide", "true");
    };

    // Resize State
    const [targetWidth, setTargetWidth] = useState(10); // cm
    const [resizeStatus, setResizeStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
    const [resultMsg, setResultMsg] = useState("");
    const [imgError, setImgError] = useState(false);

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setDocUrl(url);

        // Reset invalid state when user types
        if (isUrlInvalid) setIsUrlInvalid(false);
    };

    // Keyboard Shortcut (Ctrl + [)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '[') {
                if (activeChapterId) {
                    e.preventDefault();
                    handleBackToOutline();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeChapterId]);

    const handleBackToOutline = () => {
        const idToTarget = activeChapterId;
        setActiveChapterId(null);

        if (idToTarget) {
            setHighlightedChapterId(idToTarget);
            setTimeout(() => setHighlightedChapterId(null), 2500);

            // Wait for multiple frames to ensure view has swapped and height is stable
            setTimeout(() => {
                const element = document.getElementById(`chapter-${idToTarget}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            }, 100);
        }
    };

    const handleReset = () => {
        // Only reset the Input State, keeping the structure visible ("Ghost" mode)
        setIsLoaded(false);
        setDocUrl(""); // Clear input so they can type new one
        setResizeStatus("idle");
        setResultMsg("");
        setIsUrlInvalid(false);
        setWarningMsg("");
        // NOTE: We do NOT setStructure(null) here. The old outline stays until new one loads!
    };

    const fetchStructure = async () => {
        // Validation before fetch
        if (!docUrl.includes("docs.google.com/document/d/")) {
            setWarningMsg("올바른 Google Docs URL을 입력해주세요.");
            setShowWarning(true);
            setIsUrlInvalid(true);
            return;
        }

        // Extract ID from URL
        let docId = docUrl;
        const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) docId = match[1];


        if (!docId) {
            alert("Please enter a valid Google Doc URL or ID");
            return;
        }

        setLoading(true);
        // setStructure(null); // REMOVED: Don't clear old structure while loading new one
        try {
            const res = await fetch("/api/doc/structure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // On Success: Replace structure & Lock input
            setStructure({ ...data, id: docId });
            setIsLoaded(true);
            setSelectedScopes([]); // Clear previous selections because it's a new doc
            setSuccessMsg("문서 목차를 성공적으로 불러왔습니다!");
            setShowSuccess(true);

        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
            setActiveChapterId(null);
            setSelectedImageIds([]);
        }
    };

    const handleResize = async () => {
        if (!structure?.id) return;

        setResizeStatus("processing");
        try {
            const payload: any = {
                docId: structure.id,
                targetWidthCm: targetWidth,
                scopes: selectedScopes.length > 0 ? selectedScopes : undefined,
                selectedImageIds: selectedImageIds.length > 0 ? selectedImageIds : undefined
            };

            const res = await fetch("/api/doc/resize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setResizeStatus("success");
            setResultMsg(data.message);
            setSuccessMsg(data.message); // Show popup
            setShowSuccess(true);
        } catch (e: any) {
            setResizeStatus("error");
            setResultMsg(e.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
            <AnimatePresence>
                {showGuide && <GuideModal isOpen={showGuide} onClose={closeGuide} />}
                {showWarning && <WarningModal isOpen={showWarning} onClose={() => setShowWarning(false)} message={warningMsg} />}
            </AnimatePresence>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                {/* ... (existing header content) */}
                <div
                    className="flex items-center space-x-3 cursor-pointer group"
                    onClick={() => {
                        if (activeChapterId) handleBackToOutline();
                        else {
                            // Scroll to top of page if already in outline
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                >
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">
                        G
                    </div>
                    <span className="font-bold text-lg tracking-tight group-hover:text-indigo-600 transition-colors">Docs Resizer ✨</span>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Help Button Wrapper - Isolates layout context */}
                    <div className="relative">
                        {/* 1. Invisible Placeholder (Always there to reserve space) */}
                        <div className="opacity-0 px-3 py-1.5 flex items-center pointer-events-none select-none" aria-hidden="true">
                            <div className="w-4 h-4 mr-1.5" />
                            사용 방법
                        </div>

                        {/* 2. Floating Animated Button */}
                        <AnimatePresence>
                            {!showGuide && (
                                <motion.button
                                    layoutId="guide-modal-trigger"
                                    onClick={() => setShowGuide(true)}
                                    className="absolute inset-0 w-full h-full text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full transition-colors flex items-center z-10"
                                >
                                    <motion.span layoutId="guide-icon" className="flex items-center">
                                        <CheckCircle className="w-4 h-4 mr-1.5" />
                                    </motion.span>
                                    <motion.span layoutId="guide-text">사용 방법</motion.span>
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* ... (user profile & logout) */}
                    <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-200">
                            {session?.user?.image && !imgError ? (
                                <img
                                    src={session.user.image}
                                    alt="User"
                                    className="w-full h-full object-cover"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <User className="w-4 h-4 text-gray-400" />
                            )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{session?.user?.name}</span>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sign out"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 md:grid-cols-12 gap-8">

                <AnimatePresence>
                    {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}
                </AnimatePresence>

                {/* Left Col: Setup - Sticky Sidebar */}
                <div className="md:col-span-4 space-y-6 md:sticky md:top-24 h-fit">

                    {/* Help Cards - Only show if NO structure is loaded */}
                    <AnimatePresence>
                        {!structure && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden space-y-4"
                            >
                                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                                    <h3 className="font-bold text-amber-900 mb-3 flex items-center">
                                        <MousePointerClick className="w-5 h-5 mr-2 text-amber-600" />
                                        사용 전 확인해 주세요!
                                    </h3>
                                    <ul className="space-y-2 text-sm text-amber-800 font-medium">
                                        <li className="flex items-start">
                                            <span className="mr-2">1.</span>
                                            <span>수정할 구글 문서의 <strong>공유 설정</strong>이 '링크가 있는 모든 사용자' 혹은 본인 계정으로 '편집 가능' 인지 확인해주세요.</span>
                                        </li>
                                        <li className="flex items-start text-red-600">
                                            <span className="mr-2">2.</span>
                                            <span className="font-bold underline italic">반드시 문서를 백업(사본 생성)한 후 작업을 진행해 주세요.</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-5 border border-green-100 flex items-start">
                                    <ShieldCheck className="w-6 h-6 mr-3 text-green-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-green-800 mb-1">안심하세요!</h4>
                                        <p className="text-sm text-green-700 leading-relaxed font-medium">
                                            입력하신 URL은 분석 용도로만 사용되며, 외부로 유출되거나 별도로 저장되지 않습니다.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-hidden transition-[height]">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                                1. 문서 선택
                            </h2>
                            <div className="flex items-center space-x-2">
                                <AnimatePresence>
                                    {isLoaded && (
                                        <motion.div
                                            key="reenter-btn"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                        >
                                            <button
                                                onClick={handleReset}
                                                className="text-xs flex items-center bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-colors"
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1.5" />
                                                다른 문서 선택
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {structure && (
                                    <button
                                        onClick={() => setIsInputFolded(!isInputFolded)}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                                        title={isInputFolded ? "펼치기" : "접기"}
                                    >
                                        <ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isInputFolded ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <AnimatePresence>
                            {!isInputFolded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-4 pt-2">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">문서 URL / ID</label>
                                            <div className="mt-2 relative">
                                                <input
                                                    type="text"
                                                    value={docUrl}
                                                    onChange={handleUrlChange}
                                                    placeholder="https://docs.google.com/document/d/..."
                                                    className={`
                                                        w-full pl-4 pr-10 py-3 rounded-xl focus:ring-2 outline-none transition-all text-sm
                                                        ${isUrlInvalid
                                                            ? 'bg-red-50 border-2 border-red-300 focus:ring-red-200 text-red-900 placeholder-red-300'
                                                            : 'bg-gray-50 border border-gray-200 focus:ring-indigo-500 focus:border-transparent'
                                                        }
                                                    `}
                                                />
                                                {docUrl && (
                                                    <button
                                                        onClick={() => setDocUrl("")}
                                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={fetchStructure}
                                            disabled={loading || !docUrl}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "문서 불러오기"}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {structure && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold mb-4 flex items-center">
                                <Layout className="w-5 h-5 mr-2 text-indigo-500" />
                                2. 설정
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                        목표 너비 (cm)
                                    </label>
                                    <div className="flex items-center space-x-4">



                                        <input
                                            type="range"
                                            min="5"
                                            max="20"
                                            step="0.5"
                                            value={targetWidth}
                                            onChange={(e) => setTargetWidth(Number(e.target.value))}
                                            className="flex-1 accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />

                                        <div className="w-20 pl-4 py-2 bg-gray-100 rounded-lg text-center font-mono font-bold text-gray-700">
                                            {targetWidth}cm
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                        적용 범위 (Scope)
                                    </label>
                                    <div className="p-3 bg-indigo-50 text-indigo-900 rounded-xl text-sm font-medium border border-indigo-100 truncate">
                                        {selectedImageIds.length > 0
                                            ? `${selectedImageIds.length}개 이미지 직접 선택됨`
                                            : selectedScopes.length === 0
                                                ? "선택된 챕터 없음 (문서 전체 모드)"
                                                : selectedScopes.length === structure.items.length
                                                    ? "문서 전체 선택됨"
                                                    : `${selectedScopes.length}개 챕터 선택됨`
                                        }
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        * 오른쪽 목록에서 챕터를 클릭하여 <strong>다중 선택</strong>할 수 있습니다.
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <button
                                        onClick={handleResize}
                                        disabled={resizeStatus === "processing"}
                                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-indigo-200 transition-all flex items-center justify-center space-x-2"
                                    >
                                        {resizeStatus === "processing" ? (
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                            <>
                                                <RefreshCw className="w-5 h-5" />
                                                <span>이미지 크기 조절하기</span>
                                            </>
                                        )}
                                    </button>

                                    {resultMsg && resizeStatus === 'error' && (
                                        <div className="mt-4 p-3 rounded-lg text-sm flex items-center bg-red-50 text-red-700">
                                            {resultMsg}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Selected Items Summary Box */}
                    {structure && (selectedImageIds.length > 0 || selectedScopes.length > 0) && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col max-h-[400px]">
                            <h2 className="text-xl font-bold mb-4 flex items-center flex-shrink-0">
                                <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                                선택된 항목 요약
                            </h2>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar overscroll-contain">
                                {selectedImageIds.length > 0 ? (
                                    <div className="space-y-3">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">직접 선택한 이미지 ({selectedImageIds.length})</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {selectedImageIds.map((id) => {
                                                // Find the chapter and index for this image to show a nicer label
                                                let label = "IMG";
                                                for (const chapter of structure.items) {
                                                    const idx = chapter.images.findIndex((img: any) => img.id === id);
                                                    if (idx !== -1) {
                                                        label = `IMG #${idx + 1}`;
                                                        break;
                                                    }
                                                }

                                                return (
                                                    <button
                                                        key={id}
                                                        onClick={() => setSelectedImageIds(prev => prev.filter(pid => pid !== id))}
                                                        className="group relative px-2 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] text-indigo-600 font-mono font-bold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center text-center"
                                                        title="클릭하여 선택 해제"
                                                    >
                                                        <span className="group-hover:hidden">{label}</span>
                                                        <span className="hidden group-hover:inline">삭제</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">선택된 챕터 ({selectedScopes.length})</p>
                                        <div className="grid gap-2">
                                            {selectedScopes.map((scope: any, idx: number) => (
                                                <div key={idx} className="flex items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                    <CheckCircle className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                                                    <span className="text-xs font-bold text-indigo-900 truncate">{scope.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Col: Outline */}
                <div className="md:col-span-8">
                    {structure ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col relative min-h-[500px]">
                            {/* Persistent Sticky Header - Combined & Compact */}
                            <div className="sticky top-24 z-40 bg-white border-b border-gray-100 shadow-sm rounded-t-2xl">
                                {!activeChapterId ? (
                                    <div className="p-4 bg-white/95 backdrop-blur-md rounded-t-2xl">
                                        <h2 className="text-base font-bold text-gray-900 truncate">{structure.title}</h2>
                                        <p className="text-xs text-gray-500">아래 챕터를 클릭하면, 해당 챕터만 선택해서 조절할 수 있습니다.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50 bg-white/95 backdrop-blur-md rounded-t-2xl">
                                        {/* Row 1: Navigation */}
                                        <div className="flex items-center justify-between p-3">
                                            <button
                                                onClick={handleBackToOutline}
                                                className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                                                목차로
                                            </button>

                                            <div className="flex-1 px-4 text-center">
                                                <h3 className="text-sm font-black text-gray-900 truncate">
                                                    {structure.items.find((it: any) => it.id === activeChapterId)?.title}
                                                </h3>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                    if (!currentChapter) return;
                                                    const allChapterImageIds = currentChapter.images.map((img: any) => img.id);
                                                    const areAllSelected = allChapterImageIds.every((id: string) => selectedImageIds.includes(id));

                                                    if (areAllSelected) {
                                                        setSelectedImageIds(prev => prev.filter(id => !allChapterImageIds.includes(id)));
                                                    } else {
                                                        setSelectedImageIds(prev => Array.from(new Set([...prev, ...allChapterImageIds])));
                                                    }
                                                }}
                                                className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 transition-colors px-2 py-1"
                                            >
                                                {(() => {
                                                    const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                    if (!currentChapter) return "전체 선택";
                                                    const allIds = currentChapter.images.map((img: any) => img.id);
                                                    return allIds.every((id: string) => selectedImageIds.includes(id)) ? "선택 해제" : "전체 선택";
                                                })()}
                                            </button>
                                        </div>

                                        {/* Row 2: Controls */}
                                        <div className="flex items-center justify-between p-2 px-3">
                                            <div className="flex items-center bg-gray-50 rounded-xl p-1">
                                                <button
                                                    onClick={() => setViewMode('grid')}
                                                    className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />
                                                    그리드
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('carousel')}
                                                    className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'carousel' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                                                    캐러셀
                                                </button>
                                            </div>

                                            {viewMode === 'grid' && (
                                                <div className="flex items-center space-x-1 border-l border-gray-100 pl-4">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mr-2">COLUMNS</span>
                                                    {[1, 2, 3, 4, 5].map(num => (
                                                        <button
                                                            key={num}
                                                            onClick={() => setGridCols(num)}
                                                            className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${gridCols === num ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'}`}
                                                        >
                                                            {num}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {activeChapterId ? (
                                    <div className="space-y-6">
                                        {/* View Content */}
                                        <div>
                                            {(() => {
                                                const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!currentChapter) return null;
                                                if (currentChapter.images.length === 0) {
                                                    return (
                                                        <div className="p-12 text-center text-gray-400">
                                                            이 챕터에는 조절 가능한 이미지가 없습니다.
                                                        </div>
                                                    );
                                                }

                                                if (viewMode === 'grid') {
                                                    return (
                                                        <div
                                                            className="grid gap-6"
                                                            style={{
                                                                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
                                                            }}
                                                        >
                                                            {currentChapter.images.map((img: any, i: number) => {
                                                                const isImgSelected = selectedImageIds.includes(img.id);
                                                                return (
                                                                    <div
                                                                        key={img.id}
                                                                        onClick={() => {
                                                                            if (isImgSelected) {
                                                                                setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                            } else {
                                                                                setSelectedImageIds(prev => [...prev, img.id]);
                                                                            }
                                                                        }}
                                                                        className={`
                                                                            relative cursor-pointer rounded-2xl border-2 transition-all overflow-hidden flex flex-col bg-gray-50 group
                                                                            ${isImgSelected ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-transparent hover:border-gray-200'}
                                                                        `}
                                                                    >
                                                                        <div className="relative aspect-video flex items-center justify-center p-3">
                                                                            <img
                                                                                src={img.uri}
                                                                                alt={`Img ${i}`}
                                                                                className="max-h-full max-w-full rounded shadow-sm transition-transform group-hover:scale-110 object-contain"
                                                                            />
                                                                            <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isImgSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/80 border-gray-300'}`}>
                                                                                {isImgSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                            </div>
                                                                        </div>
                                                                        <div className="p-2 bg-white border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
                                                                            <span className="truncate">#{i + 1} ({img.type})</span>
                                                                            {isImgSelected && <CheckCircle className="w-3 h-3 text-indigo-600" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                } else {
                                                    // Carousel Mode
                                                    const activeImg = currentChapter.images[carouselIndex] || currentChapter.images[0];
                                                    const isActiveSelected = selectedImageIds.includes(activeImg.id);

                                                    return (
                                                        <div className="space-y-6">
                                                            {/* Big Preview */}
                                                            <div
                                                                className={`
                                                                    relative rounded-3xl border-2 transition-all overflow-hidden bg-gray-100 group flex flex-col h-[400px]
                                                                    ${isActiveSelected ? 'border-indigo-500 shadow-xl shadow-indigo-100' : 'border-gray-200 shadow-sm'}
                                                                `}
                                                            >
                                                                <div
                                                                    className="flex-1 relative flex items-center justify-center p-8 bg-gray-50/50 cursor-pointer"
                                                                    onClick={() => {
                                                                        if (isActiveSelected) {
                                                                            setSelectedImageIds(prev => prev.filter(id => id !== activeImg.id));
                                                                        } else {
                                                                            setSelectedImageIds(prev => [...prev, activeImg.id]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={activeImg.uri}
                                                                        className="max-h-full max-w-full rounded-lg shadow-2xl transition-transform group-hover:scale-105 object-contain"
                                                                    />

                                                                    <div className={`absolute top-6 left-6 flex items-center space-x-3 bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border-2 ${isActiveSelected ? 'border-indigo-500' : 'border-transparent'}`}>
                                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isActiveSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                                            {isActiveSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                                                        </div>
                                                                        <span className="text-sm font-black text-gray-900">IMAGE #{carouselIndex + 1}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between">
                                                                    <div className="flex items-center space-x-2">
                                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{activeImg.type}</span>
                                                                        <span className="text-xs text-gray-300">|</span>
                                                                        <span className="text-xs text-gray-400">문서 내 위치: {activeImg.startIndex}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (isActiveSelected) {
                                                                                setSelectedImageIds(prev => prev.filter(id => id !== activeImg.id));
                                                                            } else {
                                                                                setSelectedImageIds(prev => [...prev, activeImg.id]);
                                                                            }
                                                                        }}
                                                                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${isActiveSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                                    >
                                                                        {isActiveSelected ? "선택 해제" : "현재 이미지 선택"}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Thumbnail Track */}
                                                            <div className="flex overflow-x-auto pb-4 gap-3 custom-scrollbar">
                                                                {currentChapter.images.map((img: any, i: number) => {
                                                                    const isSelected = selectedImageIds.includes(img.id);
                                                                    const isActive = carouselIndex === i;
                                                                    return (
                                                                        <button
                                                                            key={img.id}
                                                                            onClick={() => setCarouselIndex(i)}
                                                                            className={`
                                                                            relative flex-shrink-0 w-24 h-24 rounded-2xl border-2 transition-all p-2 overflow-hidden
                                                                            ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 bg-white' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}
                                                                        `}
                                                                        >
                                                                            <img src={img.uri} className="w-full h-full object-contain rounded" />
                                                                            {isSelected && (
                                                                                <div className="absolute top-1 right-1">
                                                                                    <CheckCircle className="w-4 h-4 text-indigo-600 bg-white rounded-full" />
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute bottom-1 left-1 bg-black/60 text-[8px] text-white px-1.5 rounded-md font-bold">
                                                                                #{i + 1}
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <div
                                            onClick={() => {
                                                if (selectedScopes.length === structure.items.length) {
                                                    setSelectedScopes([]);
                                                } else {
                                                    setSelectedScopes(structure.items.map((it: any) => ({
                                                        start: it.startIndex,
                                                        end: it.scopeEndIndex,
                                                        label: it.title
                                                    })));
                                                }
                                            }}
                                            className="group flex items-center p-4 rounded-xl border-2 border-dashed border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer mb-6"
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${selectedScopes.length === structure.items.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                                {selectedScopes.length === structure.items.length && <CheckCircle className="w-4 h-4 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-900">문서 전체 선택</h3>
                                                <p className="text-xs text-gray-500">모든 제목과 내용을 한 번에 선택합니다.</p>
                                            </div>
                                        </div>

                                        {structure.items.map((item: any, idx: number) => {
                                            const isSelected = selectedScopes.some(s => s.start === item.startIndex);

                                            return (
                                                <motion.div
                                                    key={item.id || idx}
                                                    id={`chapter-${item.id}`}
                                                    initial={false}
                                                    animate={{
                                                        backgroundColor: highlightedChapterId === item.id ? "rgba(163, 230, 53, 0.4)" : isSelected ? "rgba(238, 242, 255, 1)" : "rgba(255, 255, 255, 0)",
                                                        scale: highlightedChapterId === item.id ? 1.02 : 1,
                                                        borderColor: highlightedChapterId === item.id ? "#84cc16" : isSelected ? "#c7d2fe" : "rgba(0,0,0,0)"
                                                    }}
                                                    transition={{ duration: highlightedChapterId === item.id ? 0.3 : 0.8 }}
                                                    className={`
                                                    group p-3 rounded-xl cursor-pointer mb-1 select-none flex items-center justify-between border
                                                    ${isSelected ? 'text-indigo-900 border-indigo-200' : 'hover:bg-gray-50 text-gray-700 border-transparent'}
                                                `}
                                                    style={{ marginLeft: `${(item.level - 1) * 20}px` }}
                                                >
                                                    <div
                                                        className="flex items-center flex-1"
                                                        onClick={() => {
                                                            // Clicking the text opens the gallery
                                                            setActiveChapterId(item.id);
                                                            // Scroll to top of page/right pane
                                                            window.scrollTo({ top: 0, behavior: 'auto' });
                                                        }}
                                                    >
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const descendants: any[] = [];
                                                                const currentLevel = item.level;
                                                                for (let i = idx + 1; i < structure.items.length; i++) {
                                                                    const nextItem = structure.items[i];
                                                                    if (nextItem.level > currentLevel) {
                                                                        descendants.push(nextItem);
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                                const isCurrentlySelected = selectedScopes.some(s => s.start === item.startIndex);
                                                                const toScope = (it: any) => ({ start: it.startIndex, end: it.scopeEndIndex, label: it.title });

                                                                if (isCurrentlySelected) {
                                                                    const rangesToRemove = [item.startIndex, ...descendants.map(d => d.startIndex)];
                                                                    setSelectedScopes(prev => prev.filter(s => !rangesToRemove.includes(s.start)));
                                                                } else {
                                                                    const newScopes = [toScope(item), ...descendants.map(toScope)];
                                                                    setSelectedScopes(prev => {
                                                                        const existingStarts = new Set(newScopes.map(s => s.start));
                                                                        const cleanPrev = prev.filter(s => !existingStarts.has(s.start));
                                                                        return [...cleanPrev, ...newScopes];
                                                                    });
                                                                }
                                                            }}
                                                            className={`w-4 h-4 mr-3 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}
                                                        >
                                                            {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                                                        </div>

                                                        <span className={`mr-2 text-xs font-mono ${item.level === 1 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                                                            H{item.level}
                                                        </span>
                                                        <span className={`${item.level === 1 ? 'font-bold' : 'font-medium'} flex-1`}>
                                                            {item.title}
                                                        </span>

                                                        {item.imageCount > 0 && (
                                                            <div className="ml-2 flex items-center text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
                                                                <ImageIcon className="w-3 h-3 mr-1" />
                                                                {item.imageCount}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                        <MousePointerClick className="w-4 h-4 text-indigo-400" />
                                                    </div>
                                                </motion.div>
                                            );
                                        })}

                                        {structure.items.length === 0 && (
                                            <div className="p-8 text-center text-gray-400">
                                                제목(Heading)을 찾을 수 없습니다. 문서 전체 모드로 사용하세요.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">문서를 불러와 주세요</p>
                            <p className="text-sm">구글 문서 URL을 입력하면 목차가 여기에 표시됩니다.</p>
                        </div>
                    )}
                </div>

            </main >
        </div >
    );
}
