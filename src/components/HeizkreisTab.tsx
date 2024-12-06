import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MenuNode } from '@/types/menu';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { formatValue } from '@/utils/formatters';

interface HeizkreisTabProps {
  data: MenuNode[];
}

export const HeizkreisTab: React.FC<HeizkreisTabProps> = ({ data }) => {
  const [values, setValues] = useState<Record<string, ParsedXmlData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const cleanupAbortController = useCallback((uri: string) => {
    if (abortControllersRef.current[uri]) {
      abortControllersRef.current[uri].abort();
      delete abortControllersRef.current[uri];
    }
  }, []);

  const cleanupAllAbortControllers = useCallback(() => {
    Object.keys(abortControllersRef.current).forEach(cleanupAbortController);
  }, [cleanupAbortController]);

  const fetchValue = useCallback(async (uri: string) => {
    if (!uri) return;
    
    cleanupAbortController(uri);
    
    const abortController = new AbortController();
    abortControllersRef.current[uri] = abortController;
    
    setLoading(prev => ({ ...prev, [uri]: true }));
    setError(prev => ({ ...prev, [uri]: '' }));
    
    try {
      const response = await fetch(
        `/api/eta/readMenuData?uri=${encodeURIComponent(uri)}`,
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!abortController.signal.aborted) {
        if (result.success && result.data) {
          setValues(prev => ({ ...prev, [uri]: result.data }));
        } else {
          throw new Error(result.error || 'Failed to fetch data');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(prev => ({ ...prev, [uri]: errorMessage }));
        console.error('Error fetching value for URI:', uri, 'Error:', error);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(prev => ({ ...prev, [uri]: false }));
      }
      cleanupAbortController(uri);
    }
  }, [cleanupAbortController]);

  const renderValue = (uri: string) => {
    if (loading[uri]) return <span className="text-gray-400">Loading...</span>;
    if (error[uri]) return <span className="text-red-500">{error[uri]}</span>;
    if (values[uri]) {
      const formattedValue = formatValue(values[uri]);
      return <span className={formattedValue.color}>{formattedValue.text}</span>;
    }
    return null;
  };

  const renderMenuItem = (node: MenuNode, level: number = 0) => {
    return (
      <li key={node.uri} className={`font-medium text-gray-800 ${level > 0 ? 'mt-2' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-blue-600">{node.name}</span>
            <span className="text-gray-500 text-xs ml-2">{node.uri}</span>
          </div>
          {renderValue(node.uri)}
        </div>
        {node.children && node.children.length > 0 && (
          <ul className={`pl-4 mt-2 space-y-2 ${level > 0 ? 'border-l-2 border-gray-200' : ''}`}>
            {node.children.map(child => renderMenuItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  const getAllUris = (node: MenuNode): string[] => {
    const uris = [node.uri];
    if (node.children) {
      node.children.forEach(child => {
        uris.push(...getAllUris(child));
      });
    }
    return uris;
  };

  useEffect(() => {
    const fetchAllValues = async () => {
      const heizkreisNode = data.find(node => 
        node.uri === '/120/10101' || 
        node.children?.some(child => child.uri === '/120/10101/0/0/19404')
      );

      if (!heizkreisNode) return;

      // Clear previous state when data changes
      setValues({});
      setLoading({});
      setError({});
      cleanupAllAbortControllers();

      // Get all URIs from the menu tree
      const urisToFetch = getAllUris(heizkreisNode);

      // Fetch values sequentially with a small delay
      for (const uri of urisToFetch) {
        await fetchValue(uri);
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    fetchAllValues();
    
    return () => {
      cleanupAllAbortControllers();
    };
  }, [data, fetchValue, cleanupAllAbortControllers]);

  const heizkreisNode = data.find(node => 
    node.uri === '/120/10101' || 
    node.children?.some(child => child.uri === '/120/10101/0/0/19404')
  );

  if (!heizkreisNode) {
    return <div>No Heizkreis data found</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex-grow">
      <h2 className="text-lg font-semibold mb-4">Heizkreis Data</h2>
      <div className="overflow-auto max-h-[600px]">
        <ul className="space-y-2 text-sm">
          {renderMenuItem(heizkreisNode)}
        </ul>
      </div>
    </div>
  );
};
