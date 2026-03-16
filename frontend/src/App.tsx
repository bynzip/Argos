function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-extrabold tracking-tight">Argos ERP</h1>
        <p className="text-slate-400 text-xl max-w-lg mx-auto">
          Frontend inicializado con Vite + TS + Tailwind. 
          Listo para el equipo de desarrollo JS.
        </p>
        <div className="flex justify-center gap-4">
          <code className="bg-slate-800 px-3 py-1 rounded text-sm text-blue-400">/src/modules</code>
          <code className="bg-slate-800 px-3 py-1 rounded text-sm text-green-400">/src/components</code>
        </div>
      </div>
    </div>
  )
}

export default App
