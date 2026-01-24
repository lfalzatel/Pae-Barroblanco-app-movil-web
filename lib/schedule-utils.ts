export interface GlobalGroup {
    id: string; // "6A", "6B+604", etc.
    label: string;
    isCombo: boolean;
    studentCount?: number;
}

export const generateTimeSlots = (intervalMinutes: number = 10) => {
    const slots: string[] = [];

    // Helper to convert time "HH:MM" to minutes from midnight
    const toMins = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // Helper to convert minutes to "HH:MM AM/PM"
    const toStr = (m: number) => {
        let h = Math.floor(m / 60);
        const min = m % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`;
    };

    const startMins = toMins("07:10");
    const endMins = toMins("12:05"); // Extended to include 12:00 slot

    // Iterate
    let current = startMins;
    while (current < endMins) {
        slots.push(toStr(current));
        current += intervalMinutes;
    }

    return slots;
};

export const isBreakTime = (time: string) => {
    // Break 1: 08:50 - 09:10
    // Break 2: 11:00 - 11:20 (Service ends at 11:00 usually, but if slot exists)

    // We only care about the labeled start time of the slot
    // If a slot starts at 8:50 or 9:00, it's during break 1.
    // If a slot starts at 11:00 or 11:10, it's during break 2.

    // Simple string check for now as we know fixed slots
    const breakSlots = ["08:50 AM", "09:00 AM", "11:00 AM"];
    return breakSlots.includes(time);
};

export const processGroups = (rawGroups: string[]): GlobalGroup[] => {
    // Return all unique groups, sorted.
    // We no longer force combos. Deaf groups (ending in 04) are independent.
    const unique = Array.from(new Set(rawGroups));

    return unique.sort().map(g => ({
        id: g,
        label: g,
        isCombo: false // No auto-detection of combos anymore
    }));
};
