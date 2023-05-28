const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();

// Middleware pour servir les fichiers statiques
app.use(express.static('public'));

app.use(require('cors')())

const port = 3000;
const accountsFilePath = 'accounts.json';
const databaseFilePath = 'database.db';

// Middleware pour analyser les données du corps des requêtes
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Fonction pour lire les comptes depuis le fichier JSON
function readAccountsFromFile() {
    try {
        const accountsData = fs.readFileSync(accountsFilePath, 'utf8');
        return JSON.parse(accountsData);
    } catch (err) {
        console.error('Erreur lors de la lecture des comptes depuis le fichier:', err);
        return [];
    }
}

// Fonction pour écrire les comptes dans le fichier JSON
function writeAccountsToFile(accounts) {
    try {
        fs.writeFileSync(accountsFilePath, JSON.stringify(accounts, null, 2));
    } catch (err) {
        console.error('Erreur lors de l\'écriture des comptes dans le fichier:', err);
    }
}

// Fonction pour initialiser la base de données
function initializeDatabase() {
    const db = new sqlite3.Database(databaseFilePath);
    db.run(
        'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT)',
        (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table "messages" dans la base de données:', err);
            }
        }
    );
    db.close();
}

// Fonction pour insérer un message dans la base de données
function insertMessage(message) {
    const db = new sqlite3.Database(databaseFilePath);
    db.run('INSERT INTO messages (content) VALUES (?)', [message], (err) => {
        if (err) {
            console.error('Erreur lors de l\'insertion du message dans la base de données:', err);
        }
        db.close();
    });
}

// Fonction pour récupérer les messages depuis la base de données
function getMessages(callback) {
    const db = new sqlite3.Database(databaseFilePath);
    db.all('SELECT content FROM messages', [], (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des messages depuis la base de données:', err);
            callback([]);
        } else {
            callback(rows.map((row) => row.content));
        }
        db.close();
    });
}

// Route pour la création d'un compte
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    // Lecture des comptes depuis le fichier JSON
    const accounts = readAccountsFromFile();

    // Vérification si le nom d'utilisateur existe déjà
    const existingAccount = accounts.find((account) => account.username === username);
    if (existingAccount) {
        return res.status(409).json({ message: 'Ce nom d\'utilisateur existe déjà.' });
    }

    try {
        // Génération du hash du mot de passe
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Création du nouveau compte avec le mot de passe haché
        const newAccount = { username, password: hashedPassword, points: 0 };
        accounts.push(newAccount);

        // Écriture des comptes dans le fichier JSON
        writeAccountsToFile(accounts);

        res.status(201).json({ message: 'Compte créé avec succès.' });
    }
});

// Route pour la connexion à un compte
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Lecture des comptes depuis le fichier JSON
    const accounts = readAccountsFromFile();

    // Recherche du compte correspondant au nom d'utilisateur
    const account = accounts.find((acc) => acc.username === username);

    if (!account) {
        return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    }

    try {
        // Comparaison du mot de passe fourni avec le mot de passe haché du compte
        const passwordMatch = await bcrypt.compare(password, account.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
        }

        return res.status(200).json({ message: 'Connexion réussie.' });
    } catch (err) {
        console.error('Erreur lors de la connexion:', err);
        return res.status(500).json({ message: 'Erreur lors de la connexion.' });
    }
});

// Route pour récupérer les messages
app.get('/messages', (req, res) => {
    getMessages((messages) => {
        res.json(messages);
    });
});

// Route pour envoyer un message
app.post('/messages', (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ message: 'Le contenu du message est requis.' });
    }

    insertMessage(content);

    return res.status(201).json({ message: 'Message envoyé avec succès.' });
});

// Route par défaut pour toutes les autres requêtes
app.use((req, res) => {
    res.status(404).json({ message: 'Ressource introuvable.' });
});

// Création du serveur WebSocket
const server = app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Nouvelle connexion WebSocket');

    // Envoyer les messages existants au client qui se connecte
    getMessages((messages) => {
        ws.send(JSON.stringify({ type: 'messages', data: messages }));
    });

    // Gérer les messages reçus du client
    ws.on('message', (message) => {
        console.log('Message reçu:', message);
        insertMessage(message);
        // Diffuser le message à tous les clients connectés
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    // Gérer la fermeture de la connexion WebSocket
    ws.on('close', () => {
        console.log('Connexion WebSocket fermée');
    });
});

// Initialiser la base de données
initializeDatabase();

