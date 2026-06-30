import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReports } from '../../api/reports'
import { DailyReportCard } from '../../components/reports/DailyReportCard'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'

export const ReportsPage: React.FC = () => {
  
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['reports'], queryFn: getReports })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Daily Reports</h2>
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" description="Reports appear here after L3 departments submit them." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => <DailyReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  )
}
