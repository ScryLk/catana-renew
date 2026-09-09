import { useState, useMemo, useEffect } from 'react';
import { analyticsService } from '@/services/analyticsService';

export type TimeRange = '7d' | '30d' | '90d';

interface ChartDataPoint {
    day: string;
    value: number; // percentage for bar width relative to max
    label: number; // actual view count
}

export function useCatalogStats() {
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<{
        chartData: { date: string; views: number }[];
        topCatalogs: { rank: number; id: number; name: string; views: number; trend: number }[];
    }>({ chartData: [], topCatalogs: [] });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
                const data = await analyticsService.getPerformanceData(days);
                setRawData(data);
            } catch (error) {
                console.error('Failed to load stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange]);

    const chartData = useMemo<ChartDataPoint[]>(() => {
        if (!rawData.chartData.length) return [];

        const maxViews = Math.max(...rawData.chartData.map(d => d.views), 1); // Avoid div by zero

        return rawData.chartData.map(d => {
            // Format date: e.g., "2024-12-14" -> "Sáb" or "14/12" depending on range scope?
            // For simplicity/consistency with design, if 7d we want Day name, else we might want Number.
            // Let's parse the date string.
            const dateObj = new Date(d.date);
            // Ensure timezone consistency (ignoring for simple viz, assume local)

            let dayLabel = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
            if (timeRange !== '7d') {
                // For longer ranges, maybe use numeric date
                dayLabel = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }
            // Capitalize first letter
            dayLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).replace('.', '');

            return {
                day: dayLabel,
                value: (d.views / maxViews) * 100,
                label: d.views
            };
        });
    }, [rawData.chartData, timeRange]);

    return {
        timeRange,
        setTimeRange,
        chartData,
        topCatalogs: rawData.topCatalogs,
        loading
    };
}
