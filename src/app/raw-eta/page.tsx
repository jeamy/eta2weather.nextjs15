'use client'
import { useState, useEffect, useCallback } from 'react'
import { MenuNode } from '@/types/menu'
import React from 'react'

interface RawData {
  menuItems: MenuNode[]
  rawData: Record<string, any>
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
  const [data, setData] = useState<RawData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [menuMap, setMenuMap] = useState<Record<string, string>>({})
  const [lastFetch, setLastFetch] = useState<number>(0)

  const fetchData = useCallback(async (force: boolean = false) => {
    const now = Date.now()
    
    // Check cache first
    const cachedStr = localStorage.getItem('rawEtaData')
    if (!force && cachedStr) {
      try {
        const cached: CachedData = JSON.parse(cachedStr)
        if (now - cached.timestamp < CACHE_DURATION) {
          setData(cached.data)
          // Create menu map from cached data
          const map: Record<string, string> = {}
          const processMenuNode = (node: MenuNode) => {
            if (node.uri) {
              map[node.uri] = node.name
            }
            if (node.children) {
              node.children.forEach(processMenuNode)
            }
          }
          cached.data.menuItems.forEach(processMenuNode)
          setMenuMap(map)
          setLoading(false)
          setLastFetch(cached.timestamp)
          return
        }
      } catch (error) {
        console.warn('Error reading cache:', error)
      }
    }

    try {
      setLoading(true)
      const response = await fetch('/api/eta/raw')
      const result = await response.json()
      
      if (result.success) {
        // Create menu map
        const map: Record<string, string> = {}
        const processMenuNode = (node: MenuNode) => {
          if (node.uri) {
            map[node.uri] = node.name
          }
          if (node.children) {
            node.children.forEach(processMenuNode)
          }
        }
        result.data.menuItems.forEach(processMenuNode)
        
        // Update state and cache
        setData(result.data)
        setMenuMap(map)
        setLastFetch(now)
        
        // Cache the data
        const cacheData: CachedData = {
          data: result.data,
          timestamp: now
        }
        localStorage.setItem('rawEtaData', JSON.stringify(cacheData))
      } else {
        throw new Error(result.error || 'Failed to fetch data')
      }
    } catch (error) {
      console.error('Error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    
    // Set up refresh interval
    const interval = setInterval(() => {
      fetchData(true)
    }, CACHE_DURATION)

    return () => clearInterval(interval)
  }, [fetchData])

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

  const renderValue = (uri: string, xmlValue: string) => {
    const parsedValue = parseXmlValue(xmlValue)
    const isExpanded = expandedNodes.has(uri)

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
        {isExpanded && (
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

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  const filteredData = data ? Object.entries(data.rawData).filter(([uri]) => {
    const searchLower = searchTerm.toLowerCase()
    const uriMatch = uri.toLowerCase().includes(searchLower)
    const nameMatch = menuMap[uri]?.toLowerCase().includes(searchLower)
    return uriMatch || nameMatch
  }) : []

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
              onClick={() => fetchData(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              title="Refresh data"
            >
              ⟳
            </button>
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
            {filteredData.map(([uri, value]) => renderValue(uri, value))}
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
