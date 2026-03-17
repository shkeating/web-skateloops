import { useState, useEffect } from 'react'
import localforage from 'localforage'

export default function AudioUploader() {
  const [trackUrl, setTrackUrl] = useState(null)
  const [trackName, setTrackName] = useState('')

  // 1. check if a track is already saved when the app first loads
  useEffect(() => {
    async function loadSavedTrack() {
      try {
        const savedFile = await localforage.getItem('practice_track')
        if (savedFile) {
          // turn the saved blob back into a usable url
          const url = URL.createObjectURL(savedFile)
          setTrackUrl(url)
          setTrackName(savedFile.name)
        }
      } catch (err) {
        console.error('could not load track from storage', err)
      }
    }
    loadSavedTrack()
  }, [])

  // 2. handle new uploads and save them to indexeddb
  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      // save the raw file directly to the device memory
      await localforage.setItem('practice_track', file)
      
      const url = URL.createObjectURL(file)
      setTrackUrl(url)
      setTrackName(file.name)
    } catch (err) {
      console.error('could not save track', err)
    }
  }

  return (
    <section aria-labelledby="upload-heading">
      <h2 id="upload-heading">program music</h2>
      
      <div className="upload-group">
        <label htmlFor="audio-upload">upload your track (mp3, wav, m4a)</label>
        <input 
          id="audio-upload" 
          type="file" 
          accept="audio/*" 
          onChange={handleUpload} 
        />
      </div>

      {trackUrl && (
        <div className="player-test" style={{ marginTop: '2rem' }}>
          <p aria-live="polite">loaded: {trackName}</p>
          
          {/* standard audio tag just to verify the file plays locally. 
              we will swap this out for the custom web audio api later. */}
          <audio controls src={trackUrl}>
            your browser does not support the audio element.
          </audio>
        </div>
      )}
    </section>
  )
}