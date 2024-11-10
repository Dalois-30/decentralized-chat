import React, { useState, useEffect } from 'react';
import { createOrbitDBInstance } from '../lib/config/orbitDBConfig';

const UserCRUD = () => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    walletAddress: '',
    email: '',
    username: '',
    avatar: null,
  });
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userDb, setUserDb] = useState(null);


  // Initialisation d'OrbitDB
  useEffect(() => {
    let mounted = true;
    let db = null;

    const initOrbitDB = async () => {
      try {
        if (!mounted) return;
        
        db = await createOrbitDBInstance();
        setUserDb(db);
        await loadUsers();
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error("Erreur lors de l'initialisation d'OrbitDB:", err);
        setError("Erreur de connexion à OrbitDB");
        setLoading(false);
      }
    };

    initOrbitDB();

    return () => {
      mounted = false;
      if (db) {
        db.close().catch(console.error);
      }
    };
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    if (!newUser.walletAddress.trim() || !newUser.username.trim()) return;

    try {
      const user = {
        id: newUser.walletAddress,
        walletAddress: newUser.walletAddress,
        email: newUser.email,
        username: newUser.username,
        createdAt: Date.now(),
        blocked: [],
        lastSeen: Date.now(),
        status: 'online',
        avatar: newUser.avatar,
        conversations: []
      };

      // Utiliser put au lieu de add pour docstore
      await userDb.put(user);
      await loadUsers();
      setNewUser({
        walletAddress: '',
        email: '',
        username: '',
        avatar: null,
      });
    } catch (err) {
      console.error("Erreur lors de la création de l'utilisateur:", err);
      setError("Erreur lors de la création de l'utilisateur");
    }
  };

  // Modifier la fonction loadUsers
  const loadUsers = async () => {
    try {
      if (!userDb) return;
      // Pour docstore, utiliser query ou get
      const allUsers = await userDb.getAllDocs();
      setUsers(Object.values(allUsers));
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Erreur lors du chargement des utilisateurs');
    }
  };

  // Mettre à jour un utilisateur
  const updateUser = async (user) => {
    try {
      const updatedUser = {
        ...user,
        lastSeen: Date.now(),
      };
      await userDb.add(updatedUser);
      await loadUsers();
      setEditingUser(null);
    } catch (err) {
      console.error("Erreur lors de la mise à jour de l'utilisateur:", err);
      setError("Erreur lors de la mise à jour de l'utilisateur");
    }
  };

  // Supprimer un utilisateur
  const deleteUser = async (walletAddress) => {
    try {
      // Dans OrbitDB, nous devons ajouter une entrée avec un champ deleted
      await userDb.add({
        id: walletAddress,
        deleted: true,
        timestamp: Date.now()
      });
      await loadUsers();
    } catch (err) {
      console.error("Erreur lors de la suppression de l'utilisateur:", err);
      setError("Erreur lors de la suppression de l'utilisateur");
    }
  };

  if (loading) {
    return <div className="p-4">Chargement...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gestion des Utilisateurs</h1>

      {/* Formulaire de création */}
      <form onSubmit={createUser} className="mb-6 p-4 bg-white rounded shadow">
        <div className="space-y-4">
          <div>
            <label className="block mb-1">Adresse Wallet</label>
            <input
              type="text"
              value={newUser.walletAddress}
              onChange={(e) => setNewUser({...newUser, walletAddress: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="block mb-1">Email</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block mb-1">Nom d'utilisateur</label>
            <input
              type="text"
              value={newUser.username}
              onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Username"
            />
          </div>
          <button 
            type="submit"
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Ajouter un utilisateur
          </button>
        </div>
      </form>

      {/* Liste des utilisateurs */}
      <div className="space-y-4">
        {users.filter(user => !user.deleted).map((user) => (
          <div key={user.id} className="p-4 bg-white border rounded shadow">
            {editingUser === user.id ? (
              <div className="space-y-4">
                <input
                  type="email"
                  defaultValue={user.email}
                  className="w-full p-2 border rounded"
                  onChange={(e) => {
                    const updatedUser = {...user, email: e.target.value};
                    setEditingUser(updatedUser);
                  }}
                />
                <input
                  type="text"
                  defaultValue={user.username}
                  className="w-full p-2 border rounded"
                  onChange={(e) => {
                    const updatedUser = {...user, username: e.target.value};
                    setEditingUser(updatedUser);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateUser(editingUser)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Sauvegarder
                  </button>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">{user.username}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-xs text-gray-500">{user.walletAddress}</p>
                  <p className="text-xs text-gray-500">
                    Dernier accès: {new Date(user.lastSeen).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {user.status}
                  </p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => setEditingUser(user.id)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserCRUD;