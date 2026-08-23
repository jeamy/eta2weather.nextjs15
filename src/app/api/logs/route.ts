import { NextResponse } from 'next/server';
import { getLogFiles } from '@/utils/logging';

export async function GET(request: Request) {
    try {
        const requestedLimit = Number(new URL(request.url).searchParams.get('limit') || 1000);
        const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.trunc(requestedLimit), 5000)) : 1000;
        // Get logs for all types
        const [ecowittLogs, etaLogs, configLogs, tempDiffLogs, min_temp_status] = await Promise.all([
            getLogFiles('ecowitt', limit),
            getLogFiles('eta', limit),
            getLogFiles('config', limit),
            getLogFiles('temp_diff', limit),
            getLogFiles('min_temp_status', limit)
        ]);

        // Format log entries
        const formatLogs = (logs: string[], type: string) => {
            return logs.map(logPath => {
                const pathParts = logPath.split('/');
                const fileName = pathParts[pathParts.length - 1];
                const timeMatch = fileName.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{1,2}))?/);
                const hour = timeMatch?.[1] || '0';
                const minute = timeMatch?.[2] || '0';
                const second = timeMatch?.[3] || '0';
                const year = pathParts[pathParts.length - 4];  // Get year from path
                const month = pathParts[pathParts.length - 3]; // Get month from path
                const day = pathParts[pathParts.length - 2];   // Get day from path
                
                // Ensure all components are padded with zeros
                const paddedMonth = month.padStart(2, '0');
                const paddedDay = day.padStart(2, '0');
                const paddedHour = hour.padStart(2, '0');
                const paddedMinute = minute.padStart(2, '0');
                const paddedSecond = second.padStart(2, '0');
                
                // Create ISO date string
                const dateStr = `${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${paddedMinute}:${paddedSecond}`;
                
                return {
                    path: logPath,
                    type,
                    date: dateStr,  // Store as ISO string
                    year,
                    month: paddedMonth,
                    day: paddedDay,
                    time: `${paddedHour}:${paddedMinute}:${paddedSecond}`
                };
            });
        };

        // Combine and sort all logs
        const allLogs = [
            ...formatLogs(ecowittLogs, 'ecowitt'),
            ...formatLogs(etaLogs, 'eta'),
            ...formatLogs(configLogs, 'config'),
            ...formatLogs(tempDiffLogs, 'temp_diff'),
            ...formatLogs(min_temp_status, 'min_temp_status')
        ].sort((a, b) => b.date.localeCompare(a.date)); // Sort using ISO string comparison

        return NextResponse.json(allLogs);
    } catch (error) {
        console.error('Error handling logs request:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logs' },
            { status: 500 }
        );
    }
}
