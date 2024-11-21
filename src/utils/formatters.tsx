import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';

export interface FormattedValue {
  text: JSX.Element | string;
  color: string;
}

export const formatValue = (data: ParsedXmlData): FormattedValue => {
  const value = data.strValue || data.value;
  
  if (typeof value === 'undefined' || value === null) {
    return { text: 'N/A', color: "text-gray-500" };
  }

  // Handle special text cases
  const specialCases: Record<string, FormattedValue> = {
    "Ein": { text: "Ein", color: "text-green-600" },
    "Aus": { text: "Aus", color: "text-red-600" },
    "xxx": { text: "---", color: "text-blue-600" }
  };

  if (typeof value === 'string' && value in specialCases) {
    return specialCases[value];
  }
  
  // Handle time format "Xm Ys"
  if (typeof value === 'string') {
    const timeMatch = value.match(/(\d+)m\s+(\d+(?:,\d+)?)s/);
    if (timeMatch) {
      const [, minutes, seconds] = timeMatch;
      return { 
        text: (
          <>{minutes}<span className="text-gray-500"> m</span> {seconds.replace(',', '.')}</>
        ),
        color: "text-gray-900" 
      };
    }
  }
  
  // Try to convert to number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // If not a valid number, return the original text
  if (isNaN(numValue)) {
    return { text: value.toString(), color: "text-gray-900" };
  }
  
  // Special handling for "Letzte Änderung"
  if (data.name === "Letzte Änderung") {
    const hours = Math.floor(numValue / 3600);
    const minutes = Math.floor((numValue % 3600) / 60);
    const seconds = Math.floor(numValue % 60);
    
    return {
      text: (
        <>{hours}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</>
      ),
      color: "text-gray-900"
    };
  }
  
  // Format number with 2 decimal places if it has decimals
  const formattedNumber = Number.isInteger(numValue) ? numValue : numValue.toFixed(2);
  return { text: formattedNumber.toString(), color: "text-gray-900" };
};
