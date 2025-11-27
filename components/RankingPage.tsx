import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import { Session } from '@supabase/supabase-js';
import VolunteerStatsModal from './VolunteerStatsModal';
import { Medalha01Icon, Medalha02Icon, Medalha03Icon } from '../assets/icons';
import { useRankingData } from '../hooks/useQueries';

interface UserProfile {
    volunteer_id: number | null;
    role?: 'admin' | 'leader' | 'volunteer' | 'lider';
}

const MedalIcon: React.FC<{ rank: number }> = ({ rank }) => {
    const icons = {
        1: Medalha01Icon,
        2: Medalha02Icon,
        3: Medalha03Icon,
    };

    const iconSrc = icons[rank as keyof typeof icons];

    if (!iconSrc) return null;

    return <img src={iconSrc} alt={`Medalha ${rank}`} className="h-8 w-8" />;
};


interface RankingPageProps {
    session: Session | null;
    userProfile: UserProfile | null;
}

export interface RankedVolunteer {
    id: number;
    name: string;
    initials: string;
    departments: { id: number; name: string }[];
    totalPresent: number;
    totalScheduled: number;
    avatar_url?: string;
}

// Gamification component for medals
const Badge: React.FC<{ percentage: number }> = ({ percentage }) => {
    let badge: { icon: string; label: string; } | null = null;

    if (percentage >= 90) {
        badge = { icon: '🥇', label: 'Voluntário Ouro (90%+ de presença)' };
    } else if (percentage >= 70) {
        badge = { icon: '🥈', label: 'Voluntário Prata (70-89% de presença)' };
    } else if (percentage >= 50) {
        badge = { icon: '🥉', label: 'Voluntário Bronze (50-69% de presença)' };
    }

    if (!badge) {
        return null;
    }

    return (
        <span className="text-xl ml-2" title={badge.label}>
            {badge.icon}
        </span>
    );
};




