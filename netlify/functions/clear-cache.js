// netlify/functions/clear-cache.js
//
// Vide le cache serveur (Netlify Blobs) utilisé par football.js.
// Appelée depuis la page PARAMÈTRES via le bouton "Vider le cache".

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  }

  try {
    const store = getStore('football-cache');
    const { blobs } = await store.list();
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, cleared: blobs.length }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Impossible de vider le cache.', code: 'SERVER_ERROR' }) };
  }
};
