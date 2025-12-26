import { Toaster } from "@/components/ui/toaster"
import React from 'react'
import Layout from './components/Layout'
import './toastStyles.css'
import './App.css'

function App() {
  return (
    <>
      <Layout />
      <Toaster />
    </>
  )
}

export default App