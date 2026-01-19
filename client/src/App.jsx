import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from "react-router-dom"
import './App.css'
import NavBar from './components/NavBar'
import DocumentsPage from './pages/DocumentsPage'
import EditorPage from './pages/EditorPage'

export default function App() {

  const [msg, setMsg] = useState("Loading...")
  const API = import.meta.env.VITE_API_BASE

  useEffect(() => {
    fetch(`${API}/health`)
    .then((r) => r.json())
    .then((d) => setMsg(d.message))
    .catch((() => setMsg("Failed to reach API")))
  }, [])


  return (
    <>
    <Routes>
      <Route path="/" element={<Navigate to="/documents" replace />} />
      <Route path="/documents" element={<DocumentsPage />}/>
      <Route path="/doc/:id" element={<EditorPage />}/>
      <Route path="*" element={<Navigate to={"/documents"} replace/>}/>
    </Routes>
      
    </>
  )
}


