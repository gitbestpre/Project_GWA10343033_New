import { KnowledgeModule } from '../data/knowledgeData'

interface ModuleTabsProps {
  modules: KnowledgeModule[]
  currentModuleId: string
  onModuleChange: (moduleId: string) => void
}

export default function ModuleTabs({ modules, currentModuleId, onModuleChange }: ModuleTabsProps) {
  return (
    <div className="module-tabs">
      {modules.map(module => (
        <button
          key={module.id}
          className={`module-tab ${module.id === currentModuleId ? 'active' : ''}`}
          onClick={() => onModuleChange(module.id)}
        >
          {module.name}
        </button>
      ))}
    </div>
  )
}
