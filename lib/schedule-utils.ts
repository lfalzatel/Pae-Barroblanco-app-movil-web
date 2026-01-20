export interface GlobalGroup {
    id: string; // "6A", "6B+604", etc.
    label: string;
    isCombo: boolean;
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
    const endMins = toMins("11:00"); // Service must end before/at second break

    const break1Start = toMins("08:50");
    const break1End = toMins("09:10");

    // Iterate
    let current = startMins;
    while (current < endMins) {
        // Check if current slot falls within break
        // We allow slot strictly BEFORE break starts.
        // If current == 8:50, we skip.
        if (current >= break1Start && current < break1End) {
            current = break1End; // Jump to end of break
            continue;
        }

        // Safety check for end of service
        if (current >= endMins) break;

        slots.push(toStr(current));
        current += intervalMinutes;
    }

    return slots;
};

export const processGroups = (rawGroups: string[]): GlobalGroup[] => {
    // 1. Identify "Deaf" groups (ending in 04, e.g., 604)
    const deafGroups = rawGroups.filter(g => g.endsWith('04'));
    const normalGroups = rawGroups.filter(g => !g.endsWith('04'));

    const processed: GlobalGroup[] = [];
    const usedDeaf = new Set<string>();

    // 2. Process normal groups and try to pair
    normalGroups.forEach(g => {
        // Check if this is a "B" group (e.g., "6B")
        // Logic: ends with "B" ?
        if (g.endsWith('B')) {
            // Look for corresponding 04. 
            // Assumption: 6B -> 604. 7B -> 704.
            // Parse grade: "6B" -> "6".
            const grade = g.replace('B', '');
            const targetDeaf = `${grade}04`;

            if (deafGroups.includes(targetDeaf)) {
                processed.push({
                    id: `${g} + ${targetDeaf}`,
                    label: `${g} y ${targetDeaf}`,
                    isCombo: true
                });
                usedDeaf.add(targetDeaf);
                return;
            }
        }

        // Default single group
        processed.push({ id: g, label: g, isCombo: false });
    });

    // 3. Add any leftover deaf groups (orphans)
    deafGroups.forEach(g => {
        if (!usedDeaf.has(g)) {
            processed.push({ id: g, label: g, isCombo: false });
        }
    });

    // Sort logically (optional, but nice)
    // Simple alpha sort for now
    return processed.sort((a, b) => a.id.localeCompare(b.id));
};
