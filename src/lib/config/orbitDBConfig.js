// orbitDBConfig.js
import OrbitDB from 'orbit-db';

export const createOrbitDB = async (ipfs) => {
  const options = {
    directory: './orbitdb',
    replicate: true,
    // Augmenter la limite de réplication pour une meilleure disponibilité
    replicationConcurrency: 10,
    // Configuration du canal de synchronisation
    syncConfig: {
      syncOnConnect: true,
      maxPeers: 10,
    }
  };

  return await OrbitDB.createInstance(ipfs, options);
};