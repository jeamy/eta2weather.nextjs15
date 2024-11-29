'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LogFile {
    path: string;
    type: string;
    date: string;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogFile[]>([]);
    const [selectedType, setSelectedType] = useState<string>('all');

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await fetch('/api/logs');
                const data = await response.json();
                setLogs(data);
            } catch (error) {
                console.error('Error fetching logs:', error);
            }
        };

        fetchLogs();
    }, []);

    const filteredLogs = selectedType === 'all' 
        ? logs 
        : logs.filter(log => log.type === selectedType);

    // Group logs by type
    const groupedLogs = filteredLogs.reduce((acc, log) => {
        if (!acc[log.type]) {
            acc[log.type] = [];
        }
        acc[log.type].push(log);
        return acc;
    }, {} as Record<string, LogFile[]>);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-4">
                <Link
                    href="/"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                    style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                    <svg 
                        className="w-5 h-5 mr-2" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M10 19l-7-7m0 0l7-7m-7 7h18" 
                        />
                    </svg>
                    Back
                </Link>
            </div>
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
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                {Object.entries(groupedLogs).map(([type, logs]) => (
                    <div key={type} className="border rounded-lg px-3 py-2">
                        <h2 className="text-lg font-semibold mb-2 capitalize">{type}</h2>
                        <div className="grid gap-1">
                            {logs.map((log, index) => (
                                <div 
                                    key={index}
                                    className={`flex justify-between items-center px-2 py-1 rounded transition-colors text-sm ${index % 2 === 0 ? 'bg-gray-200' : 'bg-gray-100'} hover:bg-gray-300`}
                                >
                                    <span className="text-gray-600">{log.date}</span>
                                    <Link 
                                        href={`/api/logs/${log.path}`}
                                        className="text-blue-600 hover:text-blue-800"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {Object.keys(groupedLogs).length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                        No logs found
                    </div>
                )}
            </div>
        </div>
    );
}
