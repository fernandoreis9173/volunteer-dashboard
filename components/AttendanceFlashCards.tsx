import React, { useMemo } from 'react';
import type { DashboardEvent } from '../types';

// FIX: Reverted UserProfileState to use a single `department_id` to match the rest of the application.
interface UserProfileState {
    role: string | null;
    department_id: number | null;
    volunteer_id: number | null;
    status: string | null;
}

interface AttendanceFlashCardsProps {
    schedules: DashboardEvent[] | undefined;
    userProfile: UserProfileState | null;
    departmentVolunteers?: { id: number; name: string; }[];
}

const AttendanceFlashCards: React.FC<AttendanceFlashCardsProps> = ({ schedules, userProfile, departmentVolunteers = [] }) => {

    const attendanceData = useMemo(() => {
        if (!schedules || !userProfile?.department_id) {
            return { present: 0, absent: 0, total: 0 };
        }

        let present = 0;
        let absent = 0;
        let total = 0;

        schedules.forEach(event => {
            if (event.status !== 'Confirmado') return;

            const hasEventEnded = new Date() > new Date(`${event.date}T${event.end_time}`);

            (event.event_volunteers || []).forEach(ev => {
                // FIX: Count volunteers who were scheduled FOR this department in this event
                // This ensures that volunteers from other departments (who might be helping out) are counted correctly if scheduled for this department,
                // AND volunteers from this department who are helping elsewhere are NOT counted here.
                if (ev.department_id === userProfile.department_id) {
                    total++;
                    if (ev.present) {
                        present++;
                    } else if (hasEventEnded) {
                        // Count as absent only if the event is over and they are not marked present.
                        absent++;
                    }
                }
            });
        });

        return { present, absent, total };
    }, [schedules, userProfile]);

    const { present, absent, total } = attendanceData;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    // SVG gauge constants
    const radius = 80;
    const strokeWidth = 24;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75; // 270 degrees arc
    const strokeDashoffset = arcLength * (1 - percentage / 100);

    if (schedules === undefined) {
        // Show skeleton on initial load
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-6"></div>
                <div className="w-48 h-48 bg-slate-200 rounded-full mx-auto my-auto"></div>
            </div>
        )
    }

    if (total === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
            {/* Top Section */}
            <div className="p-6 pb-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Frequência de Hoje</h2>
                        <p className="text-sm text-slate-500">Desempenho do seu departamento</p>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 p-1">

                    </button>
                </div>
            </div>

            {/* Gauge Section */}
            <div className="relative flex-grow flex items-center justify-center my-4">
                <svg className="w-56 h-56" viewBox="0 0 200 200">
                    <g transform="rotate(135 100 100)">
                        {/* Background Track */}
                        <circle cx="100" cy="100" r={radius} strokeWidth={strokeWidth} stroke="#e2e8f0" fill="transparent" strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" />
                        {/* Progress Fill */}
                        <circle cx="100" cy="100" r={radius} strokeWidth={strokeWidth} stroke="#3b82f6" fill="transparent" strokeDasharray={`${arcLength} ${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.65, 0, 0.35, 1)' }} />
                    </g>
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-slate-800">{percentage}<span className="text-3xl text-slate-400">%</span></span>
                </div>
            </div>

            <p className="text-center text-sm text-slate-600 px-6 -mt-4">
                Você tem <strong>{present} de {total}</strong> presenças confirmadas em seu departamento. Mantenha o bom trabalho!
            </p>

            {/* Bottom Section */}
            <div className="mt-auto pt-6">
                <div className="bg-slate-50/70 -mx-0 -mb-0 px-6 py-4 rounded-b-2xl border-t border-slate-200">
                    <div className="flex justify-around items-center text-center">
                        <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase">Escalados</p>
                            <p className="text-2xl font-bold text-slate-800">{total}</p>
                        </div>
                        <div className="h-10 w-px bg-slate-200"></div>
                        <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase">Presentes</p>
                            <p className="text-2xl font-bold text-green-600">{present}</p>
                        </div>
                        <div className="h-10 w-px bg-slate-200"></div>
                        <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase">Ausentes</p>
                            <p className="text-2xl font-bold text-red-600">{absent}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceFlashCards;