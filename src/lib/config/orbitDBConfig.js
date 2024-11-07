// orbitDBConfig.js
import { createOrbitDB } from '@orbitdb/core'
import { createIPFSNode } from './ipfsConfig';

export const createOrbitDBInstance = async () => {
  const ipfsNode = await createIPFSNode();
  console.log("Ipfs node created", ipfsNode);
  try {
    const orbitdb = await createOrbitDB({
      ipfs: ipfsNode,
      // directory: './orbitdb'
    })
    
    return orbitdb
  } catch (error) {
    console.error('Erreur lors de la création d\'OrbitDB:', error)
    throw error
  }
}