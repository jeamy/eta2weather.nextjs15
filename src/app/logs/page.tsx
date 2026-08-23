'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API } from '@/constants/apiPaths';
import Link from 'next/link';

interface LogFile {
    path: string;
    type: string;
    date: string;
    year: string;
    month: string;
    day: string;
    time: string;
}

type GroupedLogs = Record<string, Record<string, Record<string, Record<string, LogFile[]>>>>;

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg className={`w-4 h-4 transition-transform ${expanded ? 'transform rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);

export default function LogsPage() {
    const [logs, setLogs] = useState<LogFile[]>([]);
    const [selectedType, setSelectedType] = useState<string>('all');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API.LOGS}?limit=500`, { signal: controller.signal });
                if (!response.ok) throw new Error(`Log request failed: ${response.status}`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    setLogs(data);
                } else {
                    console.error('Invalid log data format:', data);
                }
            } catch (error) {
                if ((error as Error).name !== 'AbortError') console.error('Error fetching logs:', error);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        void fetchLogs();
        return () => controller.abort();
    }, []);

    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodes(previous => {
            const next = new Set(previous);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    }, []);

    const groupedLogs = useMemo(() => {
        const filteredLogs = selectedType === 'all' ? logs : logs.filter(log => log.type === selectedType);
        return filteredLogs.reduce<GroupedLogs>((acc, log) => {
            acc[log.type] ??= {};
            acc[log.type][log.year] ??= {};
            acc[log.type][log.year][log.month] ??= {};
            acc[log.type][log.year][log.month][log.day] ??= [];
            acc[log.type][log.year][log.month][log.day].push(log);
            return acc;
        }, {});
    }, [logs, selectedType]);

    // Get month name
    const getMonthName = (month: string) => {
        return MONTH_NAMES[parseInt(month, 10) - 1] || month;
    };

    return (
        <div className="container mx-auto px-4 py-8">
            {isLoading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-600" style={{ fontFamily: 'var(--font-geist-sans)' }}>Loading logs...</p>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold">System Logs</h1>
                        <div className="space-x-2">
                            <select 
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="px-3 py-2 border rounded-md"
                            >
                                <option value="all">All Logs</option>
                                <option value="ecowitt">Ecowitt</option>
                                <option value="eta">ETA</option>
                                <option value="config">Config</option>
                                <option value="temp_diff">Temperature Difference</option>
                                <option value="min_temp_status">Min temperature Status</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {Object.entries(groupedLogs).map(([type, yearGroups]) => (
                            <div key={type} className="border rounded-lg p-4">
                                <div 
                                    className="flex items-center cursor-pointer"
                                    onClick={() => toggleNode(type)}
                                >
                                    <ChevronIcon expanded={expandedNodes.has(type)} />
                                    <h2 className="text-lg font-semibold ml-2 capitalize">{type}</h2>
                                </div>
                                
                                {expandedNodes.has(type) && Object.entries(yearGroups).map(([year, monthGroups]) => (
                                    <div key={year} className="ml-6 mt-2">
                                        <div 
                                            className="flex items-center cursor-pointer"
                                            onClick={() => toggleNode(`${type}-${year}`)}
                                        >
                                            <ChevronIcon expanded={expandedNodes.has(`${type}-${year}`)} />
                                            <span className="ml-2 font-medium">{year}</span>
                                        </div>
                                        
                                        {expandedNodes.has(`${type}-${year}`) && Object.entries(monthGroups).map(([month, dayGroups]) => (
                                            <div key={month} className="ml-6 mt-1">
                                                <div 
                                                    className="flex items-center cursor-pointer"
                                                    onClick={() => toggleNode(`${type}-${year}-${month}`)}
                                                >
                                                    <ChevronIcon expanded={expandedNodes.has(`${type}-${year}-${month}`)} />
                                                    <span className="ml-2">{getMonthName(month)}</span>
                                                </div>
                                                
                                                {expandedNodes.has(`${type}-${year}-${month}`) && Object.entries(dayGroups).map(([day, logs]) => (
                                                    <div key={day} className="ml-6 mt-1">
                                                        <div 
                                                            className="flex items-center cursor-pointer"
                                                            onClick={() => toggleNode(`${type}-${year}-${month}-${day}`)}
                                                        >
                                                            <ChevronIcon expanded={expandedNodes.has(`${type}-${year}-${month}-${day}`)} />
                                                            <span className="ml-2">{parseInt(day, 10)}</span>
                                                        </div>
                                                        
                                                        {expandedNodes.has(`${type}-${year}-${month}-${day}`) && (
                                                            <div className="ml-6 mt-1">
                                                                {logs.map((log) => (
                                                                    <div 
                                                                        key={log.path}
                                                                        className="flex justify-between items-center px-2 py-1 rounded text-sm hover:bg-gray-100"
                                                                    >
                                                                        <span className="text-gray-600">
                                                                            {log.time}
                                                                        </span>
                                                                        <Link 
                                                                            href={`${API.LOGS}/${log.path}`}
                                                                            className="text-blue-600 hover:text-blue-800"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            View
                                                                        </Link>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
