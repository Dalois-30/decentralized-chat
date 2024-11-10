import { createHelia } from 'helia'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createLibp2p } from 'libp2p'

export const createIPFSNode = async () => {
  try {
    // Configuration de libp2p
    const libp2p = await createLibp2p({
      transports: [webSockets()],
      streamMuxers: [yamux()],
      connectionEncryption: [noise()],
      services: {
        pubsub: gossipsub()
      },
      connectionManager: {
        minConnections: 2,
        maxConnections: 10
      }
    })

    // Création du nœud Helia
    const helia = await createHelia({
      libp2p,
      start: true
    })

    return helia
  } catch (error) {
    console.error('Erreur lors de la création du nœud IPFS:', error)
    throw error
  }
}