import React, { useMemo } from 'react';
import { useRankingData } from '../hooks/useQueries';
import { Medalha01Icon, Medalha02Icon, Medalha03Icon } from '../assets/icons';

interface DepartmentRankingWidgetProps {
    departmentId: number | null;
}

const DepartmentRankingWidget: React.FC<DepartmentRankingWidgetProps> = ({ departmentId }) => {
    const { data: rankingData, isLoading } = useRankingData();

    const rankedVolunteers = useMemo(() => {
        if (!rankingData || !departmentId) return [];

        const { volunteers, attendance } = rankingData;

        // Filter volunteers belonging to the department
        const deptVolunteers = volunteers.filter((v: any) => {
            // Check explicit membership
            const explicitMatch = v.volunteer_departments.some((vd: any) => vd.departments?.id === departmentId);
            if (explicitMatch) return true;

            // Check inferred membership from attendance
            const hasAttendance = attendance.some((r: any) =>
                r.volunteer_id === v.id && r.department_id === departmentId
            );
            return hasAttendance;
        });

        // Calculate stats
        const statsMap = new Map<number, { present: number; scheduled: number }>();

        attendance.forEach((record: any) => {
            // Filter attendance by the current department
            if (record.department_id !== departmentId) return;

            if (!statsMap.has(record.volunteer_id)) {
                statsMap.set(record.volunteer_id, { present: 0, scheduled: 0 });
            }
            const stats = statsMap.get(record.volunteer_id)!;
            stats.scheduled++;
            if (record.present) stats.present++;
        });

        // Combine and sort
        return deptVolunteers.map((v: any) => {
            const stats = statsMap.get(v.id) || { present: 0, scheduled: 0 };
            return {
                ...v,
                totalPresent: stats.present,
                totalScheduled: stats.scheduled,
                percentage: stats.scheduled > 0 ? (stats.present / stats.scheduled) * 100 : 0
            };
        })
            .sort((a: any, b: any) => {
                // Sort by points first (descending)
                if (b.totalPresent !== a.totalPresent) {
                    return b.totalPresent - a.totalPresent;
                }
                // Then by percentage (descending)
                return b.percentage - a.percentage;
            })
            .slice(0, 5); // Top 5

    }, [rankingData, departmentId]);

    if (isLoading) return <div className="animate-pulse h-64 bg-slate-100 rounded-xl"></div>;

    const renderRankIcon = (index: number) => {
        if (index === 0) return <Medalha01Icon className="w-8 h-8" />;
        if (index === 1) return <Medalha02Icon className="w-8 h-8" />;
        if (index === 2) return <Medalha03Icon className="w-8 h-8" />;
        return <span className="text-slate-400 font-bold text-lg">#{index + 1}</span>;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Ranking do Departamento</h3>
            <div className="space-y-6">
                {rankedVolunteers.map((vol: any, index: number) => {
                    const maxScore = rankedVolunteers[0]?.totalPresent || 0;
                    const progressBarWidth = maxScore > 0 ? Math.round((vol.totalPresent / maxScore) * 100) : 0;

                    return (
                        <div key={vol.id} className="flex items-center gap-4">
                            <div className="w-8 flex justify-center">
                                {renderRankIcon(index)}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                                {vol.avatar_url ? (
                                    <img src={vol.avatar_url} alt={vol.name} className="w-full h-full object-cover" />
                                ) : (
                                    vol.initials || '?'
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-semibold text-slate-800 truncate text-sm">{vol.name}</p>
                                    <span className="text-xs font-bold text-blue-600">{vol.totalPresent} pts</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressBarWidth}%` }}></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {rankedVolunteers.length === 0 && (
                    <div className="text-center text-slate-400 py-8">
                        <p>Nenhum dado de ranking disponível.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepartmentRankingWidget;
