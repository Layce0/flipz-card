import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold">Workflow Mobile</h2>
          <p className="text-xs text-zinc-400 mt-1">{user.email}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400">Projects</h3>
            <button className="text-zinc-400 hover:text-white transition-colors">
              +
            </button>
          </div>
          
          <ul className="space-y-2">
            {projects?.length === 0 ? (
              <li className="text-sm text-zinc-500">No projects found.</li>
            ) : (
              projects?.map((project) => (
                <li key={project.id} className="group flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{project.name}</span>
                    <span className="text-xs text-zinc-500">{project.platform}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            🚀
          </div>
          <h1 className="text-2xl font-bold mb-2">Select a Project</h1>
          <p className="text-zinc-400 max-w-sm">
            Choose a project from the sidebar or create a new one to view builds, files, and AI analysis.
          </p>
        </div>
      </main>
    </div>
  )
}
