import api from './api';
import type { Activity, Catalog } from '@/types/api';

export interface DailyStats {
    date: string;
    views: number;
}

export interface CatalogPerformance {
    catalogId: number;
    title: string;
    views: number;
    trend: number; // Percentage
    rank: number;
}

export const analyticsService = {
    /**
     * Fetches activities and catalogs to aggregare performance data
     */
    async getPerformanceData(days: number = 7) {
        try {
            // Fetch all required data
            // Note: In a real/larger app this should be a dedicated backend endpoint
            // to avoid fetching all history locally.
            const [activitiesRes, catalogsRes] = await Promise.all([
                api.get<Activity[]>('/api/activities/'),
                api.get<Catalog[]>('/api/catalogs/')
            ]);

            const activities = activitiesRes.data;
            const catalogs = catalogsRes.data;

            const now = new Date();
            const startDate = new Date();
            startDate.setDate(now.getDate() - days);

            // Filter activities within range
            const recentActivities = activities.filter(a => {
                const activityDate = new Date(a.timestamp);
                return activityDate >= startDate && activityDate <= now;
            });

            // 1. Calculate Daily Views (Mocking 'view' action if not explicit, or counting all interactions as "engagement")
            // We look for 'view', 'read', 'open' or generic activity as fallback if strict 'view' is missing
            const dailyViews = new Map<string, number>();

            // Initialize all days in range with 0
            for (let i = 0; i < days; i++) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                dailyViews.set(d.toISOString().split('T')[0], 0);
            }

            recentActivities.forEach(activity => {
                // Simplification: Count all catalog-related activities as "views/engagement"
                // or filter specifically for 'view catalog' if available. 
                // For now, we count specific read-like actions OR all if generic.
                const isViewLike = ['view', 'open', 'read'].some(v => activity.action.toLowerCase().includes(v));

                if (isViewLike || activity.details?.type === 'catalog_view') {
                    const dateKey = new Date(activity.timestamp).toISOString().split('T')[0];
                    if (dailyViews.has(dateKey)) {
                        dailyViews.set(dateKey, (dailyViews.get(dateKey) || 0) + 1);
                    }
                }
            });

            // Convert to array and sort by date
            const chartData = Array.from(dailyViews.entries())
                .map(([date, count]) => ({
                    date,
                    views: count
                }))
                .sort((a, b) => a.date.localeCompare(b.date));


            // 2. Calculate Top Catalogs
            const catalogViews = new Map<number, number>();

            // Initialize with 0
            catalogs.forEach(c => catalogViews.set(c.id, 0));

            // Aggregate counts per catalog
            // We need activity to be linked to catalog. api.ts Activity interface has 'details' or 'action' text.
            // Ideally Activity has a `catalog` field. Let's check types/api.ts again.
            // types/api.ts: Activity has `user`. Doesn't strictly show `catalog` ID but "details: Record<string, any>".
            // We will try to extract catalog ID from details if present.

            activities.forEach(activity => {
                const catId = activity.details?.catalog_id || activity.details?.id;
                if (catId && catalogViews.has(catId)) {
                    catalogViews.set(catId, (catalogViews.get(catId) || 0) + 1);
                }
            });

            const topCatalogs = catalogs.map(c => ({
                rank: 0,
                id: c.id,
                name: c.title,
                views: catalogViews.get(c.id) || 0,
                trend: 0 // Cannot reliably calc trend without previous period comp. defaulting to 0 or random for now? No, stick to real 0.
            }))
                .sort((a, b) => b.views - a.views)
                .slice(0, 3)
                .map((c, idx) => ({ ...c, rank: idx + 1 }));

            return {
                chartData,
                topCatalogs
            };

        } catch (error) {
            console.error('Error fetching analytics:', error);
            return {
                chartData: [],
                topCatalogs: []
            };
        }
    }
};
