import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { JSX } from 'react';

export interface FormattedValue {
  text: JSX.Element | string;
  color: string;
}

export const formatValue = (data: ParsedXmlData): FormattedValue => {
  const value = data.strValue;
  
  if (typeof value === 'undefined' || value === null) {
    return { text: 'N/A', color: "text-gray-500" };
  }

  // Handle special text cases
  const specialCases: Record<string, FormattedValue> = {
    "Ein": { text: "Ein", color: "text-green-600" },
    "Aus": { text: "Aus", color: "text-red-600" },
    "xxx": { text: "---", color: "text-blue-600" }
  };

  if (value in specialCases) {
    return specialCases[value];
  }
  
  // Handle time range format "HH:MM - HH:MM"
  const timeRangeMatch = value.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (timeRangeMatch) {
    const [, hour1, min1, hour2, min2] = timeRangeMatch;
    const formattedTime = `${parseInt(hour1)}:${min1} - ${parseInt(hour2)}:${min2}`;
    return { 
      text: formattedTime,
      color: "text-gray-900" 
    };
  }

  // Handle time format "Xm Ys"
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
  
  // Special handling for "Letzte Änderung" - check by long name
  if (data.long === "Letzte Änderung") {
    // Parse the raw value (in seconds) and format as HH:MM:SS
    const numValue = parseFloat(value.replace(',', '.'));
    if (!isNaN(numValue)) {
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
  }
  
  // Default: Use strValue directly as it's already correctly formatted by the ETA API
  // The API provides strValue with proper decimal places and formatting
  
  // Special case: If strValue already contains time units (h, m, s), don't append the unit
  // Example: strValue="174h 8m" with unit="s" should display as "174h 8m", not "174h 8m s"
  const hasTimeUnits = /\d+[hms]\b/.test(value);
  const unit = (data.unit && !hasTimeUnits) ? <span className="text-gray-500 ml-1">{data.unit}</span> : null;
  
  return { 
    text: <>{value}{unit}</>, 
    color: "text-gray-900" 
  };
};
