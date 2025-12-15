/**
 * 
 */
export default class Parser {
    /**
     * Parse number from input format [number-number].
     * @param {*} input 
     * @returns numbers array from given input
     */
    static parseNumbers(input: string) {
        if (typeof input !== "string") return [];

        const parts = input.split(",");
        const result = [];

        for (const part of parts) {
            const range = part.split("-").map(x => x.trim());

            if (range.length === 2) {
                const start = Number.parseInt(range[0], 10);
                const end = Number.parseInt(range[1], 10);

                if (!Number.isNaN(start) && !Number.isNaN(end)) {
                    const step = start <= end ? 1 : -1;
                    for (let i = start; step === 1 ? i <= end : i >= end; i += step) {
                        result.push(i);
                    }
                }
            } else {
                const value = Number.parseInt(range[0], 10);
                if (!Number.isNaN(value)) result.push(value);
            }
        }
        return result;
    }

}
