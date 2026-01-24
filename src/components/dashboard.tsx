"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Loader2, Search, FileText, Layout, RefreshCw, LogOut, CheckCircle, ShieldCheck } from "lucide-react";
import { GuideModal } from "@/components/guide-modal";
import { AnimatePresence, motion } from "framer-motion";

export function Dashboard() {
    const { data: session } = useSession();
    const [docUrl, setDocUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [structure, setStructure] = useState<any>(null);
    const [selectedScopes, setSelectedScopes] = useState<Array<{ start: number; end: number; label: string }>>([]); // Empty = ALL
    const [showGuide, setShowGuide] = useState(false);

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

    const fetchStructure = async () => {
        // Extract ID from URL
        let docId = docUrl;
        const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) docId = match[1];

        if (!docId) {
            alert("Please enter a valid Google Doc URL or ID");
            return;
        }

        setLoading(true);
        setStructure(null);
        try {
            const res = await fetch("/api/doc/structure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setStructure({ ...data, id: docId }); // Keep ID in structure for later use
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResize = async () => {
        if (!structure?.id) return;

        setResizeStatus("processing");
        try {
            const payload: any = {
                docId: structure.id,
                targetWidthCm: targetWidth,
                scopes: selectedScopes.length > 0 ? selectedScopes : undefined
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
        } catch (e: any) {
            setResizeStatus("error");
            setResultMsg(e.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
            <AnimatePresence>
                {showGuide && <GuideModal isOpen={showGuide} onClose={closeGuide} />}
            </AnimatePresence>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                {/* ... (existing header content) */}
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                        G
                    </div>
                    <span className="font-bold text-lg tracking-tight">Docs Resizer ✨</span>
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
                        <img
                            src={session?.user?.image || ""}
                            alt="User"
                            className="w-6 h-6 rounded-full"
                        />
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

                {/* Left Col: Setup */}
                <div className="md:col-span-4 space-y-6">

                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <FileText className="w-16 h-16" />
                        </div>
                        <h3 className="font-bold mb-2 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                            사용 전 확인해 주세요!
                        </h3>
                        <ul className="space-y-2 pl-1 z-10 relative">
                            <li className="flex items-start">
                                <span className="mr-2 text-blue-400">•</span>
                                <span>문서에 대한 <strong className="font-semibold">편집 권한</strong>이 꼭 필요합니다.</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2 text-blue-400">•</span>
                                <span><strong className="font-semibold">직접 업로드</strong>하거나 붙여넣은 이미지만 지원됩니다. (그리기/도형 제외)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2 text-blue-400">•</span>
                                <span>챕터별 기능을 쓰려면 <strong className="font-semibold">제목(Heading 1~6)</strong> 스타일을 사용해 주세요.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Privacy Alert */}
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900 shadow-sm flex items-start space-x-3">
                        <div className="p-1 bg-green-100 rounded-full">
                            <ShieldCheck className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-green-800 mb-1">안심하세요!</h4>
                            <p className="text-green-700 leading-relaxed text-xs">
                                사용자가 업로드한 문서는 <span className="font-bold border-b border-green-500/50">저장되거나 공유되지 않으며</span>, 모든 처리는 구글 서버 내에서 안전하게 이루어집니다.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-4 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                            1. 문서 선택
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">문서 URL / ID</label>
                                <div className="mt-2 relative">
                                    <input
                                        type="text"
                                        value={docUrl}
                                        onChange={(e) => setDocUrl(e.target.value)}
                                        placeholder="https://docs.google.com/document/d/..."
                                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
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
                                            className="flex-1 accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
                                        {selectedScopes.length === 0
                                            ? "문서 전체 (Whole Document)"
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

                                    {resultMsg && (
                                        <div className={`mt-4 p-3 rounded-lg text-sm flex items-center ${resizeStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {resizeStatus === 'success' && <CheckCircle className="w-4 h-4 mr-2" />}
                                            {resultMsg}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Col: Outline */}
                <div className="md:col-span-8">
                    {structure ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full min-h-[500px] flex flex-col">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="text-lg font-bold text-gray-900">{structure.title}</h2>
                                <p className="text-sm text-gray-500">아래 챕터를 클릭하면, 해당 챕터만 선택해서 조절할 수 있습니다.</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div
                                    onClick={() => setSelectedScopes([])}
                                    className={`p-3 rounded-xl cursor-pointer transition-colors mb-2 flex items-center ${selectedScopes.length === 0 ? 'bg-indigo-50 border-indigo-200 border text-indigo-900' : 'hover:bg-gray-50 border border-transparent'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 text-gray-500 font-bold text-xs">ALL</div>
                                    <span className="font-semibold">문서 전체 (Whole Document)</span>
                                </div>

                                {structure.items.map((item: any, idx: number) => {
                                    const isSelected = selectedScopes.some(s => s.start === item.startIndex);

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedScopes(prev => prev.filter(s => s.start !== item.startIndex));
                                                } else {
                                                    setSelectedScopes(prev => [...prev, {
                                                        start: item.startIndex,
                                                        end: item.scopeEndIndex,
                                                        label: item.title
                                                    }]);
                                                }
                                            }}
                                            className={`
                                            group p-3 rounded-xl cursor-pointer transition-all mb-1 select-none
                                            ${isSelected
                                                    ? 'bg-indigo-50 border-indigo-200 border text-indigo-900'
                                                    : 'hover:bg-gray-50 border border-transparent text-gray-700'
                                                }
                                        `}
                                            style={{ marginLeft: `${(item.level - 1) * 20}px` }}
                                        >
                                            <div className="flex items-center">
                                                {/* Checkbox indicator */}
                                                <div className={`w-4 h-4 mr-3 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                                                </div>

                                                <span className={`mr-2 text-xs font-mono ${item.level === 1 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                                                    H{item.level}
                                                </span>
                                                <span className={item.level === 1 ? 'font-bold' : 'font-medium'}>
                                                    {item.title}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {structure.items.length === 0 && (
                                    <div className="p-8 text-center text-gray-400">
                                        제목(Heading)을 찾을 수 없습니다. 문서 전체 모드로 사용하세요.
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

            </main>
        </div>
    );
}
