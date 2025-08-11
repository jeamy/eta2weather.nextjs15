'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MenuNode } from '@/types/menu'
import React from 'react'
import useSWR from 'swr'

interface RawData {
  menuItems: MenuNode[]
  rawData: Record<string, string>
}

interface ParsedValue {
  value: string
  strValue: string
  unit: string
  [key: string]: any
}

interface CachedData {
  data: RawData
  timestamp: number
}

// Cache duration in milliseconds (1 minute)
const CACHE_DURATION = 60 * 1000

export default function RawEtaPage() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [lastFetch, setLastFetch] = useState<number>(0)
  const [fallbackData, setFallbackData] = useState<RawData | undefined>(undefined)
  // Simple cache for parsed XML to avoid re-parsing on toggle
  const parseCacheRef = useRef<Map<string, ParsedValue>>(new Map())

  // SWR fetcher and setup
  const fetcher = useCallback(async (url: string): Promise<RawData> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const result = await response.json()
    if (!result?.success) throw new Error(result?.error || 'Failed to fetch data')
    return result.data as RawData
  }, [])

  // Load fallback snapshot from localStorage on mount
  useEffect(() => {
    const cachedStr = localStorage.getItem('rawEtaData')
    if (cachedStr) {
      try {
        const cached: CachedData = JSON.parse(cachedStr)
        setFallbackData(cached.data)
        setLastFetch(cached.timestamp)
      } catch (error) {
        console.warn('Error reading cache:', error)
      }
    }
  }, [])

  const { data, error, isLoading, mutate, isValidating } = useSWR<RawData>(
    '/api/eta/raw',
    fetcher,
    {
      refreshInterval: CACHE_DURATION,
      revalidateOnFocus: true,
      dedupingInterval: 30000,
      fallbackData,
    }
  )

  // Reset parse cache when dataset changes
  useEffect(() => {
    parseCacheRef.current.clear()
  }, [data])

  // Persist fresh data to localStorage with timestamp
  useEffect(() => {
    if (data) {
      const now = Date.now()
      setLastFetch(now)
      const cacheData: CachedData = { data, timestamp: now }
      try {
        localStorage.setItem('rawEtaData', JSON.stringify(cacheData))
      } catch (error) {
        console.warn('Error writing cache:', error)
      }
    }
  }, [data])

  const toggleNode = (uri: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(uri)) {
        newSet.delete(uri)
      } else {
        newSet.add(uri)
      }
      return newSet
    })
  }

  const parseXmlValue = (xmlString: string): ParsedValue => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
      const valueElement = xmlDoc.getElementsByTagName('value')[0]
      
      const result: ParsedValue = {
        value: valueElement?.textContent || 'N/A',
        strValue: valueElement?.getAttribute('strValue') || 'N/A',
        unit: valueElement?.getAttribute('unit') || '',
      }

      // Add all attributes
      Array.from(valueElement?.attributes || []).forEach(attr => {
        result[attr.name] = attr.value
      })

      return result
    } catch (error) {
      console.error('Error parsing XML:', error)
      return {
        value: 'Error parsing XML',
        strValue: 'Error',
        unit: ''
      }
    }
  }

  const renderPrepared = (uri: string, xmlValue: string) => {
    const isExpanded = expandedNodes.has(uri)

    // Only parse XML when expanded; use a small cache keyed by the XML string
    let parsedValue: ParsedValue | null = null
    if (isExpanded) {
      const cache = parseCacheRef.current
      parsedValue = cache.get(xmlValue) || null
      if (!parsedValue) {
        parsedValue = parseXmlValue(xmlValue)
        cache.set(xmlValue, parsedValue)
      }
    }

    return (
      <div key={uri} className="border-b border-gray-700 py-2">
        <div 
          className="flex items-center cursor-pointer hover:bg-white/5 p-2 rounded"
          onClick={() => toggleNode(uri)}
        >
          <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
          <div className="flex-1">
            <span className="font-mono text-sm">{uri}</span>
            {menuMap[uri] && (
              <span className="ml-2 text-sm text-gray-400">({menuMap[uri]})</span>
            )}
          </div>
        </div>
        {isExpanded && parsedValue && (
          <div className="ml-6 mt-2 space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-gray-400">Value:</div>
              <div>{parsedValue.value}</div>
              <div className="text-gray-400">String Value:</div>
              <div>{parsedValue.strValue}</div>
              {parsedValue.unit && (
                <>
                  <div className="text-gray-400">Unit:</div>
                  <div>{parsedValue.unit}</div>
                </>
              )}
              {Object.entries(parsedValue)
                .filter(([key]) => !['value', 'strValue', 'unit'].includes(key))
                .map(([key, value]) => (
                  <React.Fragment key={key}>
                    <div className="text-gray-400">{key}:</div>
                    <div>{value}</div>
                  </React.Fragment>
                ))}
            </div>
            <div className="mt-2 bg-black/20 p-2 rounded">
              <pre className="text-xs overflow-x-auto">{xmlValue}</pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Build menu map from tree
  const addNodeToMap = useCallback((node: MenuNode, map: Record<string, string>) => {
    if (node.uri) {
      map[node.uri] = node.name
    }
    if (node.children) {
      node.children.forEach(child => addNodeToMap(child, map))
    }
  }, [])

  const menuMap = useMemo(() => {
    if (!data?.menuItems) return {}
    const map: Record<string, string> = {}
    data.menuItems.forEach(node => addNodeToMap(node, map))
    return map
  }, [data?.menuItems, addNodeToMap])

  // Prepare filtered items before any early returns to keep hook order stable
  const filteredItems = useMemo(() => {
    if (!data) return [] as { uri: string; xml: string }[]
    const searchLower = searchTerm.toLowerCase()
    return Object.entries(data.rawData)
      .filter(([uri]) => {
        const uriMatch = uri.toLowerCase().includes(searchLower)
        const nameMatch = (menuMap[uri] || '').toLowerCase().includes(searchLower)
        return uriMatch || nameMatch
      })
      .map(([uri, xml]) => ({ uri, xml }))
  }, [data, searchTerm, menuMap])

  if (isLoading && !data) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-red-500">Error: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Raw ETA Data</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search URIs or names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 rounded bg-white/10 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            <button
              onClick={() => mutate()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              title="Refresh data"
            >
              {isValidating ? '…' : '⟳'}
            </button>
          </div>
          <div className="text-xs text-gray-400">
            {lastFetch ? new Date(lastFetch).toLocaleString('de-DE') : ''}
          </div>
          <button
            onClick={() => setExpandedNodes(new Set(Object.keys(data?.rawData || {})))}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm whitespace-nowrap"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedNodes(new Set())}
            className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-700 text-sm whitespace-nowrap"
          >
            Collapse All
          </button>
        </div>
      </div>
      
      {/* Change to vertical layout on mobile/tablet, horizontal on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Raw Values Section - Full width on mobile/tablet */}
        <div className="bg-white/10 p-4 rounded-lg order-1">
          <h2 className="text-xl font-semibold mb-4">Raw Values</h2>
          <div className="space-y-1">
            {filteredItems.map((item) => renderPrepared(item.uri, item.xml))}
          </div>
        </div>
        {/* Menu Structure Section - Below on mobile/tablet, right side on desktop */}
        <div className="bg-white/10 p-4 rounded-lg order-2">
          <h2 className="text-xl font-semibold mb-4">Menu Structure</h2>
          <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {data?.menuItems.map((category, index) => (
              <div key={index} className="border-b border-gray-700 last:border-0 pb-2">
                <div className="font-medium text-lg mb-2">{category.name}</div>
                {category.children && (
                  <div className="ml-4 space-y-1">
                    {category.children.map((item, itemIndex) => (
                      <div key={itemIndex} className="text-sm">
                        <div className="flex items-center">
                          <span className="text-gray-400 mr-2">•</span>
                          <span>{item.name}</span>
                          {item.uri && (
                            <span className="ml-2 text-xs text-gray-500">{item.uri}</span>
                          )}
                        </div>
                        {item.children && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.children.map((subItem, subIndex) => (
                              <div key={subIndex} className="text-sm flex items-center">
                                <span className="text-gray-400 mr-2">-</span>
                                <span>{subItem.name}</span>
                                {subItem.uri && (
                                  <span className="ml-2 text-xs text-gray-500">{subItem.uri}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
