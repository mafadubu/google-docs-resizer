"use client";

import { SuccessModal } from "@/components/success-modal";
import { AnimatePresence, motion } from "framer-motion";
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

export function Dashboard() {
    const { data: session } = useSession();
    const [docUrl, setDocUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [structure, setStructure] = useState<any>(null);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid');
    const [gridCols, setGridCols] = React.useState(3);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);
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

    // Quantum states (v7.0)
    const [targetWidth, setTargetWidth] = useState(10); // cm
    const [isProcessing, setIsProcessing] = useState(false);
    const [resizeProgress, setResizeProgress] = useState(0);
    const [resizeStats, setResizeStats] = useState({ success: 0, failed: 0, total: 0 });
    const [currentImageContext, setCurrentImageContext] = useState("");

    const imageToHeadingMap = React.useMemo(() => {
        if (!structure) return {} as Record<string, string>;
        const map: Record<string, string> = {};
        structure.items.forEach((item: any) => {
            item.images.forEach((img: any) => {
                map[img.id] = item.id;
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

    const scrollToElement = (id: string, containerId?: string) => {
        const el = document.getElementById(id);
        if (el) {
            if (containerId === 'summary-list') {
                const list = document.getElementById(containerId);
                if (list) {
                    const elRect = el.getBoundingClientRect();
                    const listRect = list.getBoundingClientRect();
                    list.scrollTo({ top: list.scrollTop + (elRect.top - listRect.top) - 8, behavior: 'smooth' });
                }
            } else {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

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
        if (structure && !confirm("모든 작업 내용을 초기화하시겠습니까?")) return;
        setIsLoaded(false);
        setIsInputFolded(false);
        setDocUrl("");
        setStructure(null);
        setSelectedImageIds([]);
        setSelectedScopes([]);
    };

    const syncDoc = async (silent = false) => {
        if (!structure?.id || isSyncing) return;
        if (!silent) setIsSyncing(true);
        try {
            const res = await fetch("/api/doc/structure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docId: structure.id }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setStructure({ ...data, id: structure.id });
            setLastSyncTime(new Date());
            if (!silent) {
                setSuccessMsg("동기화 완료!");
                setShowSuccess(true);
            }
        } catch (e: any) {
            console.error("Sync error:", e);
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchStructure = async () => {
        const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const docId = match ? match[1] : docUrl;
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
            setLastSyncTime(new Date());
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResize = async () => {
        if (!structure || isProcessing) return;
        if (selectedImageIds.length === 0) {
            setWarningMsg("이미지를 선택해주세요.");
            setShowWarning(true);
            return;
        }

        setIsProcessing(true);
        setResizeProgress(0);
        setResizeStats({ success: 0, failed: 0, total: selectedImageIds.length });

        let currentSuccess = 0;
        let currentFailed = 0;
        const mapping: Record<string, string> = {};

        // Sequential Atomic Queue (v7.0)
        for (let i = 0; i < selectedImageIds.length; i++) {
            const imageId = selectedImageIds[i];
            setCurrentImageContext(`이미지 ${i + 1} 처리 중...`);

            try {
                const res = await fetch("/api/doc/resize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        docId: structure.id,
                        targetWidthCm: targetWidth,
                        imageId: imageId,
                    }),
                });

                const result = await res.json();
                if (result.success) {
                    currentSuccess++;
                    mapping[imageId] = result.newId;
                } else {
                    currentFailed++;
                }
            } catch (e) {
                currentFailed++;
            }

            const progress = Math.round(((i + 1) / selectedImageIds.length) * 100);
            setResizeProgress(progress);
            setResizeStats({ success: currentSuccess, failed: currentFailed, total: selectedImageIds.length });

            // Critical: Small pause to allow Google Docs to sync its internal state
            await new Promise(r => setTimeout(r, 800));
        }

        // Final UI Update with new IDs
        setSelectedImageIds(prev => prev.map(id => mapping[id] || id));
        await syncDoc(true);

        setIsProcessing(false);
        setSuccessMsg(`${currentSuccess}개 처리 완료!`);
        setShowSuccess(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
            <AnimatePresence>
                {showGuide && <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />}
                {showWarning && <WarningModal isOpen={showWarning} onClose={() => setShowWarning(false)} message={warningMsg} />}
                {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}
            </AnimatePresence>

            {/* v7.0 Atomic Processing Overlay */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-[2rem] shadow-2xl p-10 max-w-md w-full text-center space-y-8 border border-white/20">
                            <div className="relative w-32 h-32 mx-auto">
                                <svg className="w-full h-full rotate-[-90deg]">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100" />
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * resizeProgress) / 100} className="text-indigo-600 transition-all duration-700" strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-indigo-600 leading-none">{resizeProgress}%</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Progress</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Quantum Atomic Sync</h3>
                                <p className="text-sm text-slate-500 font-medium">{currentImageContext}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Success</div>
                                    <div className="text-2xl font-black text-emerald-700">{resizeStats.success}</div>
                                </div>
                                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                                    <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Failed</div>
                                    <div className="text-2xl font-black text-rose-700">{resizeStats.failed}</div>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl py-3 px-4 flex items-center justify-center space-x-2">
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Syncing with Google Docs...</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-3 cursor-pointer group" onClick={handleReset}>
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold group-hover:rotate-12 transition-all relative shadow-lg shadow-indigo-100">
                        G
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.6)]" title="v7.0 Quantum Stable Active" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-xl tracking-tighter text-slate-900 leading-none">Docs Resizer ✨</span>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1 flex items-center">
                            v7.0 Quantum Atomic Sync
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={() => setShowGuide(true)} className="text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors flex items-center"><HelpCircle className="w-4 h-4 mr-2" />도움말</button>
                    <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-full">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                            {session?.user?.image && !imgError ? <img src={session.user.image} alt="User" className="w-full h-full object-cover" onError={() => setImgError(true)} /> : <User className="w-4 h-4 text-slate-400" />}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{session?.user?.name}</span>
                    </div>
                    <button onClick={() => signOut()} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="로그아웃"><LogOut className="w-5 h-5" /></button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-10">
                <div className="grid md:grid-cols-12 gap-10">
                    {/* Setup Panel */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-5' : 'md:col-span-4'} space-y-6 md:sticky md:top-28 max-h-[calc(100vh-140px)] overflow-y-auto hidden-scrollbar`}>
                        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100/50 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black flex items-center text-slate-900"><FileText className="w-5 h-5 mr-2 text-indigo-500" />문서 설정</h2>
                                {isLoaded && <button onClick={handleReset} className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors">초기화</button>}
                            </div>

                            {!isLoaded ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input type="text" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="구글 문서 URL을 입력하세요" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-400 focus:bg-white outline-none transition-all text-sm font-medium" />
                                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                    </div>
                                    <button onClick={fetchStructure} disabled={loading || !docUrl} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 transition-all flex items-center justify-center">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "문서 분석 시작"}</button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Document</span>
                                            <h3 className="font-bold text-slate-900 truncate text-sm">{structure.title}</h3>
                                        </div>
                                        <button onClick={() => syncDoc()} disabled={isSyncing} className={`p-2 rounded-xl transition-all ${isSyncing ? 'text-indigo-400 animate-spin' : 'text-slate-400 hover:text-indigo-600 hover:bg-white border-transparent'}`}><RefreshCw className="w-5 h-5" /></button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">규격 선택 (cm)</span>
                                            <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-lg">{targetWidth}</span>
                                        </div>
                                        <input type="range" min="5" max="20" step="0.5" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                    </div>

                                    <button onClick={handleResize} disabled={isProcessing || selectedImageIds.length === 0} className="w-full py-4 bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 transition-all flex items-center justify-center space-x-2">
                                        <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
                                        <span>{selectedImageIds.length}개 이미지 규격화</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Summary List */}
                        <AnimatePresence>
                            {isLoaded && selectedImageIds.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100/50 flex flex-col ${isSummaryExpanded ? 'min-h-[600px]' : 'max-h-[500px]'}`}>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-black text-slate-900 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />작업 큐</h3>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Maximize2 className="w-4 h-4" /></button>
                                            <button onClick={() => setSelectedImageIds([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Clear</button>
                                        </div>
                                    </div>
                                    <div id="summary-list" className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                        {structure.items.map((item: any) => {
                                            const chapterImgs = item.images.filter((img: any) => selectedImageIds.includes(img.id));
                                            if (chapterImgs.length === 0) return null;
                                            return (
                                                <div key={item.id} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-3">
                                                    <h4 className="text-[11px] font-black text-slate-400 truncate">{item.title}</h4>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {chapterImgs.map((img: any) => (
                                                            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                                                                <img src={img.uri} className="w-full h-full object-cover" />
                                                                <button onClick={() => setSelectedImageIds(prev => prev.filter(id => id !== img.id))} className="absolute inset-0 bg-rose-600/80 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black">X</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Content Panel */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-7' : 'md:col-span-8'} space-y-6`}>
                        {structure ? (
                            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100/50 overflow-hidden min-h-[700px] flex flex-col">
                                <div className="sticky top-[89px] z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 p-6">
                                    {!activeChapterId ? (
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{structure.title}</h2>
                                            <p className="text-sm text-slate-500 font-medium">문서 내 이미지를 분석하고 규격화할 항목을 선택해주세요.</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4 min-w-0 flex-1">
                                                <button onClick={handleBackToOutline} className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-2xl transition-all shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                                                <div className="min-w-0">
                                                    <h3 className="text-lg font-black text-slate-900 truncate leading-none">{structure.items.find((it: any) => it.id === activeChapterId)?.title}</h3>
                                                    <div className="mt-1 flex items-center space-x-2">
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CHAPTER SYNC ACTIVE</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <div className="bg-slate-100 p-1 rounded-xl flex">
                                                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Grid3X3 className="w-5 h-5" /></button>
                                                    <button onClick={() => setViewMode('carousel')} className={`p-2 rounded-lg transition-all ${viewMode === 'carousel' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Maximize2 className="w-5 h-5" /></button>
                                                </div>
                                                <button onClick={() => {
                                                    const current = structure.items.find((it: any) => it.id === activeChapterId);
                                                    const allIds = current.images.map((img: any) => img.id);
                                                    const allSelected = allIds.every((id: any) => selectedImageIds.includes(id));
                                                    if (allSelected) setSelectedImageIds(prev => prev.filter(id => !allIds.includes(id)));
                                                    else setSelectedImageIds(prev => Array.from(new Set([...prev, ...allIds])));
                                                }} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">전체 선택</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 flex-1">
                                    {activeChapterId ? (
                                        <div className="space-y-12">
                                            {(() => {
                                                const chapter = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!chapter || chapter.images.length === 0) return <div className="flex flex-col items-center justify-center py-32 text-slate-300"><ImageIcon className="w-20 h-20 mb-6 opacity-20" /><p className="font-bold">이 챕터에는 분석 가능한 이미지가 없습니다.</p></div>;

                                                if (viewMode === 'grid') {
                                                    return (
                                                        <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                                                            {chapter.images.map((img: any) => {
                                                                const isSelected = selectedImageIds.includes(img.id);
                                                                return (
                                                                    <div key={img.id} onClick={() => {
                                                                        if (isSelected) setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                        else setSelectedImageIds(prev => [...prev, img.id]);
                                                                    }} className={`group relative bg-white rounded-[2rem] overflow-hidden border-4 transition-all cursor-pointer shadow-xl active:scale-95 ${isSelected ? 'border-indigo-600 scale-[1.02]' : 'border-slate-50 hover:border-indigo-200'}`}>
                                                                        <div className="aspect-square p-6 flex items-center justify-center bg-slate-50/50">
                                                                            <img src={img.uri} className="max-h-full max-w-full rounded-xl shadow-2xl transition-transform group-hover:scale-110" />
                                                                        </div>
                                                                        <div className="p-4 bg-white border-t border-slate-50 flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type: {img.type}</span>
                                                                            {isSelected && <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg"><CheckCircle className="w-3 h-3 text-white" /></div>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                } else {
                                                    const mainImg = chapter.images[carouselIndex] || chapter.images[0];
                                                    return (
                                                        <div className="space-y-10">
                                                            <div className="relative aspect-[16/10] bg-slate-900 rounded-[3rem] p-12 flex items-center justify-center overflow-hidden shadow-2xl">
                                                                <div className="absolute inset-0 bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
                                                                <img src={mainImg.uri} className="max-h-full max-w-full relative z-10 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-white/10" />
                                                            </div>
                                                            <div className="flex space-x-4 overflow-x-auto pb-6 hidden-scrollbar">
                                                                {chapter.images.map((img: any, i: number) => (
                                                                    <button key={img.id} onClick={() => setCarouselIndex(i)} className={`relative shrink-0 w-24 h-24 rounded-2xl border-4 transition-all overflow-hidden ${carouselIndex === i ? 'border-indigo-600 scale-110 shadow-xl' : 'border-slate-100 scale-100 grayscale hover:grayscale-0'}`}>
                                                                        <img src={img.uri} className="w-full h-full object-cover" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            <div onClick={() => {
                                                const allIds = structure.items.flatMap((it: any) => it.images.map((img: any) => img.id));
                                                if (selectedImageIds.length === allIds.length) setSelectedImageIds([]);
                                                else setSelectedImageIds(allIds);
                                            }} className="group p-8 rounded-[2.5rem] border-4 border-dashed border-slate-100 hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between">
                                                <div className="flex items-center space-x-6">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${selectedImageIds.length === structure.items.flatMap((it: any) => it.images.map((img: any) => img.id)).length ? 'bg-indigo-600 shadow-lg' : 'bg-slate-200'}`}><CheckCircle className="w-6 h-6 text-white" /></div>
                                                    <div className="space-y-1">
                                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">전체 항목 분석 및 규격화</h3>
                                                        <p className="text-sm text-slate-400 font-medium">문서 내 모든 제목과 하위 내용을 순차적으로 교체합니다.</p>
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" />
                                            </div>

                                            <div className="mt-8 space-y-3">
                                                {structure.items.map((item: any) => (
                                                    <motion.div key={item.id} onClick={() => { setActiveChapterId(item.id); setCarouselIndex(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group p-5 rounded-3xl bg-white hover:bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-all cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md">
                                                        <div className="flex items-center min-w-0" style={{ paddingLeft: `${(item.level - 1) * 24}px` }}>
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mr-4 shrink-0 font-black text-[10px] ${item.level === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>H{item.level}</div>
                                                            <span className={`truncate font-bold text-slate-800 ${item.level === 1 ? 'text-lg' : 'text-sm'}`}>{item.title}</span>
                                                            {item.imageCount > 0 && <span className="ml-4 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black">{item.imageCount} IMAGES</span>}
                                                        </div>
                                                        <MousePointerClick className="w-5 h-5 text-slate-200 group-hover:text-indigo-400 transition-colors" />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[3rem] p-24 shadow-xl border border-slate-100/50 flex flex-col items-center justify-center text-center space-y-8 animate-pulse">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center"><Layout className="w-10 h-10 text-slate-200" /></div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl font-black text-slate-300 tracking-tight">Ready for analysis</h2>
                                    <p className="text-slate-400 max-w-xs mx-auto">상단에 구글 문서 URL을 붙여넣고<br />분석을 시작해 주세요.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
