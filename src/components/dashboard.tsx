"use client";

import { SuccessModal } from "@/components/success-modal";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect } from "react";
import {
    Loader2, FileText, Layout, RefreshCw, LogOut, CheckCircle,
    ShieldCheck, ChevronUp, User, ChevronLeft, ChevronRight, ImageIcon,
    Grid3X3, Maximize2, Columns, HelpCircle, ArrowRight
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

    // Ironclad Engine States
    const [targetWidth, setTargetWidth] = useState(10);
    const [isProcessing, setIsProcessing] = useState(false);
    const [resizeProgress, setResizeProgress] = useState(0);
    const [resizeStats, setResizeStats] = useState({ success: 0, failed: 0, total: 0 });

    useEffect(() => {
        if (isLoaded) setIsInputFolded(true);
    }, [isLoaded]);

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
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
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
                if (i + CHUNK_SIZE < selectedImageIds.length) await new Promise(r => setTimeout(r, 600));
            }

            setSelectedImageIds(prev => prev.map(id => mapping[id] || id));
            await syncDoc(true);
            setSuccessMsg(`${totalSuccess}개 조절 완료!`);
            setShowSuccess(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
            <AnimatePresence>
                {showGuide && <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />}
                {showWarning && <WarningModal isOpen={showWarning} onClose={() => setShowWarning(false)} message={warningMsg} />}
                {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}
            </AnimatePresence>

            {/* Ironclad Processing Overlay */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center space-y-6">
                            <div className="relative w-24 h-24 mx-auto">
                                <svg className="w-full h-full rotate-[-90deg]">
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * resizeProgress) / 100} className="text-indigo-600 transition-all duration-500" strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-indigo-600">{resizeProgress}%</div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">이미지 규격 최적화 중</h3>
                                <div className="flex justify-center items-center space-x-2 text-sm text-gray-500">
                                    <span className="text-emerald-600 font-bold">성공 {resizeStats.success}</span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span className="text-rose-600 font-bold">실패 {resizeStats.failed}</span>
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-center space-x-3">
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                </div>
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Ironclad Engine Active</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => window.location.reload()}>
                    <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold group-hover:scale-105 transition-all shadow-lg shadow-indigo-100 relative">
                        G
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg tracking-tight text-gray-900 leading-none">Docs Resizer ✨</span>
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1 flex items-center">
                            v8.0 IRONCLAD Engine
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={() => setShowGuide(true)} className="text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors flex items-center"><HelpCircle className="w-4 h-4 mr-1.5" />가이드</button>
                    <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full border border-gray-200">
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden border border-white">
                            {session?.user?.image ? <img src={session.user.image} className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <span className="text-xs font-bold text-gray-700">{session?.user?.name}</span>
                    </div>
                    <button onClick={() => signOut()} className="p-2 text-gray-400 hover:text-rose-500 rounded-lg transition-colors"><LogOut className="w-5 h-5" /></button>
                </div>
            </header>

            <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
                <div className="grid md:grid-cols-12 gap-8">
                    {/* Setup Panel (Left Side) */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-4'} space-y-4 md:sticky md:top-24 max-h-[calc(100vh-120px)] overflow-y-auto hidden-scrollbar`}>
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black flex items-center text-gray-800 uppercase tracking-wider"><FileText className="w-4 h-4 mr-2 text-indigo-500" />문서 설정</h2>
                                {isLoaded && <button onClick={() => setIsLoaded(false)} className="text-[10px] font-black text-gray-300 hover:text-rose-500 uppercase tracking-widest">초기화</button>}
                            </div>

                            {!isLoaded ? (
                                <div className="space-y-3">
                                    <input type="text" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="구글 문서 URL을 붙여넣으세요" className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:border-indigo-300 outline-none transition-all text-sm font-medium" />
                                    <button onClick={fetchStructure} disabled={loading || !docUrl} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all flex items-center justify-center">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "문서 불러오기"}</button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Target Document</span>
                                            <h3 className="font-bold text-gray-800 truncate text-sm leading-tight">{structure.title}</h3>
                                        </div>
                                        <button onClick={() => syncDoc()} disabled={isSyncing} className={`p-2 rounded-xl border border-gray-200 bg-white shadow-sm hover:text-indigo-600 transition-all ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs font-black text-gray-500 uppercase tracking-widest">
                                            <span>너비 설정 (cm)</span>
                                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-lg font-black">{targetWidth}</span>
                                        </div>
                                        <input type="range" min="5" max="20" step="0.5" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                    </div>

                                    <button onClick={handleResize} disabled={isProcessing || selectedImageIds.length === 0} className="w-full py-3.5 bg-gray-900 hover:bg-black disabled:bg-gray-100 text-white rounded-2xl font-bold text-sm shadow-xl transition-all flex items-center justify-center space-x-2">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>{selectedImageIds.length}개 이미지 일괄 규격화</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Summary List (Atomic Chapter List) */}
                        {isLoaded && selectedImageIds.length > 0 && (
                            <div className={`bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col ${isSummaryExpanded ? 'min-h-[600px]' : 'max-h-[500px]'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">작업 리스트 ({selectedImageIds.length})</h3>
                                    <div className="flex space-x-2">
                                        <button onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-400"><Maximize2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setSelectedImageIds([])} className="p-1.5 bg-gray-50 hover:bg-rose-50 rounded-lg text-gray-400 hover:text-rose-500 font-black text-[9px] uppercase tracking-tighter">Clear</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 hidden-scrollbar">
                                    {structure.items.map((ch: any) => {
                                        const chImgs = ch.images.filter((img: any) => selectedImageIds.includes(img.id));
                                        if (chImgs.length === 0) return null;
                                        return (
                                            <div key={ch.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-3">
                                                <h4 className="text-[10px] font-black text-gray-400 truncate">{ch.title}</h4>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {chImgs.map((img: any) => (
                                                        <div key={img.id} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white">
                                                            <img src={img.uri} className="w-full h-full object-cover" />
                                                            <button onClick={() => setSelectedImageIds(prev => prev.filter(id => id !== img.id))} className="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[8px]">제외</button>
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

                    {/* Content Area (Right Side) */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-8'}`}>
                        {structure ? (
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col min-h-[700px]">
                                <div className="sticky top-[86px] z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 p-6 flex flex-col space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <h2 className="text-xl font-black text-gray-900 tracking-tight truncate">{activeChapterId ? structure.items.find((it: any) => it.id === activeChapterId)?.title : structure.title}</h2>
                                            <p className="text-xs text-gray-500 mt-1 uppercase font-black tracking-widest">{activeChapterId ? "Chapter Navigation" : "Full Document Outline"}</p>
                                        </div>
                                        {activeChapterId && (
                                            <div className="flex items-center space-x-2">
                                                <div className="bg-gray-100 p-1 rounded-xl flex mr-2">
                                                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><Grid3X3 className="w-4 h-4" /></button>
                                                    <button onClick={() => setViewMode('carousel')} className={`p-2 rounded-lg transition-all ${viewMode === 'carousel' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><Maximize2 className="w-4 h-4" /></button>
                                                </div>
                                                <button onClick={handleBackToOutline} className="bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 transition-all border border-gray-200">목차로</button>
                                            </div>
                                        )}
                                    </div>
                                    {!activeChapterId && (
                                        <div className="flex space-x-2 overflow-x-auto pb-1 hidden-scrollbar">
                                            <button onClick={() => {
                                                const allIds = structure.items.flatMap((it: any) => it.images.map((img: any) => img.id));
                                                if (selectedImageIds.length === allIds.length) setSelectedImageIds([]);
                                                else setSelectedImageIds(allIds);
                                            }} className="whitespace-nowrap px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">전체 이미지 선택/해제</button>
                                            <div className="h-6 w-px bg-gray-200 shrink-0 self-center" />
                                            <button className="whitespace-nowrap px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest">{structure.items.length} 챕터 분석 완료</button>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8">
                                    {activeChapterId ? (
                                        <div className="space-y-8">
                                            {(() => {
                                                const ch = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!ch || ch.images.length === 0) return <div className="py-32 text-center text-gray-300 font-bold uppercase tracking-widest">이 챕터에 사용 가능한 이미지가 없습니다.</div>;

                                                if (viewMode === 'grid') {
                                                    return (
                                                        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                                                            {ch.images.map((img: any) => {
                                                                const isSel = selectedImageIds.includes(img.id);
                                                                return (
                                                                    <div key={img.id} onClick={() => {
                                                                        if (isSel) setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                        else setSelectedImageIds(prev => [...prev, img.id]);
                                                                    }} className={`group relative bg-gray-50/50 rounded-3xl p-5 border-2 transition-all cursor-pointer ${isSel ? 'border-indigo-600 bg-indigo-50/30 scale-[1.02]' : 'border-transparent hover:border-indigo-200'}`}>
                                                                        <div className="aspect-square flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                                            <img src={img.uri} className="max-h-[85%] max-w-[85%] object-contain transition-transform group-hover:scale-105" />
                                                                        </div>
                                                                        <div className="mt-4 flex items-center justify-between">
                                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">#{img.id.substring(0, 6)}</span>
                                                                            {isSel ? <CheckCircle className="w-5 h-5 text-indigo-600" /> : <div className="w-5 h-5 rounded-full border border-gray-200" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                } else {
                                                    const curImg = ch.images[carouselIndex] || ch.images[0];
                                                    return (
                                                        <div className="space-y-8">
                                                            <div className="aspect-[16/10] bg-gray-900 rounded-[2rem] flex items-center justify-center p-12 overflow-hidden shadow-2xl relative">
                                                                <img src={curImg.uri} className="max-h-full max-w-full rounded shadow-2xl border-4 border-white/5" />
                                                                <div className="absolute top-6 right-6 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white font-black text-[10px] uppercase">Image {carouselIndex + 1} / {ch.images.length}</div>
                                                            </div>
                                                            <div className="flex space-x-3 overflow-x-auto pb-4 hidden-scrollbar items-center">
                                                                {ch.images.map((img: any, i: number) => (
                                                                    <button key={img.id} onClick={() => setCarouselIndex(i)} className={`shrink-0 w-20 h-20 rounded-2xl border-2 transition-all p-2 bg-white ${carouselIndex === i ? 'border-indigo-600 scale-110 shadow-lg' : 'border-gray-100 grayscale hover:grayscale-0'}`}><img src={img.uri} className="w-full h-full object-contain rounded-lg" /></button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {structure.items.map((it: any) => (
                                                <div key={it.id} onClick={() => { setActiveChapterId(it.id); setCarouselIndex(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group px-6 py-5 rounded-3xl bg-gray-50/50 hover:bg-white border border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer flex items-center justify-between">
                                                    <div className="flex items-center min-w-0" style={{ paddingLeft: `${(it.level - 1) * 24}px` }}>
                                                        <span className="text-[10px] font-black text-indigo-400 w-8 shrink-0">H{it.level}</span>
                                                        <span className={`text-gray-800 truncate ${it.level === 1 ? 'font-black text-base' : 'font-bold text-sm'}`}>{it.title}</span>
                                                        {it.imageCount > 0 && <span className="ml-3 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-widest">{it.imageCount} imgs</span>}
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[3rem] p-32 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200"><Layout className="w-8 h-8" /></div>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight leading-none uppercase">Document Station</h3>
                                    <p className="text-sm text-gray-400 font-medium">관리할 구글 문서의 URL을 입력하여<br />분석 스테이션을 활성화하세요.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
