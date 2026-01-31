"use client";

import { SuccessModal } from "@/components/success-modal";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect } from "react";
import {
    Loader2, FileText, Layout, RefreshCw, LogOut, CheckCircle,
    User, ChevronLeft, ImageIcon, Grid3X3, Maximize2, HelpCircle, ArrowRight
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
    const [showGuide, setShowGuide] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [warningMsg, setWarningMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInputFolded, setIsInputFolded] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [highlightedChapterId, setHighlightedChapterId] = useState<string | null>(null);

    // BLUEPRINT v9.0 States
    const [targetWidth, setTargetWidth] = useState(10);
    const [isProcessing, setIsProcessing] = useState(false);
    const [resizeProgress, setResizeProgress] = useState(0);
    const [resizeStats, setResizeStats] = useState({ success: 0, failed: 0, total: 0 });

    useEffect(() => {
        if (isLoaded) setIsInputFolded(true);
    }, [isLoaded]);

    const handleBackToOutline = () => {
        const currentId = activeChapterId;
        setActiveChapterId(null);
        if (currentId) {
            setHighlightedChapterId(currentId);
            setTimeout(() => setHighlightedChapterId(null), 3000);
            setTimeout(() => {
                document.getElementById(`chapter-${currentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
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
            setWarningMsg(e.message);
            setShowWarning(true);
        } finally {
            setLoading(false);
        }
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
            setStructure({ ...data, id: structure.id });
            setLastSyncTime(new Date());
            if (!silent) {
                setSuccessMsg("동기화 완료!");
                setShowSuccess(true);
            }
        } catch (e) { console.error(e); }
        finally { setIsSyncing(false); }
    };

    const handleResize = async () => {
        if (!structure || isProcessing || selectedImageIds.length === 0) return;

        setIsProcessing(true);
        setResizeProgress(0);
        setResizeStats({ success: 0, failed: 0, total: selectedImageIds.length });

        const CHUNK_SIZE = 10;
        let totalSuccess = 0;
        let totalFailed = 0;
        const mapping: Record<string, string> = {};

        try {
            for (let i = 0; i < selectedImageIds.length; i += CHUNK_SIZE) {
                const chunk = selectedImageIds.slice(i, i + CHUNK_SIZE);
                const res = await fetch("/api/doc/resize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        docId: structure.id,
                        targetWidthCm: targetWidth,
                        selectedImageIds: chunk,
                    }),
                });

                const data = await res.json();
                if (data.results) {
                    totalSuccess += data.results.success;
                    totalFailed += data.results.failed;
                    if (data.newIdMapping) Object.assign(mapping, data.newIdMapping);
                } else {
                    totalFailed += chunk.length;
                }

                const progress = Math.min(Math.round(((i + chunk.length) / selectedImageIds.length) * 100), 100);
                setResizeProgress(progress);
                setResizeStats({ success: totalSuccess, failed: totalFailed, total: selectedImageIds.length });
                if (i + CHUNK_SIZE < selectedImageIds.length) await new Promise(r => setTimeout(r, 400));
            }

            setSelectedImageIds(prev => prev.map(id => mapping[id] || id));
            await syncDoc(true);
            setSuccessMsg(`${totalSuccess}개 작업 완료!`);
            setShowSuccess(true);
        } catch (e) { console.error(e); }
        finally { setIsProcessing(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-700">
            <AnimatePresence>
                {showGuide && <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />}
                {showWarning && <WarningModal isOpen={showWarning} onClose={() => setShowWarning(false)} message={warningMsg} />}
                {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}
            </AnimatePresence>

            {/* BLUEPRINT v9.0 Overlay */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full text-center space-y-8 border border-white/20">
                            <div className="relative w-32 h-32 mx-auto">
                                <svg className="w-full h-full rotate-[-90deg]">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * resizeProgress) / 100} className="text-indigo-600 transition-all duration-700" strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-indigo-600 tracking-tighter">{resizeProgress}%</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">BLUEPRINT 9.0</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">고속 데이터 중계 중</h3>
                                <div className="flex justify-center items-center space-x-6">
                                    <div className="text-center"><div className="text-[10px] font-black text-emerald-500 uppercase mb-1">Success</div><div className="text-2xl font-black text-emerald-600">{resizeStats.success}</div></div>
                                    <div className="w-px h-8 bg-slate-100" />
                                    <div className="text-center"><div className="text-[10px] font-black text-slate-300 uppercase mb-1">Failed</div><div className="text-2xl font-black text-slate-400">{resizeStats.failed}</div></div>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-2xl py-4 flex items-center justify-center space-x-3 border border-slate-100">
                                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>
                                <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] animate-pulse">Edge Proxy Active</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => window.location.reload()}>
                    <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl group-hover:rotate-6 transition-all shadow-xl shadow-slate-200 relative overflow-hidden">
                        G
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent" />
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full border-4 border-white animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-2xl tracking-tighter text-slate-900">Docs Resizer</span>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.25em] mt-1">v9.0 BLUEPRINT Engine</span>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    <button onClick={() => setShowGuide(true)} className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center"><HelpCircle className="w-4 h-4 mr-2" />엔진 가이드</button>
                    <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                            {session?.user?.image ? <img src={session.user.image} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <span className="text-sm font-black text-slate-700">{session?.user?.name}</span>
                    </div>
                    <button onClick={() => signOut()} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><LogOut className="w-6 h-6" /></button>
                </div>
            </header>

            <main className="flex-1 max-w-[1500px] w-full mx-auto px-8 py-10">
                <div className="grid md:grid-cols-12 gap-10">
                    {/* Setup Panel */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-4'} space-y-6 md:sticky md:top-32 max-h-[calc(100vh-160px)] overflow-y-auto hidden-scrollbar`}>
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 space-y-8">
                            <h2 className="text-xs font-black flex items-center text-slate-400 uppercase tracking-[0.3em]"><FileText className="w-4 h-4 mr-3 text-indigo-500" />Blueprint Control</h2>

                            {!isLoaded ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input type="text" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="분석할 구글 문서 URL" className="w-full px-6 py-5 rounded-[1.5rem] bg-slate-50 border border-slate-100 focus:border-indigo-400 focus:bg-white outline-none transition-all text-sm font-bold placeholder:text-slate-300" />
                                    </div>
                                    <button onClick={fetchStructure} disabled={loading || !docUrl} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-100 transition-all flex items-center justify-center">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "문서 아키텍처 분석"}</button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="bg-slate-50 rounded-[1.5rem] p-5 border border-slate-100 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Architecture</span>
                                            <h3 className="font-black text-slate-900 truncate text-base leading-tight">{structure.title}</h3>
                                        </div>
                                        <button onClick={() => syncDoc()} disabled={isSyncing} className={`p-3 rounded-2xl border border-white bg-white shadow-xl hover:text-indigo-600 transition-all ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw className="w-5 h-5" /></button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            <span>Image Width (cm)</span>
                                            <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-base font-black">{targetWidth}</span>
                                        </div>
                                        <input type="range" min="5" max="20" step="0.5" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                                    </div>

                                    <button onClick={handleResize} disabled={isProcessing || selectedImageIds.length === 0} className="group w-full py-5 bg-slate-900 hover:bg-black disabled:bg-slate-100 text-white rounded-[1.5rem] font-black text-sm shadow-2xl transition-all flex items-center justify-center space-x-3">
                                        <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
                                        <span>{selectedImageIds.length}개 에셋 중계 시작</span>
                                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 작업 리스트 카드 (요청하신 그 스타일) */}
                        {isLoaded && selectedImageIds.length > 0 && (
                            <div className={`bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col ${isSummaryExpanded ? 'min-h-[600px]' : 'max-h-[500px]'}`}>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Job Queue</h3>
                                    <div className="flex space-x-3">
                                        <button onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className="p-2 bg-slate-50 hover:bg-indigo-50 rounded-xl text-slate-300 hover:text-indigo-600 transition-colors"><Maximize2 className="w-4 h-4" /></button>
                                        <button onClick={() => setSelectedImageIds([])} className="px-3 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-500 font-black text-[10px] uppercase tracking-widest transition-colors">Clear</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                    {structure.items.map((ch: any) => {
                                        const chImgs = ch.images.filter((img: any) => selectedImageIds.includes(img.id));
                                        if (chImgs.length === 0) return null;
                                        return (
                                            <div key={ch.id} className="bg-slate-50 rounded-[1.5rem] p-5 border border-slate-100 space-y-4">
                                                <h4 className="text-[11px] font-black text-slate-400 truncate tracking-tight">{ch.title}</h4>
                                                <div className="grid grid-cols-5 gap-3">
                                                    {chImgs.map((img: any) => (
                                                        <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
                                                            <img src={img.uri} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                            <button onClick={() => setSelectedImageIds(prev => prev.filter(id => id !== img.id))} className="absolute inset-0 bg-rose-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-black text-[10px]">FIX</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Content Panel */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-8'}`}>
                        {structure ? (
                            <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col min-h-[800px] overflow-hidden">
                                <div className="sticky top-[86px] z-30 bg-white/90 backdrop-blur-xl border-b border-slate-50 p-8 flex flex-col space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter truncate">{activeChapterId ? structure.items.find((it: any) => it.id === activeChapterId)?.title : "Architecture Blueprint"}</h2>
                                            <p className="text-[11px] text-indigo-500 mt-2 uppercase font-black tracking-[0.3em]">{activeChapterId ? "Focused Chapter Access" : "Full Entity Navigation"}</p>
                                        </div>
                                        {activeChapterId && (
                                            <div className="flex items-center space-x-4">
                                                <div className="bg-slate-100 p-1.5 rounded-2xl flex">
                                                    <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Grid3X3 className="w-5 h-5" /></button>
                                                    <button onClick={() => setViewMode('carousel')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'carousel' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Maximize2 className="w-5 h-5" /></button>
                                                </div>
                                                <button onClick={handleBackToOutline} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200">목차로 가기</button>
                                            </div>
                                        )}
                                    </div>
                                    {!activeChapterId && (
                                        <div className="flex items-center space-x-3 overflow-x-auto pb-2 hidden-scrollbar">
                                            <button onClick={() => {
                                                const allIds = structure.items.flatMap((it: any) => it.images.map((img: any) => img.id));
                                                if (selectedImageIds.length === allIds.length) setSelectedImageIds([]);
                                                else setSelectedImageIds(allIds);
                                            }} className="whitespace-nowrap px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:scale-105 transition-all">전체 엔티티 선택</button>
                                            <div className="h-8 w-px bg-slate-100 mx-2" />
                                            <div className="flex items-center px-5 py-3 bg-slate-50 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">{structure.items.length} 챕터 탐지됨</div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-10">
                                    {activeChapterId ? (
                                        <div className="space-y-12">
                                            {(() => {
                                                const ch = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!ch || ch.images.length === 0) return <div className="py-48 text-center text-slate-200 font-black text-4xl uppercase tracking-[0.1em] opacity-40">Empty Section</div>;

                                                if (viewMode === 'grid') {
                                                    return (
                                                        <div className="grid gap-10" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                                                            {ch.images.map((img: any) => {
                                                                const isSel = selectedImageIds.includes(img.id);
                                                                return (
                                                                    <div key={img.id} onClick={() => {
                                                                        if (isSel) setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                        else setSelectedImageIds(prev => [...prev, img.id]);
                                                                    }} className={`group relative bg-slate-50/50 rounded-[2.5rem] p-8 border-4 transition-all cursor-pointer ${isSel ? 'border-indigo-600 bg-indigo-50/50 scale-[1.03] shadow-2xl shadow-indigo-100' : 'border-transparent hover:border-slate-200'}`}>
                                                                        <div className="aspect-square flex items-center justify-center bg-white rounded-[2rem] shadow-xl border border-slate-50 overflow-hidden p-6">
                                                                            <img src={img.uri} className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110 duration-500" />
                                                                        </div>
                                                                        <div className="mt-6 flex items-center justify-between px-2">
                                                                            <div className="flex flex-col"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ID: {img.id.substring(0, 8)}</span><span className="text-[9px] font-bold text-slate-400 mt-1">{img.type} object</span></div>
                                                                            {isSel ? <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><CheckCircle className="w-5 h-5 text-white" /></div> : <div className="w-10 h-10 rounded-2xl border-2 border-slate-100 bg-white" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                } else {
                                                    const curImg = ch.images[carouselIndex] || ch.images[0];
                                                    return (
                                                        <div className="space-y-10">
                                                            <div className="aspect-[16/10] bg-slate-900 rounded-[3.5rem] flex items-center justify-center p-16 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.3)] relative">
                                                                <div className="absolute inset-0 bg-indigo-500/10 blur-[150px] animate-pulse rounded-full" />
                                                                <img src={curImg.uri} className="max-h-full max-w-full relative z-10 rounded-2xl shadow-2xl border-4 border-white/5 object-contain" />
                                                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 text-white font-black text-[12px] uppercase tracking-[0.2em] z-20 shadow-2xl">Asset Viewer - {carouselIndex + 1} / {ch.images.length}</div>
                                                            </div>
                                                            <div className="flex space-x-5 overflow-x-auto pb-6 hidden-scrollbar items-center px-4">
                                                                {ch.images.map((img: any, i: number) => (
                                                                    <button key={img.id} onClick={() => setCarouselIndex(i)} className={`shrink-0 w-28 h-28 rounded-3xl border-4 transition-all p-3 bg-white ${carouselIndex === i ? 'border-indigo-600 scale-110 shadow-2xl' : 'border-slate-50 grayscale hover:grayscale-0 hover:scale-105'}`}><img src={img.uri} className="w-full h-full object-contain rounded-xl" /></button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {structure.items.map((it: any) => (
                                                <motion.div
                                                    key={it.id}
                                                    id={`chapter-${it.id}`}
                                                    initial={false}
                                                    animate={{
                                                        backgroundColor: highlightedChapterId === it.id ? "rgba(238, 242, 255, 1)" : "rgba(249, 250, 251, 0.4)",
                                                        borderColor: highlightedChapterId === it.id ? "#818cf8" : "#f1f5f9",
                                                        scale: highlightedChapterId === it.id ? 1.02 : 1
                                                    }}
                                                    onClick={() => { setActiveChapterId(it.id); setCarouselIndex(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    className="group px-8 py-7 rounded-[2rem] border-2 hover:bg-white hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all cursor-pointer flex items-center justify-between"
                                                >
                                                    <div className="flex items-center min-w-0" style={{ paddingLeft: `${(it.level - 1) * 32}px` }}>
                                                        <span className="text-[11px] font-black text-indigo-400 w-12 shrink-0">H{it.level}</span>
                                                        <span className={`text-slate-800 truncate tracking-tight ${it.level === 1 ? 'font-black text-xl' : 'font-bold text-base'}`}>{it.title}</span>
                                                        {it.imageCount > 0 && <span className="ml-5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em]">{it.imageCount} ASSETS</span>}
                                                    </div>
                                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-indigo-100 transition-all"><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[4rem] p-48 shadow-2xl shadow-slate-200/50 border border-slate-50 flex flex-col items-center justify-center text-center space-y-10 group">
                                <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 ease-out shadow-inner"><Layout className="w-16 h-16" /></div>
                                <div className="space-y-6">
                                    <h3 className="text-3xl font-black text-slate-300 tracking-tighter leading-none uppercase">Analysis Station</h3>
                                    <p className="text-base text-slate-400 font-bold max-w-sm mx-auto leading-relaxed">구글 문서의 정보를 시각화하고<br />지능형 에셋 중계를 시작할 준비가 되었습니다.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
