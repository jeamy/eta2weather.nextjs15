import React, { useEffect, useState } from 'react';
import { MenuNode } from '@/types/menu';
import { formatValue } from '@/utils/formatters';
import { getAllUris } from '@/utils/etaUtils';
import { useEtaData } from '@/hooks/useEtaData';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface HeizkreisTabProps {
  data: MenuNode[];
}

export const HeizkreisTab: React.FC<HeizkreisTabProps> = ({ data }) => {
  const { values, loading, error, fetchValues, cleanupAllAbortControllers } = useEtaData();
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        <div className="flex items-center px-5 justify-between">
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

  useEffect(() => {
    const fetchAllValues = async () => {
      const heizkreisNode = data.find(node => 
        node.uri === '/120/10101' || 
        node.children?.some(child => child.uri === '/120/10101/0/0/19404')
      );

      if (!heizkreisNode) return;

      // Get all URIs from the menu tree and fetch them in a single batch
      const uris = getAllUris([heizkreisNode]);
      await fetchValues(uris);
    };

    fetchAllValues();
    return cleanupAllAbortControllers;
  }, [data, fetchValues, cleanupAllAbortControllers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const fetchAllValues = async () => {
      const heizkreisNode = data.find(node => 
        node.uri === '/120/10101' || 
        node.children?.some(child => child.uri === '/120/10101/0/0/19404')
      );

      if (!heizkreisNode) return;

      // Get all URIs from the menu tree and fetch them in a single batch
      const uris = getAllUris([heizkreisNode]);
      await fetchValues(uris);
    };
    await fetchAllValues();
    setIsRefreshing(false);
  };

  const heizkreisNode = data.find(node => 
    node.uri === '/120/10101' || 
    node.children?.some(child => child.uri === '/120/10101/0/0/19404')
  );

  if (!heizkreisNode) {
    return <div>No Heizkreis data found</div>;
  }

  return (
    <div className="relative">
      <div className="flex justify-between items-center h-14 mb-4">
        <h2 className="text-lg font-semibold">Heizkreis Data</h2>
        <button 
          onClick={handleRefresh}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          disabled={isRefreshing}
        >
          <ArrowPathIcon 
            className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4 flex-grow">
        <div className="overflow-auto max-h-[600px]">
          <ul className="space-y-2 text-sm">
            {renderMenuItem(heizkreisNode)}
          </ul>
        </div>
      </div>
    </div>
  );
};
