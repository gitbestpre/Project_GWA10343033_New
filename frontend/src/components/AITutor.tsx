import { useState, useRef } from 'react'

export default function AITutor() {
  const [isMuted, setIsMuted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleTogglePause = () => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play()
      } else {
        videoRef.current.pause()
      }
      setIsPaused(!isPaused)
    }
  }

  return (
    <div className="ai-tutor">
      <div className="tutor-video-container">
        <video
          ref={videoRef}
          className="tutor-video"
          autoPlay
          loop
          muted={isMuted}
          poster="/images/ai-tutor-poster.jpg"
        >
          <source src="/videos/ai-tutor.mp4" type="video/mp4" />
          您的浏览器不支持视频播放
        </video>

        <div className="video-controls">
          <button className="control-btn" onClick={handleToggleMute}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button className="control-btn" onClick={handleTogglePause}>
            {isPaused ? '▶' : '⏸'}
          </button>
        </div>
      </div>
    </div>
  )
}
