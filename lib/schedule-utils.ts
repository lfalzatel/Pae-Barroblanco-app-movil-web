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

    const startMins = toMins("07:00"); // Standardized start
    const endMins = toMins("13:05"); // Extended to include up to 13:00

    // Iterate
    let current = startMins;
    while (current < endMins) {
        slots.push(toStr(current));
        current += intervalMinutes;
    }

    return slots;
};

export const getAcademicBlock = (time: string): number | null => {
    // Blocks as defined by user:
    // 1. 07:00 - 07:55
    // 2. 07:55 - 08:50
    // 3. 09:10 - 10:05
    // 4. 10:05 - 11:00
    // 5. 11:10 - 12:05
    // 6. 12:05 - 13:00

    const toMins = (t: string) => {
        const [h, m] = t.split(/[: ]/).map((v, i) => i === 0 && t.includes('PM') && v !== '12' ? Number(v) + 12 : Number(v));
        // Simplified parser for "HH:MM AM/PM" or "HH:MM"
        const clean = t.replace(/(AM|PM)/, '').trim();
        let [hh, mm] = clean.split(':').map(Number);
        if (t.includes('PM') && hh !== 12) hh += 12;
        if (t.includes('AM') && hh === 12) hh = 0;
        return hh * 60 + mm;
    };

    const t = toMins(time);

    if (t >= toMins("07:00") && t < toMins("07:55")) return 1;
    if (t >= toMins("07:55") && t < toMins("08:50")) return 2;
    if (t >= toMins("09:10") && t < toMins("10:05")) return 3;
    if (t >= toMins("10:05") && t < toMins("11:00")) return 4;
    if (t >= toMins("11:10") && t < toMins("12:05")) return 5;
    if (t >= toMins("12:05") && t <= toMins("13:00")) return 6;

    return null;
};

export const isBreakTime = (time: string) => {
    // Break 1: 08:50 - 09:10
    // Break 2: 11:00 - 11:10

    // We explicitly list the start times of slots that fall clearly and exclusively into break time
    // OR just use the academic block logic: if it's not in a block, it might be a break?
    // User specifically mentioned breaks.

    // 08:50 and 09:00 are definitely break 1
    // 11:00 is break 2

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
