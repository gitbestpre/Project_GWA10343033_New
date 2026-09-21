import { createRoot } from 'react-dom/client'
import React, { useState } from 'react'
import SamplingToolsScene from './src/components/player/SamplingToolsScene'
import SampleTypeHintModal from './src/components/player/SampleTypeHintModal'
import KitchenDoneModal from './src/components/player/KitchenDoneModal'
import './src/pages/FoodHygienePlayer.css'
import './src/pages/EpidemiologyPlayer.css'

function Harness() {
  const scenario = location.hash.replace('#', '') || 'tools'
  const [complete, setComplete] = useState(false)
  ;(window as any).__setComplete = (v: boolean) => setComplete(v)
  ;(window as any).__complete = complete

  if (scenario === 'sampleType') {
    return <SampleTypeHintModal onConfirm={() => ((window as any).__confirmed = true)} />
  }
  if (scenario === 'kitchenDone') {
    return <KitchenDoneModal onAck={() => ((window as any).__ack = true)} />
  }
  // tools：采样工具场景，采样15 结束触发完成回调
  return (
    <SamplingToolsScene
      onSamplingComplete={() => {
        ;(window as any).__samplingComplete = true
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
