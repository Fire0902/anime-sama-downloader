/**
 * 
 */
class Parser {
    /**
     * Parse number from input format [number-number].
     * @param {*} input 
     * @returns numbers array from given input
     */
    static parseNumbers(input) {
        if (typeof input !== "string") return [];

        const parts = input.split(",");
        const result = [];

        for (const part of parts) {
            const range = part.split("-").map(x => x.trim());

            if (range.length === 2) {
                const start = parseInt(range[0], 10);
                const end = parseInt(range[1], 10);

                if (!isNaN(start) && !isNaN(end)) {
                    const step = start <= end ? 1 : -1;
                    for (let i = start; step === 1 ? i <= end : i >= end; i += step) {
                        result.push(i);
                    }
                }
            } else {
                const value = parseInt(range[0], 10);
                if (!isNaN(value)) result.push(value);
            }
        }
        return result;
    }

}
module.exports = Parser;