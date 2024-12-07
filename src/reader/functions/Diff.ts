class Diff {
    /**
     * Normalisiert einen Wert innerhalb eines Bereichs auf einen Wert zwischen 0 und 1.
     */
    private normalizeData(data: number, min: number, max: number): number {
        return Math.round((data - min) / (max - min) * 10000) / 10000;
    }
  
    /**
     * Berechnet einen "diff" Wert vom Zentrum des Bereichs.
     */
    public getDiff(val: number, pow: number = 2, max: number = 5.0, start: number = 0.0, end: number = 100.0): number {
        const range: number = end - start;
        const neg: number = Math.sign(val);
        const absVal: number = Math.abs(val);
        
        let result: number;
        if (neg < 0) {
            result = this.normalizeData(Math.log(absVal + 1), 0, Math.log(max + 1)) * neg * range;
        } else {
            result = this.normalizeData(Math.pow(absVal, pow), 0, Math.pow(max, pow)) * neg * range;
        }

        result = Math.min(Math.max(result, -end), end);
       
        // Round to 0 decimal places
        return Math.round(result);
    }
}

export default Diff;
