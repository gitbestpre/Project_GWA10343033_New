import { KnowledgePage } from '../data/knowledgeData'

interface ContentViewerProps {
  page: KnowledgePage
  currentPageIndex: number
  totalPages: number
  onPrevPage: () => void
  onNextPage: () => void
}

export default function ContentViewer({ page, currentPageIndex, totalPages, onPrevPage, onNextPage }: ContentViewerProps) {
  return (
    <div className="content-viewer">
      <button
        className="nav-arrow prev"
        onClick={onPrevPage}
        disabled={currentPageIndex === 0}
      >
        ‹
      </button>

      <div className="content-area">
        <div className="content-text">
          {page.content.split('\n').map((line, idx) => {
            if (line.startsWith('## ')) {
              return <h2 key={idx}>{line.replace('## ', '')}</h2>
            }
            if (line.startsWith('### ')) {
              return <h3 key={idx}>{line.replace('### ', '')}</h3>
            }
            if (line.startsWith('- **')) {
              const match = line.match(/- \*\*(.+?)\*\*(.+)/)
              if (match) {
                return <p key={idx} className="list-item"><strong>{match[1]}</strong>{match[2]}</p>
              }
            }
            if (line.startsWith('- ')) {
              return <p key={idx} className="list-item">{line.replace('- ', '')}</p>
            }
            if (line.match(/^\d+\./)) {
              return <p key={idx} className="list-item">{line}</p>
            }
            if (line.trim() === '') {
              return <br key={idx} />
            }
            return <p key={idx}>{line}</p>
          })}
        </div>
      </div>

      <button
        className="nav-arrow next"
        onClick={onNextPage}
        disabled={currentPageIndex >= totalPages - 1}
      >
        ›
      </button>
    </div>
  )
}
