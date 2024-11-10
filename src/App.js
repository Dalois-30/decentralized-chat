import { useState, useEffect } from 'react'
import UserCRUD from './components/user.jsx'
// import { createIPFSNode } from './lib/config/ipfsConfig'

function App() {
  const [ipfsNode, setIpfsNode] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          Gestion des Utilisateurs avec IPFS
        </h1>
        {<UserCRUD />}
      </div>
    </div>
  )
}

export default App