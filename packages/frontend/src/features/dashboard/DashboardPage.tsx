// React import not needed for JSX in modern React apps

export function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">GRC Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Risk Assessments</h2>
          <p className="text-gray-600">Monitor and manage risk assessments across your organization.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Compliance Status</h2>
          <p className="text-gray-600">Track compliance status and regulatory requirements.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">AI Agents</h2>
          <p className="text-gray-600">Manage AI-powered GRC automation agents.</p>
        </div>
      </div>
    </div>
  )
}