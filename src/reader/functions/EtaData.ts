import { ParsedXmlData } from './types-constants/EtaConstants';

export function parseXML(xmlData: string, uri: string, parentId: string | null): ParsedXmlData {
  // Basic XML parsing for demonstration
  // In a real implementation, you would want to use a proper XML parser
  const getValue = (xml: string): string => {
    const match = xml.match(/<value>(.*?)<\/value>/);
    return match ? match[1] : '';
  };

  const getUnit = (xml: string): string => {
    const match = xml.match(/<unit>(.*?)<\/unit>/);
    return match ? match[1] : '';
  };

  const value = getValue(xmlData);
  const unit = getUnit(xmlData);

  return {
    id: uri,
    parentId,
    value: value,
    unit: unit,
    strValue: value,
  };
}
