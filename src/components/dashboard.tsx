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
        setIsInputFolded(false); // UI Expansion requested
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

            if (data.count === 0) {
                setWarningMsg("크기를 조절할 이미지를 찾지 못했습니다. 선택 범위를 확인해 주세요.");
                setShowWarning(true);
            } else {
                // Update IDs in state if mapping provided
                if (data.newIdMapping) {
                    const mapping = data.newIdMapping;

                    // 1. Update selectedImageIds
                    setSelectedImageIds(prev => prev.map(id => mapping[id] || id));

                    // 2. Update structure.items[].images[].id
                    if (structure) {
                        const newStructure = { ...structure };
                        newStructure.items = newStructure.items.map((item: any) => ({
                            ...item,
                            images: item.images.map((img: any) => ({
                                ...img,
                                id: mapping[img.id] || img.id
                            }))
                        }));
                        setStructure(newStructure);
                    }
                }

                setResizeStatus("success");
                setResultMsg(data.message);
                setSuccessMsg(data.message); // Show popup
                setShowSuccess(true);
            }
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
            <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-8">
                <AnimatePresence>
                    {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}
                </AnimatePresence>

                <div className="grid md:grid-cols-12 gap-8">
                    {/* Left Col: Setup - Sticky Sidebar */}
                    <div className="md:col-span-4 space-y-4 md:sticky md:top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pr-1 hidden-scrollbar md:block overscroll-contain">

                        {/* Help Cards */}
                        <AnimatePresence>
                            {!structure && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden space-y-3"
                                >
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2 opacity-5">
                                            <FileText className="w-16 h-16" />
                                        </div>
                                        <h3 className="font-bold mb-2 flex items-center text-blue-800">
                                            <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                                            시작하기 전에 확인해 주세요!
                                        </h3>
                                        <ul className="space-y-1.5 pl-1 z-10 relative text-[11px] leading-relaxed">
                                            <li className="flex items-start">
                                                <span className="mr-2 text-blue-400 font-bold">1.</span>
                                                <span>수정하려는 문서의 <strong className="font-bold">편집 권한</strong>이 있는지 확인해주세요.</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="mr-2 text-blue-400 font-bold">2.</span>
                                                <span>문서 내에 <strong className="font-bold">직접 삽입된 이미지</strong>만 크기 조절이 가능합니다.</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="mr-2 text-blue-400 font-bold">3.</span>
                                                <span>챕터별 기능을 사용하려면 <strong className="font-bold">제목 스타일</strong>을 적용해야 합니다.</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start">
                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mr-3 flex-shrink-0">
                                            <ShieldCheck className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-0.5 text-xs">안전한 데이터 처리</h4>
                                            <p className="text-[10px] text-gray-500 leading-tight">
                                                모든 이미지 처리는 사용자의 구글 드라이브 권한 내에서만 안전하게 수행됩니다.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 1. Document Selection */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-base font-bold flex items-center">
                                    <FileText className="w-4 h-4 mr-2 text-indigo-500" />
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
                                                    className="text-[10px] flex items-center bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-full transition-colors font-bold"
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1" />
                                                    다른 문서
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {structure && (
                                        <button
                                            onClick={() => setIsInputFolded(!isInputFolded)}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-400"
                                        >
                                            <ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isInputFolded ? 'rotate-180' : ''}`} />
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
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">문서 URL / ID</label>
                                                <div className="mt-1.5 relative">
                                                    <input
                                                        type="text"
                                                        value={docUrl}
                                                        onChange={handleUrlChange}
                                                        placeholder="https://docs.google.com/document/d/..."
                                                        className={`w-full pl-3 pr-8 py-2.5 rounded-xl border text-sm outline-none transition-all ${isUrlInvalid ? 'bg-red-50 border-red-200 focus:ring-red-100' : 'bg-gray-50 border-gray-100 focus:border-indigo-300'}`}
                                                    />
                                                    {docUrl && (
                                                        <button onClick={() => setDocUrl("")} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">×</button>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={fetchStructure}
                                                disabled={loading || !docUrl}
                                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center"
                                            >
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "문서 불러오기"}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* 2. Settings (Optimized & Compact) */}
                        {structure && (
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-bold flex items-center text-gray-800">
                                        <Layout className="w-4 h-4 mr-2 text-indigo-500" />
                                        2. 환경 설정
                                    </h2>
                                    <div className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-mono font-black text-2xl shadow-inner border border-indigo-100 flex items-center justify-center min-w-[100px]">{targetWidth}<span className="text-xs ml-1 opacity-50">cm</span></div>
                                </div>

                                <div className="flex items-center space-x-6 bg-gray-50/50 p-3 rounded-2xl border border-gray-50">
                                    <input
                                        type="range"
                                        min="5"
                                        max="20"
                                        step="0.5"
                                        value={targetWidth}
                                        onChange={(e) => setTargetWidth(Number(e.target.value))}
                                        className="flex-1 accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex flex-col items-end min-w-[70px]">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">이미지</span>
                                        <div className="flex items-center text-xs font-bold text-gray-700">
                                            {selectedImageIds.length > 0 ? `${selectedImageIds.length}개` : selectedScopes.length === 0 ? "전체" : `${selectedScopes.length}개`}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleResize}
                                    disabled={resizeStatus === "processing"}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-100 transition-all flex items-center justify-center space-x-2"
                                >
                                    {resizeStatus === "processing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3.5 h-3.5" /><span>크기 조정</span></>}
                                </button>
                            </div>
                        )}

                        {resultMsg && resizeStatus === 'error' && (
                            <div className="mt-4 p-3 rounded-lg text-sm flex items-center bg-red-50 text-red-700">{resultMsg}</div>
                        )}

                        {/* Selected Items Summary Box */}
                        <AnimatePresence>
                            {structure && (selectedImageIds.length > 0 || selectedScopes.length > 0) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4 flex flex-col max-h-[400px]"
                                >
                                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                        <h2 className="text-base font-bold flex items-center">
                                            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                            항목 요약
                                        </h2>
                                        <button
                                            onClick={() => { setSelectedImageIds([]); setSelectedScopes([]); }}
                                            className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-tighter bg-gray-50 px-2 py-1 rounded-md transition-colors"
                                        >
                                            전체 선택 해제
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar overscroll-contain space-y-4">
                                        {/* Selected Chapters (Visual) */}
                                        {selectedScopes.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">선택된 챕터 ({selectedScopes.length}개)</p>
                                                <div className="space-y-1">
                                                    {selectedScopes.map((scope: any, idx: number) => {
                                                        const chapter = structure.items.find((it: any) => it.startIndex === scope.start);
                                                        return (
                                                            <div key={idx} className="bg-indigo-50/40 rounded-xl p-2 border border-indigo-100/50 flex flex-col space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center">
                                                                        <CheckCircle className="w-3 h-3 mr-2 text-indigo-500" />
                                                                        <span className="text-[11px] font-bold text-indigo-900 truncate max-w-[150px]">{scope.label}</span>
                                                                    </div>
                                                                    <button onClick={() => {
                                                                        setSelectedScopes(prev => prev.filter(s => s.start !== scope.start));
                                                                        if (chapter) {
                                                                            const idsToRemove = chapter.images.map((img: any) => img.id);
                                                                            setSelectedImageIds(prev => prev.filter(id => !idsToRemove.includes(id)));
                                                                        }
                                                                    }} className="text-[9px] text-gray-400 hover:text-red-500 font-bold">제거</button>
                                                                </div>
                                                                {chapter && chapter.images.length > 0 && (
                                                                    <div className="flex -space-x-2 overflow-hidden pl-1">
                                                                        {chapter.images.slice(0, 5).map((img: any) => (
                                                                            <div key={img.id} className="w-6 h-6 rounded-md border-2 border-white bg-gray-100 overflow-hidden shadow-sm">
                                                                                <img src={img.uri} className="w-full h-full object-cover" />
                                                                            </div>
                                                                        ))}
                                                                        {chapter.images.length > 5 && (
                                                                            <div className="w-6 h-6 rounded-md border-2 border-white bg-indigo-100 flex items-center justify-center text-[8px] font-black text-indigo-600 shadow-sm">
                                                                                +{chapter.images.length - 5}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Individual Selected Images (Visual Grid) */}
                                        {selectedImageIds.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">개별 선택 이미지 ({selectedImageIds.length}개)</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {selectedImageIds.map((id) => {
                                                        let imageUri = null;
                                                        for (const chapter of structure.items) {
                                                            const img = chapter.images.find((i: any) => i.id === id);
                                                            if (img) { imageUri = img.uri; break; }
                                                        }
                                                        return (
                                                            <button key={id} onClick={() => setSelectedImageIds(prev => prev.filter(pid => pid !== id))} className="group relative aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 hover:border-red-300 transition-all shadow-sm">
                                                                {imageUri ? <img src={imageUri} className="w-full h-full object-cover group-hover:opacity-40" /> : <ImageIcon className="w-4 h-4 text-gray-400" />}
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"><span className="text-[8px] font-black text-red-600 bg-white/90 px-1 py-0.5 rounded shadow-sm uppercase tracking-tighter">제외</span></div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Col: Outline / Content */}
                    <div className="md:col-span-8">
                        {structure ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col relative min-h-[500px]">
                                {/* Persistent Sticky Header */}
                                <div className="sticky top-24 z-40 bg-white border-b border-gray-100 shadow-sm rounded-t-2xl">
                                    {!activeChapterId ? (
                                        <div className="p-4 bg-white/95 backdrop-blur-md rounded-t-2xl">
                                            <h2 className="text-base font-bold text-gray-900 truncate">{structure.title}</h2>
                                            <p className="text-xs text-gray-500">아래 챕터를 클릭하면, 해당 챕터만 선택해서 조절할 수 있습니다.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-50 bg-white/95 backdrop-blur-md rounded-t-2xl">
                                            <div className="flex items-center justify-between p-3">
                                                <button onClick={handleBackToOutline} className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold">
                                                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                                                    목차로
                                                </button>
                                                <div className="flex-1 px-4 text-center">
                                                    <h3 className="text-sm font-black text-gray-900 truncate">{structure.items.find((it: any) => it.id === activeChapterId)?.title}</h3>
                                                </div>
                                                <button onClick={() => {
                                                    const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                    if (!currentChapter) return;
                                                    const allIds = currentChapter.images.map((img: any) => img.id);
                                                    const areAllSelected = allIds.every((id: string) => selectedImageIds.includes(id));
                                                    if (areAllSelected) setSelectedImageIds(prev => prev.filter(id => !allIds.includes(id)));
                                                    else setSelectedImageIds(prev => Array.from(new Set([...prev, ...allIds])));
                                                }} className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 px-2 py-1">
                                                    {(() => {
                                                        const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                        const allIds = currentChapter?.images.map((img: any) => img.id) || [];
                                                        return allIds.every((id: string) => selectedImageIds.includes(id)) ? "선택 해제" : "전체 선택";
                                                    })()}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-2 px-3">
                                                <div className="flex items-center bg-gray-50 rounded-xl p-1">
                                                    <button onClick={() => setViewMode('grid')} className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>
                                                        <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />
                                                        그리드
                                                    </button>
                                                    <button onClick={() => setViewMode('carousel')} className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'carousel' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>
                                                        <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                                                        캐러셀
                                                    </button>
                                                </div>
                                                {viewMode === 'grid' && (
                                                    <div className="flex items-center space-x-1 pl-4">
                                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mr-2">COLUMNS</span>
                                                        {[1, 2, 3, 4, 5].map(num => (
                                                            <button key={num} onClick={() => setGridCols(num)} className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${gridCols === num ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-100'}`}>{num}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content Area */}
                                <div className="p-6 flex-1">
                                    {activeChapterId ? (
                                        <div>
                                            {(() => {
                                                const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!currentChapter) return null;
                                                if (currentChapter.images.length === 0) return <div className="p-12 text-center text-gray-400">이 챕터에는 조절 가능한 이미지가 없습니다.</div>;

                                                if (viewMode === 'grid') {
                                                    return (
                                                        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                                                            {currentChapter.images.map((img: any, i: number) => {
                                                                const isImgSelected = selectedImageIds.includes(img.id);
                                                                return (
                                                                    <div key={img.id} onClick={() => {
                                                                        if (isImgSelected) {
                                                                            setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                            // Also deselect the chapter scope if this image was part of one
                                                                            setSelectedScopes(prev => prev.filter(s => s.start !== currentChapter.startIndex));
                                                                        } else {
                                                                            setSelectedImageIds(prev => [...prev, img.id]);
                                                                        }
                                                                    }} className={`relative cursor-pointer rounded-2xl border-2 transition-all overflow-hidden flex flex-col bg-gray-50 group ${isImgSelected ? 'border-indigo-500 shadow-lg' : 'border-transparent hover:border-gray-200'}`}>
                                                                        <div className="relative aspect-video flex items-center justify-center p-3">
                                                                            <img src={img.uri} className="max-h-full max-w-full rounded shadow-sm group-hover:scale-110 transition-transform object-contain" />
                                                                            <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isImgSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/80 border-gray-300'}`}>{isImgSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div>
                                                                        </div>
                                                                        <div className="p-2 bg-white border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500"><span className="truncate">#{i + 1} ({img.type})</span>{isImgSelected && <CheckCircle className="w-3 h-3 text-indigo-600" />}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                } else {
                                                    const activeImg = currentChapter.images[carouselIndex] || currentChapter.images[0];
                                                    const isActiveSelected = selectedImageIds.includes(activeImg.id);
                                                    return (
                                                        <div className="space-y-8">
                                                            <div className="relative aspect-video bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-center p-8 overflow-hidden group">
                                                                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />
                                                                <motion.img key={activeImg.id} src={activeImg.uri} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-h-full max-w-full relative z-10 rounded-xl shadow-2xl" />
                                                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                                                                    <button onClick={() => isActiveSelected ? setSelectedImageIds(prev => prev.filter(id => id !== activeImg.id)) : setSelectedImageIds(prev => [...prev, activeImg.id])} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${isActiveSelected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border shadow-sm'}`}>{isActiveSelected ? "선택 해제" : "현재 이미지 선택"}</button>
                                                                </div>
                                                            </div>
                                                            <div className="flex overflow-x-auto pb-4 gap-3 custom-scrollbar">
                                                                {currentChapter.images.map((img: any, i: number) => {
                                                                    const isImgSelected = selectedImageIds.includes(img.id);
                                                                    const isActive = carouselIndex === i;
                                                                    return (
                                                                        <button key={img.id} onClick={() => setCarouselIndex(i)} className={`relative flex-shrink-0 w-24 h-24 rounded-2xl border-2 transition-all p-2 overflow-hidden ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 bg-white' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}>
                                                                            <img src={img.uri} className="w-full h-full object-contain rounded" />
                                                                            {isImgSelected && <div className="absolute top-1 right-1"><CheckCircle className="w-4 h-4 text-indigo-600 bg-white rounded-full" /></div>}
                                                                            <div className="absolute bottom-1 left-1 bg-black/60 text-[8px] text-white px-1.5 rounded-md font-bold">#{i + 1}</div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div onClick={() => {
                                                if (selectedScopes.length === structure.items.length) setSelectedScopes([]);
                                                else setSelectedScopes(structure.items.map((it: any) => ({ start: it.startIndex, end: it.scopeEndIndex, label: it.title })));
                                            }} className="group flex items-center p-4 rounded-xl border-2 border-dashed border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer mb-6">
                                                <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${selectedScopes.length === structure.items.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>{selectedScopes.length === structure.items.length && <CheckCircle className="w-4 h-4 text-white" />}</div>
                                                <div className="flex-1 text-left"><h3 className="font-bold text-gray-900">문서 전체 선택</h3><p className="text-xs text-gray-500">모든 제목과 내용을 한 번에 선택합니다.</p></div>
                                            </div>
                                            {structure.items.map((item: any, idx: number) => {
                                                const isSelected = selectedScopes.some(s => s.start === item.startIndex);
                                                return (
                                                    <motion.div key={item.id || idx} id={`chapter-${item.id}`} initial={false} animate={{ backgroundColor: highlightedChapterId === item.id ? "rgba(163, 230, 53, 0.4)" : isSelected ? "rgba(238, 242, 255, 1)" : "rgba(255, 255, 255, 0)", scale: highlightedChapterId === item.id ? 1.02 : 1, borderColor: highlightedChapterId === item.id ? "#84cc16" : isSelected ? "#c7d2fe" : "rgba(0,0,0,0)" }} transition={{ duration: highlightedChapterId === item.id ? 0.3 : 0.8 }} className={`group p-3 rounded-xl cursor-pointer mb-1 select-none flex items-center justify-between border ${isSelected ? 'text-indigo-900 border-indigo-200' : 'hover:bg-gray-50 text-gray-700 border-transparent'}`} style={{ marginLeft: `${(item.level - 1) * 20}px` }}>
                                                        <div className="flex items-center flex-1" onClick={() => { setActiveChapterId(item.id); window.scrollTo({ top: 0, behavior: 'auto' }); }}>
                                                            <div onClick={(e) => {
                                                                e.stopPropagation();
                                                                const descendants: any[] = [];
                                                                const currentLevel = item.level;
                                                                for (let i = idx + 1; i < structure.items.length; i++) {
                                                                    const nextItem = structure.items[i];
                                                                    if (nextItem.level > currentLevel) descendants.push(nextItem);
                                                                    else break;
                                                                }

                                                                const isCurrentlySelected = selectedScopes.some(s => s.start === item.startIndex);
                                                                const itemsToSync = [item, ...descendants];
                                                                const allImageIds = itemsToSync.flatMap(it => it.images.map((img: any) => img.id));

                                                                if (isCurrentlySelected) {
                                                                    const rangesToRemove = itemsToSync.map(it => it.startIndex);
                                                                    setSelectedScopes(prev => prev.filter(s => !rangesToRemove.includes(s.start)));
                                                                    // Sync: Remove image IDs
                                                                    setSelectedImageIds(prev => prev.filter(id => !allImageIds.includes(id)));
                                                                } else {
                                                                    const toScope = (it: any) => ({ start: it.startIndex, end: it.scopeEndIndex, label: it.title });
                                                                    const newScopes = itemsToSync.map(toScope);
                                                                    setSelectedScopes(prev => {
                                                                        const existingStarts = new Set(newScopes.map(s => s.start));
                                                                        const cleanPrev = prev.filter(s => !existingStarts.has(s.start));
                                                                        return [...cleanPrev, ...newScopes];
                                                                    });
                                                                    // Sync: Add image IDs
                                                                    setSelectedImageIds(prev => Array.from(new Set([...prev, ...allImageIds])));
                                                                }
                                                            }} className={`w-4 h-4 mr-3 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>{isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}</div>
                                                            <span className={`mr-2 text-xs font-mono ${item.level === 1 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>H{item.level}</span>
                                                            <span className={`${item.level === 1 ? 'font-bold' : 'font-medium'} flex-1`}>{item.title}</span>
                                                            {item.imageCount > 0 && <div className="ml-2 flex items-center text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold"><ImageIcon className="w-3 h-3 mr-1" />{item.imageCount}</div>}
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"><MousePointerClick className="w-4 h-4 text-indigo-400" /></div>
                                                    </motion.div>
                                                );
                                            })}
                                            {structure.items.length === 0 && <div className="p-8 text-center text-gray-400">제목(Heading)을 찾을 수 없습니다. 문서 전체 모드로 사용하세요.</div>}
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
                </div>
                <AnimatePresence>
                    {showGuide && <GuideModal isOpen={showGuide} onClose={closeGuide} />}
                    {showWarning && <WarningModal isOpen={showWarning} onClose={() => setShowWarning(false)} message={warningMsg} />}
                </AnimatePresence>
            </main>
        </div>
    );
}
