import { useState, useEffect, useRef } from 'react'
import localforage from 'localforage'

export default function AudioUploader() {
  const [trackName, setTrackName] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(10)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)

  // Core audio references
  const audioCtxRef = useRef(null)
  const gainNodeRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const audioBufferRef = useRef(null)
  const hiddenAudioRef = useRef(null)

  // Playback tracking for pause/resume math
  const trackOffsetRef = useRef(0) 
  const startContextTimeRef = useRef(0) 

  // A tiny 1-second silent WAV file encoded as a data string to keep the OS awake
  const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

  // 1. Initialize the audio context and volume node
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new AudioContext()
      
      gainNodeRef.current = audioCtxRef.current.createGain()
      gainNodeRef.current.connect(audioCtxRef.current.destination)
      gainNodeRef.current.gain.value = volume
    }
    return audioCtxRef.current
  }

  // 2. Sync volume slider with the GainNode
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
    trackOffsetRef.current = 0 
  }

  // 3. Check for saved track on mount
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

  // 4. Handle new uploads
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

  // 5. Playback Controls
const pausePlayback = () => {
    // Rely only on the ref, which avoids the stale closure trap
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null

      const ctx = audioCtxRef.current
      trackOffsetRef.current += (ctx.currentTime - startContextTimeRef.current)
      
      // Only call pause if it isn't already paused 
      // (prevents infinite loops with the native event listener we are adding next)
      if (hiddenAudioRef.current && !hiddenAudioRef.current.paused) {
        hiddenAudioRef.current.pause()
      }
      
      setIsPlaying(false)
    }
  }

  const startPlayback = async (useDelay = false) => {
    // 1. FIRE THIS IMMEDIATELY BEFORE ANY AWAIT CALLS
    // this locks in the user gesture token for the android os
    if (hiddenAudioRef.current) {
      hiddenAudioRef.current.play().catch(err => console.log('silent play blocked:', err))
    }

    const ctx = initAudio()
    // 2. now we can safely await the web audio api stuff
    if (ctx.state === 'suspended') await ctx.resume()
    
    if (!audioBufferRef.current) {
      alert("audio is still decoding or missing. please try again.")
      return
    }

    // pause any existing web audio tracks
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
      trackOffsetRef.current += (ctx.currentTime - startContextTimeRef.current)
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(gainNodeRef.current)
    sourceNodeRef.current = source

    const delay = useDelay ? delaySeconds : 0
    const scheduledStartTime = ctx.currentTime + delay
    
    source.start(scheduledStartTime, trackOffsetRef.current)
    
    startContextTimeRef.current = scheduledStartTime
    setIsPlaying(true)
  }

  const resetPlayback = () => {
    pausePlayback()
    trackOffsetRef.current = 0
  }

  // 6. Media Session API for lock screen and smartwatch
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackName || 'Ready to Skate',
        artist: 'Practice Player',
        artwork: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      })

      navigator.mediaSession.setActionHandler('play', () => startPlayback(false))
      navigator.mediaSession.setActionHandler('pause', () => pausePlayback())
    }
  }, [trackName])

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }
  }, [isPlaying])

  return (
    <section aria-labelledby="upload-heading" style={{ maxWidth: '400px', margin: '0 auto', padding: '1rem' }}>
      <h2 id="upload-heading">Program Music</h2>
      
      {/* Hidden audio element to keep the background process alive */}
      <audio 
  ref={hiddenAudioRef} 
  src="/silence.mp3" 
  loop 
  playsInline 
  aria-hidden="true" 
  style={{ display: 'none' }} 
/>
      
      <div className="upload-group" style={{ marginBottom: '2rem' }}>
        <label htmlFor="audio-upload" style={{ display: 'block', marginBottom: '0.5rem' }}>Upload your track:</label>
        <input 
          id="audio-upload" 
          type="file" 
          accept="audio/*" 
          onChange={handleUpload} 
          style={{ width: '100%' }}
        />
      </div>

      {trackName && (
        <div className="controls" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <p aria-live="polite" style={{ marginTop: 0 }}><strong>Loaded:</strong> {trackName}</p>
          
          <div style={{ margin: '1.5rem 0' }}>
            <label htmlFor="volume-slider" style={{ display: 'block', marginBottom: '0.5rem' }}>Volume</label>
            <input 
              id="volume-slider"
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ margin: '1.5rem 0' }}>
            <label htmlFor="delay-input" style={{ display: 'block', marginBottom: '0.5rem' }}>Start Delay (seconds): </label>
            <input 
              id="delay-input" 
              type="number" 
              min="0"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              style={{ width: '80px', padding: '0.25rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              onClick={() => startPlayback(true)} 
              aria-label={`Play track with ${delaySeconds} second delay`}
              style={{ padding: '0.75rem', fontWeight: 'bold' }}
            >
              Play with {delaySeconds}s Delay
            </button>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isPlaying ? (
                <button onClick={pausePlayback} style={{ flex: 1, padding: '0.5rem' }}>Pause</button>
              ) : (
                <button onClick={() => startPlayback(false)} style={{ flex: 1, padding: '0.5rem' }}>Play (Instant)</button>
              )}
              <button onClick={resetPlayback} style={{ flex: 1, padding: '0.5rem' }}>Reset</button>
            </div>
          </div>
        </div>
      )}

       <p style={{marginTop: '20px'}}>If you are on iOS spend the $2 on <a href="https://apps.apple.com/us/app/skateloops-mp3-practice-app/id6476055748">the SkateLoops App</a> by Shauna Lynn. It's better, trust me!! This is just to tide us over until she gets around to releasing an Android version.</p>
      
    </section>
  )
}