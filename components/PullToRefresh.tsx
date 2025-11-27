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
    const isDragging = useRef(false);

    const THRESHOLD = 80; // Distance to pull to trigger refresh
    const MAX_PULL = 120; // Maximum distance visual pull

    // Helper to find the nearest scrollable parent
    const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
        if (!node) return window;

        const overflowY = window.getComputedStyle(node).overflowY;
        const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';

        if (isScrollable && node.scrollHeight > node.clientHeight) {
            return node;
        }

        return getScrollParent(node.parentElement);
    };

    const getScrollTop = () => {
        if (!contentRef.current) return 0;
        const scrollParent = getScrollParent(contentRef.current);
        if (scrollParent === window) {
            return window.scrollY;
        }
        return (scrollParent as HTMLElement).scrollTop;
    };

    const handleStart = (clientY: number) => {
        if (getScrollTop() <= 0) {
            setStartY(clientY);
            isDragging.current = true;
        }
    };

    const handleMove = (clientY: number) => {
        if (!isDragging.current) return;

        const diff = clientY - startY;

        // Only allow pulling if we are at the top and pulling down
        if (getScrollTop() <= 0 && diff > 0 && !refreshing) {
            // Logarithmic resistance
            const resistance = diff * 0.5;
            const limitedPull = Math.min(resistance, MAX_PULL);

            setPullDistance(limitedPull);
            setCurrentY(clientY);
        } else {
            // If we scrolled down or are pushing up, stop dragging logic
            isDragging.current = false;
            setPullDistance(0);
        }
    };

    const handleEnd = async () => {
        isDragging.current = false;
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

    // Touch Handlers
    const handleTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientY);
    const handleTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientY);
    const handleTouchEnd = () => handleEnd();

    // Mouse Handlers (for desktop testing)
    const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientY);
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current) {
            // Prevent default drag behavior (text selection etc)
            // e.preventDefault(); 
            // Note: preventing default here might block text selection if not careful, 
            // but for pull-to-refresh simulation it's often needed. 
            // However, we only prevent if we are actually "pulling".
            if (getScrollTop() <= 0 && (e.clientY - startY) > 0) {
                // e.preventDefault(); // Optional, can cause issues with other interactions
            }
            handleMove(e.clientY);
        }
    };
    const handleMouseUp = () => handleEnd();
    const handleMouseLeave = () => {
        if (isDragging.current) handleEnd();
    };

    return (
        <div
            ref={contentRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="min-h-full relative" // Changed from min-h-screen to min-h-full to fit container
        >
            {/* Spinner Container */}
            <div
                className="fixed top-20 left-0 w-full flex justify-center items-center pointer-events-none z-50 transition-transform duration-200"
                style={{
                    transform: `translateY(${pullDistance > 0 ? Math.min(pullDistance, 100) : -50}px)`,
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
