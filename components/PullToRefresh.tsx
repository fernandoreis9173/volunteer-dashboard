import React, { useState, useEffect, useRef } from 'react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [pullDistance, setPullDistance] = useState(0);

    const THRESHOLD = 80; // Distance to pull to trigger refresh
    const MAX_PULL = 120; // Maximum distance visual pull

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            setStartY(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touchY = e.touches[0].clientY;
        const diff = touchY - startY;

        if (window.scrollY === 0 && diff > 0 && !refreshing) {
            // Prevent default only if we are pulling down at the top
            // Note: e.preventDefault() might not work in passive listeners (React default)
            // but we can control the visual state.

            // Logarithmic resistance
            const resistance = diff * 0.5;
            const limitedPull = Math.min(resistance, MAX_PULL);

            setPullDistance(limitedPull);
            setCurrentY(touchY);
        }
    };

    const handleTouchEnd = async () => {
        if (pullDistance > THRESHOLD && !refreshing) {
            setRefreshing(true);
            setPullDistance(60); // Snap to loading position
            try {
                await onRefresh();
            } finally {
                setTimeout(() => {
                    setRefreshing(false);
                    setPullDistance(0);
                }, 500); // Small delay for visual feedback
            }
        } else {
            setPullDistance(0);
        }
        setStartY(0);
        setCurrentY(0);
    };

    return (
        <div
            ref={contentRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="min-h-screen relative"
        >
            {/* Spinner Container */}
            <div
                className="fixed top-0 left-0 w-full flex justify-center items-center pointer-events-none z-50 transition-transform duration-200"
                style={{
                    transform: `translateY(${pullDistance > 0 ? Math.min(pullDistance, 100) + 60 : -50}px)`,
                    opacity: pullDistance > 0 ? 1 : 0
                }}
            >
                <div className={`bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg border border-slate-200 dark:border-slate-700 ${refreshing ? 'animate-spin' : ''}`}>
                    <svg
                        className={`w-6 h-6 text-blue-600 ${refreshing ? '' : 'transform transition-transform duration-200'}`}
                        style={{ transform: `rotate(${pullDistance * 3}deg)` }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>
            </div>

            {/* Content with transform */}
            <div
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: refreshing || pullDistance === 0 ? 'transform 0.3s ease-out' : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default PullToRefresh;
