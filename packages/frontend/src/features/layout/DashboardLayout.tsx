// React import not needed for JSX in modern React apps
import { Outlet } from 'react-router-dom'

export function DashboardLayout() {
  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-gray-900 text-white p-4">
        <h1 className="text-xl font-bold mb-8">GRC Dashboard</h1>
        <ul className="space-y-2">
          <li>
            <a href="/" className="block py-2 px-4 rounded hover:bg-gray-700">
              Dashboard
            </a>
          </li>
          <li>
            <a href="/agents" className="block py-2 px-4 rounded hover:bg-gray-700">
              Agents
            </a>
          </li>
          <li>
            <a href="/settings" className="block py-2 px-4 rounded hover:bg-gray-700">
              Settings
            </a>
          </li>
        </ul>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}