import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { MenuNode } from '@/types/menu';
import { formatValue } from '@/utils/formatters';
import { getAllUris } from '@/utils/etaUtils';
import { useEtaData } from '@/hooks/useEtaData';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
// Read-only view: no update imports

interface HeizkreisTabProps {
  data: MenuNode[];
}

export const HeizkreisTab: React.FC<HeizkreisTabProps> = ({ data }) => {
  const { values, loading, error, fetchValues, cleanupAllAbortControllers } = useEtaData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Read-only: no editing/saving state

  // Find the Heizkreis root node only once per data change
  const heizkreisNode = useMemo(() => {
    return data.find(node =>
      node.uri === '/120/10101' ||
      node.children?.some(child => child.uri === '/120/10101/0/0/19404')
    );
  }, [data]);

  // Collect URIs for that subtree and keep stable
  const heizkreisUris = useMemo(() => {
    return heizkreisNode ? getAllUris([heizkreisNode]) : [];
  }, [heizkreisNode]);

  const isFetchingAny = useMemo(() => {
    if (!heizkreisUris.length) return false;
    return heizkreisUris.some(u => loading[u]);
  }, [heizkreisUris, loading]);

  const renderValue = useCallback((uri: string) => {
    if (loading[uri]) return <span className="text-gray-400">Loading...</span>;
    if (error[uri]) return <span className="text-red-500">{error[uri]}</span>;
    if (values[uri]) {
      const formattedValue = formatValue(values[uri]);
      return <span className={formattedValue.color}>{formattedValue.text}</span>;
    }
    return null;
  }, [loading, error, values]);

  const renderMenuItem = useCallback((node: MenuNode, level: number = 0) => {
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
  }, [renderValue]);

  useEffect(() => {
    if (!heizkreisUris.length) return;
    fetchValues(heizkreisUris);
    return cleanupAllAbortControllers;
  }, [heizkreisUris, fetchValues, cleanupAllAbortControllers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (heizkreisUris.length) {
      await fetchValues(heizkreisUris);
    }
    setIsRefreshing(false);
  };

  if (!heizkreisNode) {
    return (
      <div className="card">
        <div className="alert alert--warning">No Heizkreis data found</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center h-14 mb-2 card__header">
        <h2 className="text-lg font-semibold">Heizkreis Data</h2>
        <button
          onClick={handleRefresh}
          className="btn btn--ghost"
          disabled={isRefreshing}
          title="Refresh"
        >
          <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="flex-grow">
        <div className="overflow-auto max-h-[600px]">
          {isFetchingAny && (
            <div className="alert alert--warning mb-2">Aktualisiere Werte...</div>
          )}
          <ul className="space-y-2 text-sm">
            {renderMenuItem(heizkreisNode)}
          </ul>
        </div>
      </div>
    </div>
  );
};
