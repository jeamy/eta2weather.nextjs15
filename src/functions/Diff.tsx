import { decodeReply } from "next/dist/server/app-render/entry-base";

class Diff {
    constructor() {}
  
    /**
     * Normalize a value within a range to a value between 0 and 1.
     * @param data The value to normalize.
     * @param min The minimum value of the range.
     * @param max The maximum value of the range.
     * @returns The normalized value.
     */
    normalizeData(data: number, min: number, max: number): number {
        return Math.round((data - min) / (max - min) * 10000) / 10000;
    }
  
    /**
     * Return a value that is "diffed" from the center of the range.
     * This is a non-linear function that is used to map a value that is
     * outside of a range to a value that is within the range. The
     * function is designed to be used with a range of 0 to 100, with
     * 0 and 100 being at the edges of the range.
     *
     * @param {number} val The value to be diffed
     * @param {number} pow The power to use for the diff (default: 2)
     * @param {number} max The maximum value of the range (default: 5.0)
     * @param {number} start The start value of the range (default: 0.0)
     * @param {number} end The end value of the range (default: 100.0)
     * @returns {number} The diffed value
     */
    getDiff(val: number, pow: number = 2, max: number = 5.0, start: number = 0.0, end: number = 100.0): number {
        const range: number = end - start;
        const neg: number = val < 0.0 ? -1.0 : 1.0;
        val = Math.abs(val);
    
        if (neg < 0) {
            val += 1; // avoid log < 1
            const l10: number = this.normalizeData(Math.log(val), 0, Math.log(max + 1)) * neg * range;
            return l10;
        } else {
            const l10: number = this.normalizeData(Math.pow(val, pow), 0, Math.pow(max, pow)) * neg * range;
            return l10;
        }
    }
  }
  export default Diff;