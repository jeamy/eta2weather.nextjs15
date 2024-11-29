import { NextResponse } from 'next/server';
import { getLogFiles } from '@/utils/logging';

export async function GET() {
    try {
        // Get logs for all types
        const [ecowittLogs, etaLogs, configLogs] = await Promise.all([
            getLogFiles('ecowitt'),
            getLogFiles('eta'),
            getLogFiles('config')
        ]);

        // Format log entries
        const formatLogs = (logs: string[], type: string) => {
            return logs.map(logPath => {
                const pathParts = logPath.split('/');
                const fileName = pathParts[pathParts.length - 1];
                const [hour, minute] = fileName.split('.')[0].split('-');
                const year = pathParts[1];  // year is the second part after type
                const month = pathParts[2];
                const day = pathParts[3];
                
                // Create date string in ISO format to ensure proper parsing
                const dateStr = `${year}-${month}-${day}T${hour}:${minute}:00`;
                const date = new Date(dateStr);

                return {
                    path: logPath,
                    type,
                    date: date.toLocaleString('de-DE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                };
            });
        };

        // Combine and sort all logs
        const allLogs = [
            ...formatLogs(ecowittLogs, 'ecowitt'),
            ...formatLogs(etaLogs, 'eta'),
            ...formatLogs(configLogs, 'config')
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(allLogs);
    } catch (error) {
        console.error('Error handling logs request:', error);
        return NextResponse.json(
            { error: 'Failed to get logs' },
            { status: 500 }
        );
    }
}
