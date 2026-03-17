import { useState, useEffect, useRef } from 'react'
import localforage from 'localforage'

export default function AudioUploader() {
  const [trackName, setTrackName] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(10)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8) // 0.0 to 1.0

  // Core Web Audio references
  const audioCtxRef = useRef(null)
  const gainNodeRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const audioBufferRef = useRef(null) // Caches the decoded audio

  // Playback tracking for pause/resume math
  const trackOffsetRef = useRef(0) 
  const startContextTimeRef = useRef(0) 

  // 1. Initialize the audio context and volume node
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new AudioContext()
      
      // Create a volume node and connect it to the speakers
      gainNodeRef.current = audioCtxRef.current.createGain()
      gainNodeRef.current.connect(audioCtxRef.current.destination)
      gainNodeRef.current.gain.value = volume
    }
    return audioCtxRef.current
  }

  // 2. Update the GainNode whenever the volume state changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    }
  }, [volume])

  // Helper to decode and cache the audio data
  const loadAndDecodeAudio = async (file) => {
    const ctx = initAudio()
    const arrayBuffer = await file.arrayBuffer()
    audioBufferRef.current = await ctx.decodeAudioData(arrayBuffer)
    setTrackName(file.name)
    trackOffsetRef.current = 0 // Reset playback position
  }

  // Check for saved track on mount
  useEffect(() => {
    async function loadSavedTrack() {
      try {
        const savedFile = await localforage.getItem('practice_track')
        if (savedFile) await loadAndDecodeAudio(savedFile)
      } catch (err) {
        console.error('could not load track', err)
      }
    }
    loadSavedTrack()
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      await localforage.setItem('practice_track', file)
      await loadAndDecodeAudio(file)
    } catch (err) {
      console.error('could not save track', err)
    }
  }

  const pausePlayback = () => {
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null

      // Calculate exactly how much time passed since we hit play
      const ctx = audioCtxRef.current
      const timeElapsed = ctx.currentTime - startContextTimeRef.current
      trackOffsetRef.current += timeElapsed
      
      setIsPlaying(false)
    }
  }

  const startPlayback = async (useDelay = false) => {
    const ctx = initAudio()
    if (ctx.state === 'suspended') await ctx.resume()
    if (!audioBufferRef.current) return

    // Stop any currently playing audio before starting new
    pausePlayback() 

    // Silent unlock for mobile background play
    const oscillator = ctx.createOscillator()
    oscillator.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.1)

    // Create a new source node and connect it to our volume node
    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(gainNodeRef.current)
    sourceNodeRef.current = source

    // Schedule the start
    const delay = useDelay ? delaySeconds : 0
    const scheduledStartTime = ctx.currentTime + delay
    
    // start(whenToStart, whereInTrackToStart)
    source.start(scheduledStartTime, trackOffsetRef.current)
    
    // Save the exact context time it started so we can calculate pauses later
    startContextTimeRef.current = scheduledStartTime
    setIsPlaying(true)
  }

  return (
    <section aria-labelledby="upload-heading">
      <h2 id="upload-heading">program music</h2>
      
      <div className="upload-group">
        <label htmlFor="audio-upload">upload your track: </label>
        <input id="audio-upload" type="file" accept="audio/*" onChange={handleUpload} />
      </div>

      {trackName && (
        <div className="controls" style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
          <p aria-live="polite"><strong>loaded:</strong> {trackName}</p>
          
          {/* VOLUME CONTROL */}
          <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label htmlFor="volume-slider">volume</label>
            <input 
              id="volume-slider"
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>

          {/* DELAY SETTINGS */}
          <div style={{ margin: '1rem 0' }}>
            <label htmlFor="delay-input">start delay (seconds): </label>
            <input 
              id="delay-input" 
              type="number" 
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              style={{ width: '60px' }}
            />
          </div>

          {/* PLAYBACK CONTROLS */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {isPlaying ? (
              <button onClick={pausePlayback} aria-label="pause track">pause</button>
            ) : (
              <button onClick={() => startPlayback(false)} aria-label="play track immediately">play</button>
            )}
            
            <button 
              onClick={() => startPlayback(true)} 
              aria-label={`play track with ${delaySeconds} second delay`}
            >
              play (with delay)
            </button>
            
            <button 
              onClick={() => {
                pausePlayback()
                trackOffsetRef.current = 0 // Reset to beginning
              }}
              aria-label="stop and reset track"
            >
              reset
            </button>
          </div>
        </div>
      )}
    </section>
  )
}