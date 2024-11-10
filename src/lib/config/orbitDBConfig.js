import { createOrbitDB } from '@orbitdb/core'
import { createIPFSNode } from './ipfsConfig'

export const createOrbitDBInstance = async () => {
  try {
    const ipfsNode = await createIPFSNode()
    
    const orbitdb = await createOrbitDB({
      ipfs: ipfsNode,
      directory: './orbitdb'
    })

    // Créer et ouvrir la base de données directement
    const db = await orbitdb.open('users', {
      type: 'docstore',  // Utiliser docstore au lieu de documents
      indexBy: 'id',
      // Autres options importantes
      accessController: {
        write: ['*']  // Permet à tous d'écrire
      }
    })

    // Charger les données existantes
    await db.load()
    
    return db  // Retourner directement la base de données
  } catch (error) {
    console.error('Erreur lors de la création d\'OrbitDB:', error)
    throw error
  }
}