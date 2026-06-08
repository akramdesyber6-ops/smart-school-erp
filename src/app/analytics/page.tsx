'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import apiClient from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'

interface Analytics {
  students: any
  attendance: any
  fees: any
  exams: any
  teachers: any
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { isAuthenticated, signOut } = useAuth()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    fetchAnalytics()
  }, [isAuthenticated])

  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.get('/analytics')
      setAnalytics(response.data.data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading analytics...</div>
  }

  if (!analytics) {
    return <div className="flex items-center justify-center min-h-screen">Failed to load analytics</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-2xl font-bold text-primary">📚 Smart School ERP</div>
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/dashboard')} variant="outline">
              Dashboard
            </Button>
            <Button onClick={signOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">School Analytics</h1>

        {/* Student Analytics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Student Statistics</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics.students.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{analytics.students.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{analytics.students.inactive}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Attendance Analytics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Today's Attendance</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Present</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{analytics.attendance.present}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Absent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{analytics.attendance.absent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Late</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{analytics.attendance.late}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics.attendance.rate}%</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Fee Analytics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Fee Management</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.fees.collected)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(analytics.fees.outstanding)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics.fees.transactions}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Exam Analytics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Exam Statistics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics.exams.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Graded</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{analytics.exams.graded}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Teacher Analytics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Teacher Statistics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analytics.teachers.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{analytics.teachers.active}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
