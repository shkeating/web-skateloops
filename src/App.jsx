import { useState } from 'react'
import './App.css'
import AudioUploader from './AudioUploader'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <AudioUploader />
        </section>
    </>
  )
}

export default App
