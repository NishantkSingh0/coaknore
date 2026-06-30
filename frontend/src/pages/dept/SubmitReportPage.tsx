import React from 'react'
import { ReportForm } from '../../components/reports/ReportForm'

export const SubmitReportPage: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-gray-900">Submit Daily Report</h2>
      <p className="text-sm text-gray-500 mt-1">
        Submitting a report automatically marks your attendance for today.
        Reports cannot be submitted on Sundays.
      </p>
    </div>
    <ReportForm />
  </div>
)
