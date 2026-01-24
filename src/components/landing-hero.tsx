"use client";

import { signIn } from "next-auth/react";
import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function LandingHero() {
    // Animation State: Messy (false) <-> Clean (true)
    const [isClean, setIsClean] = useState(false);
    const [stats, setStats] = useState({ total: 0, today: 0 }); // Start from 0 to show it's real

    useEffect(() => {
        // 1. Animation Loop
        const interval = setInterval(() => {
            setIsClean((prev) => !prev);
        }, 2000);

        // 2. Fetch Stats
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                if (data.total !== undefined) setStats(data);
            })
            .catch(err => console.error(err));

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white flex flex-col relative overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>

            {/* Main Content */}
            <div className="z-10 container mx-auto px-6 py-20 flex-1 flex flex-col justify-center">
                <div className="flex flex-col lg:flex-row items-center gap-20">

                    {/* Left: Text */}
                    <div className="flex-1 text-center lg:text-left space-y-8">
                        <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 mb-4">
                            <span className="flex h-2 w-2 rounded-full bg-green-400"></span>
                            <span className="text-sm font-medium text-gray-200">v1.0 Now Available</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
                            Perfect Image Sizing<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-300">
                                for Google Docs
                            </span>
                        </h1>

                        <p className="text-xl text-gray-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-light">
                            크기가 제각각인 이미지들 때문에 스트레스 받으시나요?<br />
                            클릭 한 번으로 문서 전체를 깔끔하게 맞춰드립니다.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-8 pt-6">
                            <button
                                onClick={() => signIn("google")}
                                className="group relative px-8 py-4 bg-white text-indigo-900 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center space-x-3"
                            >
                                <ImageIcon className="w-6 h-6" />
                                <span>Google 계정으로 시작하기</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>

                            {/* Stats Counter (Real) */}
                            <div className="flex items-center gap-6 text-left border-l border-white/20 pl-6 animate-in fade-in slide-in-from-right duration-1000">
                                <div>
                                    <div className="text-3xl font-bold font-mono">{stats.today.toLocaleString()}</div>
                                    <div className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">Today's Resizes</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold font-mono">{stats.total.toLocaleString()}</div>
                                    <div className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">Total Resizes</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Dynamic Animation (Messy -> Clean) */}
                    <div className="flex-1 w-full max-w-lg perspective-1000">
                        <div className="relative group">
                            <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 transition-opacity duration-1000 ${isClean ? 'opacity-60' : 'opacity-30'}`}></div>

                            <div className="relative bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden min-h-[400px] flex flex-col">
                                <div className="flex space-x-2 mb-8">
                                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                                    <div className="ml-auto flex items-center space-x-2">
                                        <span className={`text-xs font-mono transition-colors duration-500 ${isClean ? 'text-green-400' : 'text-red-400'}`}>
                                            {isClean ? 'Status: CLEAN ✨' : 'Status: MESSY ⚠️'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-6 flex-1 relative">
                                    <div className="h-2 bg-white/20 rounded w-3/4"></div>
                                    <div className="h-2 bg-white/20 rounded w-1/2"></div>

                                    {/* Visualizing Main Doc Images */}
                                    <div className="flex justify-center transition-all duration-1000 ease-in-out"
                                        style={{ transform: isClean ? 'scale(1)' : 'scale(1.1) rotate(-2deg)' }}>
                                        <div className={`rounded-lg transition-all duration-1000 ease-in-out flex items-center justify-center border ${isClean ? 'w-full h-32 bg-indigo-500/20 border-indigo-400/50' : 'w-[120%] h-40 bg-red-500/20 border-red-400/50'}`}>
                                        </div>
                                    </div>

                                    <div className="h-2 bg-white/20 rounded w-full"></div>
                                    <div className="h-2 bg-white/20 rounded w-5/6"></div>

                                    <div className="flex justify-center transition-all duration-1000 ease-in-out"
                                        style={{ transform: isClean ? 'scale(1)' : 'scale(0.9) rotate(3deg)' }}>
                                        <div className={`rounded-lg transition-all duration-1000 ease-in-out flex items-center justify-center border ${isClean ? 'w-full h-32 bg-indigo-500/20 border-indigo-400/50' : 'w-1/2 h-20 bg-red-500/20 border-red-400/50'}`}>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Animated Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-24 opacity-90">

                    {/* Feature 1: Instant Batch Resize */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                        <div className="h-24 mb-4 bg-gray-900/50 rounded-lg border border-white/5 flex items-center justify-center gap-2 px-4 overflow-hidden">
                            {/* Animation: 3 bars syncing height/color */}
                            {[1, 2, 3].map((i) => (
                                <div key={i}
                                    className={`w-8 rounded-sm transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]
                      ${isClean ? 'bg-indigo-400 h-10' : `bg-red-400 ${i === 1 ? 'h-14' : i === 2 ? 'h-6' : 'h-12'}`}
                    `}
                                ></div>
                            ))}
                        </div>
                        <h3 className="text-lg font-bold mb-2 text-gray-100">빠른 일괄 처리</h3>
                        <p className="text-gray-400 text-sm">100장이 넘는 이미지도 클릭 한 번으로 똑같은 크기로 맞춰집니다.</p>
                    </div>

                    {/* Feature 2: Chapter Scope */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                        <div className="h-24 mb-4 bg-gray-900/50 rounded-lg border border-white/5 flex flex-col justify-center px-6 space-y-2">
                            {/* Animation: Selecting a chapter */}
                            <div className={`h-2 rounded w-full transition-colors duration-1000 ${isClean ? 'bg-gray-700' : 'bg-gray-600'}`}></div>
                            <div className={`h-2 rounded w-2/3 transition-colors duration-1000 ${isClean ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-gray-600'}`}></div>
                            <div className={`h-2 rounded w-full transition-colors duration-1000 ${isClean ? 'bg-gray-700' : 'bg-gray-600'}`}></div>
                        </div>
                        <h3 className="text-lg font-bold mb-2 text-gray-100">챕터별 선택 가능</h3>
                        <p className="text-gray-400 text-sm">문서 전체를 다 바꿀 필요 없어요. 원하는 챕터만 쏙 골라서 적용하세요.</p>
                    </div>

                    {/* Feature 3: Aspect Ratio */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                        <div className="h-24 mb-4 bg-gray-900/50 rounded-lg border border-white/5 flex items-center justify-center">
                            {/* Animation: Correct resizing without stretching */}
                            <div className={`border-2 rounded-md transition-all duration-1000 flex items-center justify-center
                    ${isClean
                                    ? 'w-12 h-12 border-indigo-400 bg-indigo-400/20'  // Square (Correct)
                                    : 'w-16 h-8 border-red-400 bg-red-400/20'       // Stretched (Wrong)
                                }
                 `}>
                                <div className="w-2 h-2 rounded-full bg-current opacity-50"></div>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold mb-2 text-gray-100">원본 비율 유지</h3>
                        <p className="text-gray-400 text-sm">억지로 늘리지 않습니다. 원본 비율을 자동으로 계산해 자연스럽게 조절합니다.</p>
                    </div>

                </div>
            </div>
        </div>
    );
}
