import { DOMParser } from '@xmldom/xmldom';
import { MenuNode } from '@/types/menu';

function isElement(node: any): boolean {
  return node?.nodeType === 1;
}

function toMenuNode(element: any): MenuNode | null {
  const uri = element.getAttribute('uri') || '';
  const name = element.getAttribute('name') || '';
  if (!uri || !name) {
    return null;
  }

  const children = Array.from(element.childNodes || [])
    .filter(isElement)
    .map(toMenuNode)
    .filter((node): node is MenuNode => node !== null);

  return {
    uri,
    name,
    ...(children.length ? { children } : { children: [] }),
  };
}

export function parseEtaMenuXml(xmlString: string): MenuNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error(parserError.textContent || 'Invalid ETA menu XML');
  }

  const menuElement = Array.from(doc.getElementsByTagName('*') as any).find((element: any) => element.localName === 'menu');
  if (!menuElement) {
    return [];
  }

  return Array.from((menuElement as any).childNodes || [])
    .filter(isElement)
    .map(toMenuNode)
    .filter((node): node is MenuNode => node !== null);
}
