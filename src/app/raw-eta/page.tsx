'use client'
import { useState, useEffect } from 'react'

export default function RawEtaPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/eta/raw')
        const result = await response.json()
        
        if (result.success) {
          setData(result.data)
        } else {
          throw new Error(result.error || 'Failed to fetch data')
        }
      } catch (error) {
        console.error('Error:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])
  
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
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Raw ETA Data</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/10 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Menu Structure</h2>
          <pre className="whitespace-pre-wrap overflow-x-auto text-sm">
            {JSON.stringify(data.menuItems, null, 2)}
          </pre>
        </div>
        <div className="bg-white/10 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Raw Values</h2>
          <pre className="whitespace-pre-wrap overflow-x-auto text-sm">
            {JSON.stringify(data.rawData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
