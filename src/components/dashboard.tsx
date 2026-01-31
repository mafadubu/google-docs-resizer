"use client";

import { SuccessModal } from "@/components/success-modal";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect } from "react";
import {
    Loader2, FileText, Layout, RefreshCw, LogOut, CheckCircle,
    User, Grid3X3, Maximize2, HelpCircle, ArrowRight, Zap, Target
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
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);
    const [carouselIndex, setCarouselIndex] = useState<number>(0);
    const [showGuide, setShowGuide] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [warningMsg, setWarningMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [highlightedChapterId, setHighlightedChapterId] = useState<string | null>(null);

    // ULTRA v10.0 States
    const [targetWidth, setTargetWidth] = useState(10);
    const [isProcessing, setIsProcessing] = useState(false);

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
            setWarningMsg("문서를 불러올 수 없습니다. 공유 설정을 확인해 주세요.");
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
                setSuccessMsg("데이터 최신화 완료!");
                setShowSuccess(true);
            }
        } catch (e) { console.error(e); }
        finally { setIsSyncing(false); }
    };

    const handleResize = async () => {
        if (!structure || isProcessing || selectedImageIds.length === 0) return;

        setIsProcessing(true);
        try {
            const res = await fetch("/api/doc/resize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    docId: structure.id,
                    targetWidthCm: targetWidth,
                    selectedImageIds: selectedImageIds,
                }),
            });

            const data = await res.json();
            if (data.success) {
                await syncDoc(true);
                setSuccessMsg(`${data.results.success}개 이미지 크기 조절 완료!`);
                setShowSuccess(true);
            } else {
                throw new Error(data.error || "작업 중 오류 발생");
            }
        } catch (e: any) {
            setWarningMsg(e.message);
            setShowWarning(true);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col font-sans selection:bg-indigo-100 italic-none">
            <AnimatePresence>
                {showGuide && <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />}
                {showWarning && <WarningModal isOpen={showWarning} onClose={() => setShowWarning(false)} message={warningMsg} />}
                {showSuccess && <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} message={successMsg} />}
            </AnimatePresence>

            {/* v10.0 ULTRA Overlay */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-10 shadow-2xl flex flex-col items-center space-y-6 max-w-sm w-full border border-white/20">
                            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center animate-pulse shadow-xl shadow-indigo-200">
                                <Zap className="text-white w-8 h-8 fill-current" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black tracking-tight text-slate-900 mb-2">ULTRA 초고속 조절 중</h3>
                                <p className="text-sm text-slate-400 font-medium">프록시 없이 직접 속성을 변경하고 있습니다.</p>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-1/2 bg-indigo-600 h-full rounded-full" />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="bg-white/70 backdrop-blur-md border-b border-slate-100 px-8 py-6 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-4 cursor-pointer" onClick={() => window.location.reload()}>
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-100">U</div>
                    <div className="flex flex-col">
                        <span className="font-black text-2xl tracking-tighter text-slate-900 leading-none">Resizer Ultra</span>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-1.5 flex items-center">
                            <Zap className="w-3 h-3 mr-1 fill-current" /> v10.0 Zero-Proxy Stable
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    <button onClick={() => setShowGuide(true)} className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Guide</button>
                    <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm font-black text-xs">{session?.user?.name?.[0]}</div>
                        <span className="text-sm font-black text-slate-700">{session?.user?.name}</span>
                    </div>
                    <button onClick={() => signOut()} className="p-2.5 text-slate-300 hover:text-rose-500 transition-all"><LogOut className="w-6 h-6" /></button>
                </div>
            </header>

            <main className="flex-1 max-w-[1440px] w-full mx-auto px-8 py-12">
                <div className="grid md:grid-cols-12 gap-12">
                    {/* Control Panel */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-4'} space-y-6 md:sticky md:top-36 max-h-[calc(100vh-180px)] overflow-y-auto hidden-scrollbar`}>
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-100 space-y-8">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center"><Target className="w-4 h-4 mr-2 text-indigo-500" />Setup Station</h2>
                                {isLoaded && <button onClick={() => window.location.reload()} className="text-[9px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition-colors">Reset</button>}
                            </div>

                            {!isLoaded ? (
                                <div className="space-y-4">
                                    <input type="text" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="분석할 구글 문서 주소를 입력하세요" className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:bg-white outline-none transition-all text-sm font-bold" />
                                    <button onClick={fetchStructure} disabled={loading || !docUrl} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white rounded-3xl font-black text-sm shadow-xl shadow-indigo-100 transition-all flex items-center justify-center">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "문서 아키텍처 분석"}</button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 flex items-center justify-between">
                                        <div className="min-w-0 flex-1 mr-4">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Doc Title</span>
                                            <h3 className="font-black text-slate-900 truncate text-base leading-tight">{structure.title}</h3>
                                        </div>
                                        <button onClick={() => syncDoc()} disabled={isSyncing} className={`p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:text-indigo-600 transition-all ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw className="w-5 h-5" /></button>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">목표 너비 (cm)</span>
                                            <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-base font-black shadow-lg shadow-indigo-100">{targetWidth}</span>
                                        </div>
                                        <input type="range" min="5" max="20" step="0.5" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                                    </div>

                                    <button onClick={handleResize} disabled={isProcessing || selectedImageIds.length === 0} className="w-full py-5 bg-slate-900 hover:bg-black disabled:bg-slate-100 text-white rounded-3xl font-black text-sm shadow-2xl transition-all flex items-center justify-center space-x-3">
                                        <Zap className="w-5 h-5 fill-current" />
                                        <span>{selectedImageIds.length}개 이미지 초정밀 조절</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Selection Queue */}
                        {isLoaded && selectedImageIds.length > 0 && (
                            <div className={`bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col ${isSummaryExpanded ? 'min-h-[500px]' : 'max-h-[400px]'}`}>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Selection Queue</h3>
                                    <div className="flex space-x-3">
                                        <button onClick={() => setSelectedImageIds([])} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-500 font-black text-[10px] uppercase tracking-widest transition-colors">Reset</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-1 hidden-scrollbar">
                                    {structure.items.map((ch: any) => {
                                        const chImgs = ch.images.filter((img: any) => selectedImageIds.includes(img.id));
                                        if (chImgs.length === 0) return null;
                                        return (
                                            <div key={ch.id} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-400 truncate">{ch.title}</h4>
                                                <div className="grid grid-cols-4 gap-3">
                                                    {chImgs.map((img: any) => (
                                                        <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden border border-white shadow-sm bg-white">
                                                            <img src={img.uri} className="w-full h-full object-cover" />
                                                            <button onClick={() => setSelectedImageIds(prev => prev.filter(id => id !== img.id))} className="absolute inset-0 bg-rose-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-black text-[9px]">OUT</button>
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

                    {/* View Panel */}
                    <div className={`transition-all duration-500 ${isSummaryExpanded ? 'md:col-span-6' : 'md:col-span-8'}`}>
                        {structure ? (
                            <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col min-h-[700px] overflow-hidden">
                                <div className="sticky top-[99px] z-30 bg-white/80 backdrop-blur-xl border-b border-slate-50 p-8 flex flex-col space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight truncate">{activeChapterId ? structure.items.find((it: any) => it.id === activeChapterId)?.title : "Master Architecture"}</h2>
                                            <p className="text-[10px] text-indigo-600 mt-2 uppercase font-black tracking-[0.3em]">{activeChapterId ? "Focused Chapter Access" : "Full Document Outline"}</p>
                                        </div>
                                        {activeChapterId && (
                                            <div className="flex items-center space-x-4">
                                                <div className="bg-slate-100 p-1.5 rounded-2xl flex">
                                                    <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400'}`}><Grid3X3 className="w-5 h-5" /></button>
                                                    <button onClick={() => setViewMode('carousel')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'carousel' ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400'}`}><Maximize2 className="w-5 h-5" /></button>
                                                </div>
                                                <button onClick={handleBackToOutline} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200">Outline</button>
                                            </div>
                                        )}
                                    </div>
                                    {!activeChapterId && (
                                        <div className="flex items-center space-x-3 overflow-x-auto pb-2 hidden-scrollbar">
                                            <button onClick={() => {
                                                const allIds = structure.items.flatMap((it: any) => it.images.map((img: any) => img.id));
                                                if (selectedImageIds.length === allIds.length) setSelectedImageIds([]);
                                                else setSelectedImageIds(allIds);
                                            }} className="whitespace-nowrap px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">Select All Assets</button>
                                            <div className="h-6 w-px bg-slate-100 mx-2" />
                                            <div className="px-5 py-3 bg-slate-50 rounded-2xl text-[10px] font-black text-slate-300 uppercase tracking-widest">{structure.items.length} Chapters Detected</div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-10">
                                    {activeChapterId ? (
                                        <div className="space-y-10">
                                            {(() => {
                                                const ch = structure.items.find((it: any) => it.id === activeChapterId);
                                                if (!ch || ch.images.length === 0) return <div className="py-48 text-center text-slate-200 font-black text-4xl uppercase tracking-[0.2em]">No Assets Found</div>;

                                                if (viewMode === 'grid') {
                                                    return (
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                                                            {ch.images.map((img: any) => {
                                                                const isSel = selectedImageIds.includes(img.id);
                                                                return (
                                                                    <div key={img.id} onClick={() => {
                                                                        if (isSel) setSelectedImageIds(prev => prev.filter(id => id !== img.id));
                                                                        else setSelectedImageIds(prev => [...prev, img.id]);
                                                                    }} className={`group relative bg-slate-50/50 rounded-[2.5rem] p-6 border-4 transition-all cursor-pointer ${isSel ? 'border-indigo-600 bg-indigo-50/50 scale-[1.03] shadow-2xl shadow-indigo-100' : 'border-transparent hover:border-slate-100 hover:bg-white'}`}>
                                                                        <div className="aspect-square flex items-center justify-center bg-white rounded-[2rem] shadow-xl border border-slate-50 overflow-hidden p-6 relative">
                                                                            <img src={img.uri} className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105 duration-500" />
                                                                            {isSel && <div className="absolute top-4 right-4 bg-indigo-600 text-white p-2 rounded-xl shadow-lg"><CheckCircle className="w-4 h-4" /></div>}
                                                                        </div>
                                                                        <div className="mt-5 px-2 flex flex-col">
                                                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Asset ID: {img.id.substring(0, 8)}</span>
                                                                            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{img.type} Object</span>
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
                                                            <div className="aspect-[16/10] bg-slate-900 rounded-[3.5rem] flex items-center justify-center p-16 overflow-hidden shadow-2xl relative">
                                                                <img src={curImg.uri} className="max-h-full max-w-full relative z-10 rounded-2xl shadow-inner border border-white/5 object-contain" />
                                                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 text-white font-black text-[12px] uppercase z-20 shadow-2xl tracking-widest">Focused Asset {carouselIndex + 1} / {ch.images.length}</div>
                                                            </div>
                                                            <div className="flex space-x-4 overflow-x-auto pb-6 hidden-scrollbar items-center px-2">
                                                                {ch.images.map((img: any, i: number) => (
                                                                    <button key={img.id} onClick={() => setCarouselIndex(i)} className={`shrink-0 w-24 h-24 rounded-3xl border-4 transition-all p-3 bg-white ${carouselIndex === i ? 'border-indigo-600 scale-110 shadow-xl' : 'border-slate-50 grayscale'}`}><img src={img.uri} className="w-full h-full object-contain rounded-xl" /></button>
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
                                                        backgroundColor: highlightedChapterId === it.id ? "#EEF2FF" : "rgba(248, 250, 252, 0.5)",
                                                        borderColor: highlightedChapterId === it.id ? "#818cf8" : "#f1f5f9",
                                                        scale: highlightedChapterId === it.id ? 1.02 : 1
                                                    }}
                                                    onClick={() => { setActiveChapterId(it.id); setCarouselIndex(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    className="group px-8 py-7 rounded-[2rem] border-2 hover:bg-white hover:border-indigo-100 transition-all cursor-pointer flex items-center justify-between"
                                                >
                                                    <div className="flex items-center min-w-0" style={{ paddingLeft: `${(it.level - 1) * 32}px` }}>
                                                        <span className="text-[11px] font-black text-indigo-400 w-12 shrink-0">H{it.level}</span>
                                                        <span className={`text-slate-800 truncate tracking-tight ${it.level === 1 ? 'font-black text-xl' : 'font-bold text-base'}`}>{it.title}</span>
                                                        {it.imageCount > 0 && <span className="ml-5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest">{it.imageCount} imgs</span>}
                                                    </div>
                                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all"><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[4rem] p-48 shadow-xl shadow-slate-200/40 border border-slate-50 flex flex-col items-center justify-center text-center space-y-10">
                                <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-100 shadow-inner group transition-all duration-700"><Layout className="w-16 h-16 group-hover:rotate-12" /></div>
                                <div className="space-y-4">
                                    <h3 className="text-3xl font-black text-slate-300 tracking-tighter uppercase">Ultra Station</h3>
                                    <p className="text-base text-slate-400 font-bold max-w-sm mx-auto">구글 문서의 자산(Asset) 정보를 분석하고<br />초고속 크기 조절을 시작합니다.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