const RankingPage: React.FC<RankingPageProps> = ({ session, userProfile }) => {
    const { data: rankingData, isLoading, error: rankingError } = useRankingData();

    const volunteers = rankingData?.volunteers || [];
    const rawAttendance = rankingData?.attendance || [];
    const departments = rankingData?.departments || [];
    const loading = isLoading;
    const error = rankingError ? getErrorMessage(rankingError) : null;

    // Filter and Sort States
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [sortBy, setSortBy] = useState<'most' | 'least' | 'name'>('most');

    const [viewingVolunteer, setViewingVolunteer] = useState<RankedVolunteer | null>(null);

    // Dropdown States and Refs
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const deptDropdownRef = useRef<HTMLDivElement>(null);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const sortDropdownRef = useRef<HTMLDivElement>(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef<HTMLDivElement>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([]);

    const Dropdown: React.FC<{
        buttonLabel: string;
        options: { value: string; label: string }[];
        selectedValue: string;
        onSelect: (value: string) => void;
        isOpen: boolean;
        setIsOpen: (isOpen: boolean) => void;
        dropdownRef: React.RefObject<HTMLDivElement>;
    }> = ({ buttonLabel, options, selectedValue, onSelect, isOpen, setIsOpen, dropdownRef }) => (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full sm:w-auto px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                <span>{buttonLabel}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-2 w-full sm:w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                    <ul className="py-1">
                        {options.map(option => (
                            <li key={option.value}><button onClick={() => { onSelect(option.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${selectedValue === option.value ? 'font-semibold text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/50' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{option.label}</button></li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) setIsDeptDropdownOpen(false);
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) setIsSortDropdownOpen(false);
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) setIsYearDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (rawAttendance.length > 0) {
            const years = new Set<number>();
            for (const record of rawAttendance) {
                const eventData = Array.isArray(record.events) ? record.events[0] : record.events;
                if (eventData?.date) {
                    years.add(new Date(eventData.date).getFullYear());
                }
            }
            const sortedYears = Array.from(years).sort((a, b) => b - a);
            setAvailableYears(sortedYears);
            if (sortedYears.length > 0 && selectedYear === new Date().getFullYear().toString()) {
                // Only set if not already set by user interaction or default
                // Actually, we want to keep the default 'current year' if possible, or fallback to latest
                // But since we initialize selectedYear with current year, we might just leave it.
                // Let's just ensure availableYears is populated.
            }
        }
    }, [rawAttendance]); // Run when data is loaded

    const processedRanking = useMemo(() => {
        // 1. Filter attendance by selected year
        const yearFilteredAttendance = rawAttendance.filter(record => {
            if (selectedYear === 'all') return true;
            // FIX: The `events` relation from Supabase might be an array even for a to-one join. Handle this by taking the first element.
            const eventData = Array.isArray(record.events) ? record.events[0] : record.events;
            if (!eventData?.date) return false;
            return new Date(eventData.date).getFullYear().toString() === selectedYear;
        });

        // 2. Calculate scores based on filtered attendance
        const attendanceByVolunteer = new Map<number, { totalPresent: number; totalScheduled: number }>();
        for (const record of yearFilteredAttendance) {
            if (!attendanceByVolunteer.has(record.volunteer_id)) {
                attendanceByVolunteer.set(record.volunteer_id, { totalPresent: 0, totalScheduled: 0 });
            }
            const stats = attendanceByVolunteer.get(record.volunteer_id)!;
            stats.totalScheduled++;
            if (record.present) {
                stats.totalPresent++;
            }
        }

        // 3. Combine volunteer data with calculated scores
        let rankedVolunteers: RankedVolunteer[] = volunteers.map((v: any) => {
            const stats = attendanceByVolunteer.get(v.id) || { totalPresent: 0, totalScheduled: 0 };
            return {
                id: v.id,
                name: v.name,
                initials: v.initials,
                avatar_url: v.avatar_url,
                departments: v.volunteer_departments.map((vd: any) => vd.departments).filter(Boolean),
                ...stats
            };
        });

        // 4. Filter by department
        if (selectedDepartment !== 'all') {
            const deptId = parseInt(selectedDepartment, 10);
            rankedVolunteers = rankedVolunteers.filter(v => v.departments.some(d => d.id === deptId));
        }

        // 5. Sort the results
        return rankedVolunteers.sort((a, b) => {
            const percentageA = a.totalScheduled > 0 ? a.totalPresent / a.totalScheduled : 0;
            const percentageB = b.totalScheduled > 0 ? b.totalPresent / b.totalScheduled : 0;

            switch (sortBy) {
                case 'least':
                    if (a.totalPresent !== b.totalPresent) return a.totalPresent - b.totalPresent;
                    return percentageA - percentageB;
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'most':
                default:
                    if (b.totalPresent !== a.totalPresent) return b.totalPresent - a.totalPresent;
                    return percentageB - percentageA;
            }
        });
    }, [volunteers, rawAttendance, selectedYear, selectedDepartment, sortBy]);

    const currentUserRank = useMemo(() => {
        if (!userProfile?.volunteer_id) return null;
        const index = processedRanking.findIndex(v => v.id === userProfile.volunteer_id);
        return index !== -1 ? index + 1 : null;
    }, [processedRanking, userProfile]);

    const departmentOptions = [{ value: 'all', label: 'Todos os Departamentos' }, ...departments.map(d => ({ value: String(d.id), label: d.name }))];
    const yearOptions = [{ value: 'all', label: 'Todos os Anos' }, ...availableYears.map(y => ({ value: String(y), label: String(y) }))];
    const sortOptions = [
        { value: 'most', label: 'Mais Frequentes' },
        { value: 'least', label: 'Menos Frequentes' },
        { value: 'name', label: 'Nome (A-Z)' },
    ];
    const selectedDeptLabel = departmentOptions.find(d => d.value === selectedDepartment)?.label || 'Filtrar';
    const selectedYearLabel = yearOptions.find(y => y.value === selectedYear)?.label || 'Ano';
    const selectedSortLabel = sortOptions.find(s => s.value === sortBy)?.label || 'Ordenar';

    const handleVolunteerClick = (volunteer: RankedVolunteer) => {
        const isCurrentUser = userProfile?.volunteer_id === volunteer.id;
        // Check for both English and Portuguese role names to be safe
        const isAdminOrLeader = userProfile?.role === 'admin' || userProfile?.role === 'leader' || userProfile?.role === 'lider';

        if (isCurrentUser || isAdminOrLeader) {
            setViewingVolunteer(volunteer);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Ranking</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Veja os voluntários mais engajados nos eventos.</p>
            </div>

            {currentUserRank && (
                <div className="bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-400 dark:border-blue-500 p-4 rounded-r-lg shadow-sm">
                    <p className="font-semibold text-blue-800 dark:text-blue-300">Parabéns! Você está na <span className="text-xl">{currentUserRank}ª</span> posição no ranking atual.</p>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4">
                <Dropdown buttonLabel={selectedDeptLabel} options={departmentOptions} selectedValue={selectedDepartment} onSelect={setSelectedDepartment} isOpen={isDeptDropdownOpen} setIsOpen={setIsDeptDropdownOpen} dropdownRef={deptDropdownRef} />
                <Dropdown buttonLabel={selectedYearLabel} options={yearOptions} selectedValue={selectedYear} onSelect={setSelectedYear} isOpen={isYearDropdownOpen} setIsOpen={setIsYearDropdownOpen} dropdownRef={yearDropdownRef} />
                <Dropdown buttonLabel={selectedSortLabel} options={sortOptions} selectedValue={sortBy} onSelect={(value) => setSortBy(value as 'most' | 'least' | 'name')} isOpen={isSortDropdownOpen} setIsOpen={setIsSortDropdownOpen} dropdownRef={sortDropdownRef} />
            </div>

            {loading ? <p className="text-center text-slate-500 mt-10">Carregando ranking...</p> : error ? <p className="text-center text-red-500 mt-10">{error}</p> : (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {processedRanking.map((volunteer, index) => {
                            const rank = index + 1;
                            const isTop3 = rank <= 3;
                            const topScore = processedRanking.length > 0 ? processedRanking[0].totalPresent : 0;
                            const progressBarWidth = topScore > 0 ? Math.round((volunteer.totalPresent / topScore) * 100) : 0;
                            const isCurrentUser = volunteer.id === userProfile?.volunteer_id;

                            const points = volunteer.totalPresent;
                            const level = Math.floor(points / 5) + 1;

                            const renderContent = () => {
                                return (
                                    <>
                                        <div className="flex-grow min-w-0">
                                            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{volunteer.name}</div>
                                            {volunteer.totalScheduled > 0 && (
                                                <div className="mt-1" title={`Pontuação Relativa: ${progressBarWidth}%`}>
                                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 shadow-inner">
                                                        <div
                                                            className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                                                            style={{ width: `${progressBarWidth}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right flex-shrink-0 ml-auto w-24">
                                            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{points} pts</p>
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nível {level}</p>
                                        </div>
                                    </>
                                );
                            };

                            return (
                                <div
                                    key={volunteer.id}
                                    onClick={() => handleVolunteerClick(volunteer)}
                                    className={`p-4 flex items-center gap-4 transition-colors ${(userProfile?.volunteer_id === volunteer.id || userProfile?.role === 'admin' || userProfile?.role === 'leader' || userProfile?.role === 'lider')
                                        ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                        : 'cursor-default'
                                        } ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/50' : ''}`}
                                >
                                    <div className="flex-shrink-0 w-12 flex items-center justify-center">
                                        {isTop3 ? (
                                            <MedalIcon rank={rank} />
                                        ) : (
                                            <span className="text-lg font-bold text-slate-400 dark:text-slate-500">#{rank}</span>
                                        )}
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden">
                                        {volunteer.avatar_url ? (
                                            <img src={volunteer.avatar_url} alt={volunteer.name} className="w-full h-full object-cover" />
                                        ) : (
                                            volunteer.initials
                                        )}
                                    </div>
                                    {renderContent()}
                                </div>
                            );
                        })}
                    </div>
                    {processedRanking.length === 0 && (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">Nenhum voluntário encontrado</h3>
                            <p className="mt-1 text-sm">Tente ajustar seus filtros para encontrar resultados.</p>
                        </div>
                    )}
                </div>
            )}
            <VolunteerStatsModal
                isOpen={!!viewingVolunteer}
                onClose={() => setViewingVolunteer(null)}
                volunteer={viewingVolunteer}
            />
        </div>
    );
};

export default RankingPage;
