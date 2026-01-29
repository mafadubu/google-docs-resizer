"use client";

import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect } from "react";
import {
    Loader2, Search, FileText, Layout, RefreshCw, LogOut, CheckCircle,
    ShieldCheck, ChevronUp, User, ChevronLeft, ChevronRight, ImageIcon,
    MousePointerClick, Grid3X3, Maximize2, Columns, LayoutList,
    AlertCircle, Info, ExternalLink, HelpCircle, Copy, ArrowRight, Trash2
} from "lucide-react";
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
    const [showGuide, setShowGuide] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [warningMsg, setWarningMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [isUrlInvalid, setIsUrlInvalid] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInputFolded, setIsInputFolded] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [imgError, setImgError] = useState(false);

    const [targetWidth, setTargetWidth] = useState(10); // cm
    const [resizeStatus, setResizeStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
    const [resultMsg, setResultMsg] = useState("");

    const imageToHeadingMap = React.useMemo(() => {
        if (!structure) return {} as Record<string, string>;
        const map: Record<string, string> = {};
        structure.items.forEach((item: any) => {
            item.images.forEach((img: any) => {
                const existing = map[img.uri];
                if (!existing) {
                    map[img.uri] = item.id;
                } else {
                    const existingItem = structure.items.find((it: any) => it.id === existing);
                    if (existingItem && item.level > existingItem.level) {
                        map[img.uri] = item.id;
                    }
                }
            });
        });
        return map;
    }, [structure]);

    const getImageHierarchy = (imageId: string) => {
        if (!structure) return null;
        for (const item of structure.items) {
            const img = item.images.find((i: any) => i.id === imageId);
            if (img) {
                const parents: string[] = [];
                const currentIdx = structure.items.indexOf(item);
                let currentLevel = item.level;
                parents.unshift(item.title);
                for (let i = currentIdx - 1; i >= 0; i--) {
                    const candidate = structure.items[i];
                    if (candidate.level < currentLevel) {
                        parents.unshift(candidate.title);
                        currentLevel = candidate.level;
                    }
                    if (currentLevel === 1) break;
                }
                return parents;
            }
        }
        return null;
    };

    useEffect(() => {
        // @ts-ignore
        if (session?.error === "RefreshAccessTokenError") {
            setWarningMsg("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
            setShowWarning(true);
            setTimeout(() => { signOut(); }, 3000);
        }
    }, [session]);

    useEffect(() => {
        if (isLoaded) setIsInputFolded(true);
    }, [isLoaded]);

    useEffect(() => {
        const hasSeenGuide = localStorage.getItem("has-seen-guide");
        if (!hasSeenGuide) setShowGuide(true);
    }, []);

    const closeGuide = () => {
        setShowGuide(false);
        localStorage.setItem("has-seen-guide", "true");
    };

    // Helper: Scroll to element with offset if needed
    const scrollToElement = (id: string, containerId?: string, autoNavigateId?: { type: 'chapter' | 'heading', id: string, fallbackId?: string }) => {
        const tryScroll = (retryCount = 0) => {
            const el = document.getElementById(id) || (autoNavigateId?.fallbackId ? document.getElementById(autoNavigateId.fallbackId) : null);

            // 1. If element not found and we need to navigate chapters (Right Col)
            if (!el && autoNavigateId && autoNavigateId.type === 'chapter') {
                setActiveChapterId(autoNavigateId.id);
                if (retryCount < 5) setTimeout(() => tryScroll(retryCount + 1), 250);
                return;
            }

            // 2. Element found
            if (el) {
                // Standard scrollIntoView handles nested scroll containers (sidebar + internal list) automatically
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Force internal container scroll if provided (additional centering)
                if (containerId) {
                    const container = document.getElementById(containerId);
                    if (container && container.scrollHeight > container.clientHeight) {
                        const rect = el.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        const targetTop = container.scrollTop + (rect.top - containerRect.top) - (containerRect.height / 2) + (rect.height / 2);
                        container.scrollTo({ top: targetTop, behavior: 'smooth' });
                    }
                }
            } else if (retryCount < 8) {
                // 3. Keep trying (Useful when summary box is mounting for the first time)
                setTimeout(() => tryScroll(retryCount + 1), 100);
            }
        };

        // Start scrolling attempt
        setTimeout(() => tryScroll(0), 50);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setDocUrl(url);
        if (isUrlInvalid) setIsUrlInvalid(false);
    };

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
            setTimeout(() => {
                const element = document.getElementById(`chapter-${idToTarget}`);
                if (element) element.scrollIntoView({ behavior: 'auto', block: 'center' });
            }, 100);
        }
    };

    const handleReset = () => {
        setIsLoaded(false);
        setIsInputFolded(false);
        setDocUrl("");
        setResizeStatus("idle");
        setResultMsg("");
        setIsUrlInvalid(false);
        setWarningMsg("");
    };

    const fetchStructure = async () => {
        if (!docUrl.includes("docs.google.com/document/d/")) {
            setWarningMsg("올바른 Google Docs URL을 입력해주세요.");
            setShowWarning(true);
            setIsUrlInvalid(true);
            return;
        }
        let docId = docUrl;
        const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) docId = match[1];
        if (!docId) return;

        setLoading(true);
        try {
            const res = await fetch("/api/doc/structure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setStructure({ ...data, id: docId });
            setIsLoaded(true);
            setSelectedScopes([]);
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
                if (data.newIdMapping) {
                    const mapping = data.newIdMapping;
                    setSelectedImageIds(prev => prev.map(id => mapping[id] || id));
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
                setSuccessMsg(data.message);
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
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => { activeChapterId ? handleBackToOutline() : window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">G</div>
                    <span className="font-bold text-lg tracking-tight group-hover:text-indigo-600 transition-colors">Docs Resizer ✨</span>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <div className="opacity-0 px-3 py-1.5 flex items-center pointer-events-none select-none" aria-hidden="true"><div className="w-4 h-4 mr-1.5" />사용 방법</div>
                        <AnimatePresence>
                            {!showGuide && (
                                <motion.button layoutId="guide-modal-trigger" onClick={() => setShowGuide(true)} className="absolute inset-0 w-full h-full text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full transition-colors flex items-center z-10">
                                    <motion.span layoutId="guide-icon" className="flex items-center"><CheckCircle className="w-4 h-4 mr-1.5" /></motion.span>
                                    <motion.span layoutId="guide-text">사용 방법</motion.span>
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-200">
                            {session?.user?.image && !imgError ? <img src={session.user.image} alt="User" className="w-full h-full object-cover" onError={() => setImgError(true)} /> : <User className="w-4 h-4 text-gray-400" />}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{session?.user?.name}</span>
                    </div>
                    <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="로그아웃"><LogOut className="w-5 h-5" /></button>
                </div>
            </header>
            <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-8">
                <AnimatePresence>{showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}</AnimatePresence>
                <div className="grid md:grid-cols-12 gap-8">
                    {/* Left Col: Setup - Sticky Sidebar */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-4'} space-y-4 md:sticky md:top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pr-1 hidden-scrollbar md:block overscroll-contain`}>
                        <AnimatePresence>
                            {!isSummaryExpanded && (
                                <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                                    {!structure && (
                                        <div className="space-y-3">
                                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-5"><FileText className="w-16 h-16" /></div>
                                                <h3 className="font-bold mb-2 flex items-center text-blue-800"><CheckCircle className="w-4 h-4 mr-2 text-blue-600" />시작하기 전에 확인해 주세요!</h3>
                                                <ul className="space-y-1.5 pl-1 z-10 relative text-[11px] leading-relaxed">
                                                    <li className="flex items-start"><span className="mr-2 text-blue-400 font-bold">1.</span><span>수정하려는 문서의 <strong className="font-bold">편집 권한</strong>이 있는지 확인해주세요.</span></li>
                                                    <li className="flex items-start"><span className="mr-2 text-blue-400 font-bold">2.</span><span>문서 내에 <strong className="font-bold">직접 삽입된 이미지</strong>만 크기 조절이 가능합니다.</span></li>
                                                    <li className="flex items-start"><span className="mr-2 text-blue-400 font-bold">3.</span><span>챕터별 기능을 사용하려면 <strong className="font-bold">제목 스타일</strong>을 적용해야 합니다.</span></li>
                                                </ul>
                                            </div>
                                            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start">
                                                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mr-3 flex-shrink-0"><ShieldCheck className="w-4 h-4 text-green-600" /></div>
                                                <div><h4 className="font-bold text-gray-900 mb-0.5 text-xs">안전한 데이터 처리</h4><p className="text-[10px] text-gray-500 leading-tight">모든 이미지 처리는 사용자의 구글 드라이브 권한 내에서만 안전하게 수행됩니다.</p></div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="text-base font-bold flex items-center"><FileText className="w-4 h-4 mr-2 text-indigo-500" />1. 문서 선택</h2>
                                            <div className="flex items-center space-x-2">
                                                <AnimatePresence>
                                                    {isLoaded && (<motion.div key="reenter-btn" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}><button onClick={handleReset} className="text-[10px] flex items-center bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-full transition-colors font-bold"><RefreshCw className="w-3 h-3 mr-1" />다른 문서</button></motion.div>)}
                                                </AnimatePresence>
                                                {structure && (<button onClick={() => setIsInputFolded(!isInputFolded)} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronUp className={`w-4 h-4 transition-transform duration-300 ${isInputFolded ? 'rotate-180' : ''}`} /></button>)}
                                            </div>
                                        </div>
                                        <AnimatePresence>
                                            {!isInputFolded && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                    <div className="space-y-4 pt-2">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">문서 URL / ID</label>
                                                            <div className="mt-1.5 relative">
                                                                <input type="text" value={docUrl} onChange={handleUrlChange} placeholder="https://docs.google.com/document/d/..." className={`w-full pl-3 pr-8 py-2.5 rounded-xl border text-sm outline-none transition-all ${isUrlInvalid ? 'bg-red-50 border-red-200 focus:ring-red-100' : 'bg-gray-50 border-gray-100 focus:border-indigo-300'}`} />
                                                                {docUrl && <button onClick={() => setDocUrl("")} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">×</button>}
                                                            </div>
                                                        </div>
                                                        <button onClick={fetchStructure} disabled={loading || !docUrl} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "문서 불러오기"}</button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    {resultMsg && resizeStatus === 'error' && <div className="mt-4 p-3 rounded-lg text-sm flex items-center bg-red-50 text-red-700">{resultMsg}</div>}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {structure && (
                            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex flex-col space-y-3 sticky top-0 z-20">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-bold flex items-center text-gray-800"><Layout className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />2. 환경 설정</h2>
                                    <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-mono font-black text-xl shadow-inner border border-indigo-100 flex items-center justify-center min-w-[70px]">{targetWidth}<span className="text-[10px] ml-0.5 opacity-50 font-sans">cm</span></div>
                                </div>
                                <div className="flex items-center space-x-4 bg-gray-50/50 p-2 rounded-xl border border-gray-50">
                                    <input type="range" min="5" max="20" step="0.5" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                    <div className="flex flex-col items-end min-w-[50px]"><span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">이미지</span><div className="flex items-center text-[10px] font-bold text-gray-700">{selectedImageIds.length > 0 ? `${selectedImageIds.length}개` : selectedScopes.length === 0 ? "전체" : `${selectedScopes.length}개`}</div></div>
                                </div>
                                <button onClick={handleResize} disabled={resizeStatus === "processing"} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-[11px] shadow-md shadow-indigo-100 transition-all flex items-center justify-center space-x-2">{resizeStatus === "processing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3" /><span>크기 조정</span></>}</button>
                            </div>
                        )}

                        {/* Selected Items Summary Box */}
                        <AnimatePresence>
                            {structure && (selectedImageIds.length > 0 || selectedScopes.length > 0) && (
                                <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4 flex flex-col ${isSummaryExpanded ? 'min-h-[500px]' : 'max-h-[400px]'}`}>
                                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                        <div className="flex items-center space-x-2">
                                            <h2 className="text-base font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />항목 요약</h2>
                                            <button onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className={`p-1.5 rounded-lg transition-all ${isSummaryExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`} title={isSummaryExpanded ? "기본 보기" : "길게 보기"}>{isSummaryExpanded ? <Columns className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
                                        </div>
                                        <button onClick={() => { setSelectedImageIds([]); setSelectedScopes([]); }} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-tighter bg-gray-50 px-2 py-1 rounded-md transition-colors">전체 선택 해제</button>
                                    </div>
                                    <div id="summary-list" className={`flex-1 overflow-y-auto pr-2 custom-scrollbar overscroll-contain space-y-4`}>
                                        {(() => {
                                            if (!structure || selectedImageIds.length === 0) return <div className="text-center py-24 text-gray-300"><ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-10" /><p className="text-sm font-bold">선택된 이미지가 없습니다.</p></div>;

                                            // Determine visibility of each heading in the summary
                                            const isHeadingVisibleInSummary = (item: any) => {
                                                // 1. Has selected images that "belong" here
                                                const hasSelectedImages = item.images.some((img: any) =>
                                                    selectedImageIds.includes(img.id) && imageToHeadingMap[img.uri] === item.id
                                                );
                                                if (hasSelectedImages) return true;

                                                // 2. Has any descendant that is visible
                                                const idx = structure.items.indexOf(item);
                                                for (let i = idx + 1; i < structure.items.length; i++) {
                                                    const next = structure.items[i];
                                                    if (next.level > item.level) {
                                                        const hasSelectedDescImages = next.images.some((img: any) =>
                                                            selectedImageIds.includes(img.id) && imageToHeadingMap[img.uri] === next.id
                                                        );
                                                        if (hasSelectedDescImages) return true;
                                                    } else break;
                                                }
                                                return false;
                                            };

                                            return structure.items.map((item: any) => {
                                                if (!isHeadingVisibleInSummary(item)) return null;

                                                const chapterImages = item.images.filter((img: any) =>
                                                    selectedImageIds.includes(img.id) && imageToHeadingMap[img.uri] === item.id
                                                );

                                                const hierarchy = getImageHierarchy(item.images[0]?.id || "");
                                                const isTopLevel = item.level <= 2;

                                                return (
                                                    <div key={item.id} id={`summary-heading-${item.id}`} className={`${isTopLevel ? 'bg-indigo-50/50' : 'bg-white border-dashed'} rounded-2xl p-4 border border-indigo-100/50 space-y-4 shadow-sm transition-all`}>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center space-x-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isTopLevel ? 'bg-indigo-600' : 'bg-indigo-300'}`} />
                                                                <div className="flex flex-col min-w-0">
                                                                    {hierarchy && hierarchy.length > 1 && !isTopLevel && (
                                                                        <div className="flex items-center space-x-1.5 opacity-60 mb-0.5">
                                                                            <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded uppercase tracking-tighter">
                                                                                {hierarchy[hierarchy.length - 2]}
                                                                            </span>
                                                                            <ChevronRight className="w-2 h-2 text-indigo-300" />
                                                                        </div>
                                                                    )}
                                                                    <h4 className={`font-black tracking-tight truncate ${isTopLevel ? 'text-indigo-950 text-xs' : 'text-indigo-900 text-[11px]'}`}>{item.title}</h4>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {chapterImages.length > 0 && (
                                                            <div className={`grid gap-3 grid-cols-4`}>
                                                                {chapterImages.map((img: any) => (
                                                                    <button key={img.id} id={`summary-img-${img.id}`} onClick={() => {
                                                                        setSelectedImageIds(prev => prev.filter(pid => pid !== img.id));
                                                                        scrollToElement(`detail-img-${img.id}`, undefined, { type: 'chapter', id: item.id });
                                                                    }} className="group relative aspect-square bg-white rounded-xl overflow-hidden border border-indigo-100 hover:border-red-300 transition-all shadow-md">
                                                                        <img src={img.uri} className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><div className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg transform scale-0 group-hover:scale-100 transition-transform">삭제</div></div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Col: Outline / Content */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-8'} block`}>
                        {structure ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col relative min-h-[500px]">
                                <div className="sticky top-24 z-40 bg-white border-b border-gray-100 shadow-sm rounded-t-2xl">
                                    {!activeChapterId ? (
                                        <div className="p-4 bg-white/95 backdrop-blur-md rounded-t-2xl"><h2 className="text-base font-bold text-gray-900 truncate">{structure.title}</h2><p className="text-xs text-gray-500">아래 챕터를 클릭하면, 해당 챕터만 선택해서 조절할 수 있습니다.</p></div>
                                    ) : (
                                        <div className="divide-y divide-gray-50 bg-white/95 backdrop-blur-md rounded-t-2xl">
                                            <div className="flex items-center justify-between p-3">
                                                <button onClick={handleBackToOutline} className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold"><ChevronLeft className="w-3.5 h-3.5 mr-1" />목차로</button>
                                                <div className="flex-1 px-4 text-center"><h3 className="text-sm font-black text-gray-900 truncate">{structure.items.find((it: any) => it.id === activeChapterId)?.title}</h3></div>
                                                <button onClick={() => {
                                                    const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                    if (!currentChapter) return;
                                                    const allIds = currentChapter.images.map((img: any) => img.id);
                                                    const areAllSelected = allIds.every((id: string) => selectedImageIds.includes(id));
                                                    if (areAllSelected) setSelectedImageIds(prev => prev.filter(id => !allIds.includes(id)));
                                                    else setSelectedImageIds(prev => Array.from(new Set([...prev, ...allIds])));
                                                }} className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 px-2 py-1">{(() => {
                                                    const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                    const allIds = currentChapter?.images.map((img: any) => img.id) || [];
                                                    return allIds.every((id: string) => selectedImageIds.includes(id)) ? "선택 해제" : "전체 선택";
                                                })()}</button>
                                            </div>
                                            <div className="flex items-center justify-between p-2 px-3">
                                                <div className="flex items-center bg-gray-50 rounded-xl p-1">
                                                    <button onClick={() => setViewMode('grid')} className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><Grid3X3 className="w-3.5 h-3.5 mr-1.5" />그리드</button>
                                                    <button onClick={() => setViewMode('carousel')} className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'carousel' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><Maximize2 className="w-3.5 h-3.5 mr-1.5" />캐러셀</button>
                                                </div>
                                                {viewMode === 'grid' && (
                                                    <div className="flex items-center space-x-1 pl-4">
                                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mr-2">열 개수</span>
                                                        {[1, 2, 3, 4, 5].map(num => (<button key={num} onClick={() => setGridCols(num)} className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${gridCols === num ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-100'}`}>{num}</button>))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 flex-1">
                                    {activeChapterId ? (
                                        <div>
                                            {(() => {
                                                const currentChapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!currentChapter) return null;
                                                if (currentChapter.images.length === 0) return <div className="p-12 text-center text-gray-400">이 챕터에는 조절 가능한 이미지가 없습니다.</div>;
                                                if (viewMode === 'grid') {
                                                    const currentIdx = structure.items.indexOf(currentChapter);
                                                    const subItems = [currentChapter];
                                                    for (let j = currentIdx + 1; j < structure.items.length; j++) {
                                                        if (structure.items[j].level > currentChapter.level) subItems.push(structure.items[j]);
                                                        else break;
                                                    }
                                                    return (
                                                        <div className="space-y-8">
                                                            {subItems.map(item => {
                                                                const filteredImages = item.images.filter((img: any) =>
                                                                    imageToHeadingMap[img.uri] === item.id
                                                                );

                                                                return (
                                                                    <div key={item.id} id={`detail-heading-${item.id}`} className="space-y-4 pt-4">
                                                                        <div className="flex items-center space-x-2 border-b border-gray-50 pb-2">
                                                                            <span className="text-[10px] items-center flex font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-widest">H{item.level}</span>
                                                                            <h4 className="text-xs font-bold text-gray-700">{item.title}</h4>
                                                                        </div>
                                                                        {filteredImages.length > 0 ? (
                                                                            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                                                                                {filteredImages.map((img: any) => {
                                                                                    const isImgSelected = selectedImageIds.includes(img.id);
                                                                                    const originalIdx = item.images.findIndex((i: any) => i.id === img.id);
                                                                                    return (
                                                                                        <div key={img.id} id={`detail-img-${img.id}`} onClick={() => {
                                                                                            if (isImgSelected) {
                                                                                                setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                                            } else {
                                                                                                setSelectedImageIds(prev => [...prev, img.id]);
                                                                                            }
                                                                                            scrollToElement(`summary-img-${img.id}`, 'summary-list', { type: 'heading', id: item.id, fallbackId: `summary-heading-${item.id}` });
                                                                                        }} className={`relative cursor-pointer rounded-2xl border-2 transition-all overflow-hidden flex flex-col bg-gray-50 group ${isImgSelected ? 'border-indigo-500 shadow-lg' : 'border-transparent hover:border-gray-200'}`}>
                                                                                            <div className="relative aspect-video flex items-center justify-center p-3">
                                                                                                <img src={img.uri} className="max-h-full max-w-full rounded shadow-sm group-hover:scale-110 transition-transform object-contain" />
                                                                                                <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isImgSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/80 border-gray-300'}`}>
                                                                                                    {isImgSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="p-2 bg-white border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
                                                                                                <span className="truncate">#{originalIdx + 1} ({img.type})</span>
                                                                                                {isImgSelected && <CheckCircle className="w-3 h-3 text-indigo-600" />}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] text-gray-300 italic pl-6">이 항목에는 직속 이미지가 없습니다. (하위 항목 확인)</div>
                                                                        )}
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
                                                                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-30" /><motion.img key={activeImg.id} src={activeImg.uri} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-h-full max-w-full relative z-10 rounded-xl shadow-2xl" />
                                                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"><button onClick={() => {
                                                                    if (isActiveSelected) {
                                                                        setSelectedImageIds(prev => prev.filter(id => id !== activeImg.id));
                                                                    } else {
                                                                        setSelectedImageIds(prev => [...prev, activeImg.id]);
                                                                    }
                                                                    scrollToElement(`summary-img-${activeImg.id}`, 'summary-list', { type: 'heading', id: currentChapter.id, fallbackId: `summary-heading-${currentChapter.id}` });
                                                                }} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${isActiveSelected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border shadow-sm'}`}>{isActiveSelected ? "선택 해제" : "현재 이미지 선택"}</button></div>
                                                            </div>
                                                            <div className="flex overflow-x-auto pb-4 gap-3 custom-scrollbar">
                                                                {currentChapter.images.map((img: any, i: number) => {
                                                                    const isImgSelected = selectedImageIds.includes(img.id);
                                                                    const isActive = carouselIndex === i;
                                                                    return (<button key={img.id} onClick={() => setCarouselIndex(i)} className={`relative flex-shrink-0 w-24 h-24 rounded-2xl border-2 transition-all p-2 overflow-hidden ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 bg-white' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}><img src={img.uri} className="w-full h-full object-contain rounded" />{isImgSelected && <div className="absolute top-1 right-1"><CheckCircle className="w-4 h-4 text-indigo-600 bg-white rounded-full" /></div>}<div className="absolute bottom-1 left-1 bg-black/60 text-[8px] text-white px-1.5 rounded-md font-bold">#{i + 1}</div></button>);
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div onClick={() => { if (selectedScopes.length === structure.items.length) setSelectedScopes([]); else setSelectedScopes(structure.items.map((it: any) => ({ start: it.startIndex, end: it.scopeEndIndex, label: it.title }))); }} className="group flex items-center p-4 rounded-xl border-2 border-dashed border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer mb-6">
                                                <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${selectedScopes.length === structure.items.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>{selectedScopes.length === structure.items.length && <CheckCircle className="w-4 h-4 text-white" />}</div>
                                                <div className="flex-1 text-left"><h3 className="font-bold text-gray-900">문서 전체 선택</h3><p className="text-xs text-gray-500">모든 제목과 내용을 한 번에 선택합니다.</p></div>
                                            </div>
                                            {structure.items.map((item: any, idx: number) => {
                                                const isSelected = selectedScopes.some(s => s.start === item.startIndex);
                                                return (
                                                    <motion.div key={item.id || idx} id={`chapter-${item.id}`} initial={false} animate={{ backgroundColor: highlightedChapterId === item.id ? "rgba(163, 230, 53, 0.4)" : isSelected ? "rgba(238, 242, 255, 1)" : "rgba(255, 255, 255, 0)", scale: highlightedChapterId === item.id ? 1.02 : 1, borderColor: highlightedChapterId === item.id ? "#84cc16" : isSelected ? "#c7d2fe" : "rgba(0,0,0,0)" }} transition={{ duration: highlightedChapterId === item.id ? 0.3 : 0.8 }} className={`group p-3 rounded-xl cursor-pointer mb-1 select-none flex items-center justify-between border ${isSelected ? 'text-indigo-900 border-indigo-200' : 'hover:bg-gray-50 text-gray-700 border-transparent'}`}>
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
                                                                    setSelectedImageIds(prev => prev.filter(id => !allImageIds.includes(id)));
                                                                } else {
                                                                    const toScope = (it: any) => ({ start: it.startIndex, end: it.scopeEndIndex, label: it.title });
                                                                    const newScopes = itemsToSync.map(toScope);
                                                                    setSelectedScopes(prev => { const existingStarts = new Set(newScopes.map(s => s.start)); const cleanPrev = prev.filter(s => !existingStarts.has(s.start)); return [...cleanPrev, ...newScopes]; });
                                                                    setSelectedImageIds(prev => Array.from(new Set([...prev, ...allImageIds])));

                                                                    // Scroll to the first image of this chapter in summary
                                                                    const firstImageId = item.images[0]?.id;
                                                                    if (firstImageId) {
                                                                        scrollToElement(`summary-img-${firstImageId}`, 'summary-list', { type: 'heading', id: item.id, fallbackId: `summary-heading-${item.id}` });
                                                                    } else {
                                                                        scrollToElement(`summary-heading-${item.id}`, 'summary-list');
                                                                    }
                                                                }
                                                            }} className={`w-4 h-4 mr-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>{isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}</div>
                                                            <div className="flex items-center flex-1" style={{ paddingLeft: `${(item.level - 1) * 20}px` }}>
                                                                <span className={`mr-2 text-xs font-mono ${item.level === 1 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>H{item.level}</span>
                                                                <span className={`${item.level === 1 ? 'font-bold' : 'font-medium'} flex-1`}>{item.title}</span>
                                                                {item.imageCount > 0 && <div className="ml-2 flex items-center text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold"><ImageIcon className="w-3 h-3 mr-1" />{item.imageCount}</div>}
                                                            </div>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"><MousePointerClick className="w-4 h-4 text-indigo-400" /></div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center min-h-[500px] text-gray-400">
                                <Search className="w-8 h-8 mr-4 opacity-20" />
                                <span>문서 URL을 입력하고 챕터를 불러오세요.</span>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
