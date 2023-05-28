const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const port = 3000;
const accountsFilePath = 'accounts.json';
const databaseFilePath = 'database.db';

// Middleware pour servir les fichiers statiques
app.use(express.static('public'));

app.use(require('cors')());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Fonction pour lire les comptes depuis le fichier JSON
function readAccountsFromFile() {
    try {
        if (fs.existsSync(accountsFilePath)) {
            const accountsData = fs.readFileSync(accountsFilePath, 'utf8');
            return JSON.parse(accountsData);
        } else {
            console.log('Le fichier des comptes n\'existe pas. Création d\'un nouveau fichier.');
            return [];
        }
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
    db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      content TEXT
    )
  `, (error) => {
        if (error) {
            console.error('Erreur lors de la création de la table "messages" dans la base de données:', error);
        } else {
            console.log('Table "messages" créée avec succès dans la base de données.');

            // Une fois la table créée, vous pouvez appeler getMessages ici
            getMessages((messages) => {
                // Traitez les messages récupérés comme nécessaire
            });
        }
    });
    db.close();
}

// Fonction pour insérer un message dans la base de données
function insertMessage(message) {
    if (message.content.trim() === '') {
        console.error('Erreur: Tentative d\'insertion d\'un message vide.');
        return;
    }

    const db = new sqlite3.Database(databaseFilePath);
    db.run('INSERT INTO messages (sender, content) VALUES (?, ?)', [message.sender, message.content], (err) => {
        if (err) {
            console.error('Erreur lors de l\'insertion du message dans la base de données:', err);
        }
        db.close(); // Fermer la connexion après l'opération
    });
}

// Fonction pour récupérer les messages depuis la base de données
function getMessages(callback) {
    const db = new sqlite3.Database(databaseFilePath);
    db.all('SELECT sender, content FROM messages WHERE TRIM(content) != "" AND content IS NOT NULL ORDER BY ROWID DESC LIMIT 20', [], (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des messages depuis la base de données:', err);
            callback([]);
        } else {
            const messages = rows.reverse().map((row) => ({
                sender: row.sender,
                content: row.content
            }));
            console.log('Messages extraits de la base de données:', messages);
            callback(messages);
        }
        db.close();
    });
}


// Route pour la création d'un compte
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const accounts = readAccountsFromFile();

    const existingAccount = accounts.find((account) => account.username === username);
    if (existingAccount) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newAccount = { username, password: hashedPassword, points: 0 };
        accounts.push(newAccount);
        writeAccountsToFile(accounts);

        res.redirect(`/home.html?username=${encodeURIComponent(newAccount.username)}&points=${newAccount.points}`);
    } catch (error) {
        console.error('Erreur lors de la vérification du mot de passe:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification du mot de passe.' });
    }
});

// Route pour la connexion à un compte
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const accounts = readAccountsFromFile();
    const account = accounts.find((account) => account.username === username);

    if (!account) {
        return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    try {
        const isPasswordValid = await bcrypt.compare(password, account.password);

        if (isPasswordValid) {
            res.redirect(`/home.html?username=${encodeURIComponent(username)}&points=${account.points}`);
        } else {
            res.status(401).json({ message: 'Identifiants incorrects.' });
        }
    } catch (err) {
        console.error('Erreur lors de la connexion:', err);
        res.status(500).json({ message: 'Erreur lors de la connexion.' });
    }
});

// Route pour récupérer les données du top board
app.get('/top-accounts', (req, res) => {
    const accounts = readAccountsFromFile();
    const sortedAccounts = accounts.sort((a, b) => b.points - a.points);
    res.json(sortedAccounts);
});

// Route pour la récupération des messages
app.get('/messages', (req, res) => {
    getMessages((messages) => {
        res.json({ type: 'messages', data: messages });
    });
});

// Route pour la page d'accueil
app.get('/', (req, res) => {
    const { username, points } = req.query;
    res.redirect(`/home.html?username=${encodeURIComponent(username)}&points=${encodeURIComponent(points)}`);
});

// Démarrage du serveur
const server = app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});

// Initialisation de la base de données
initializeDatabase();

// Création du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Fonction pour envoyer les messages aux clients WebSocket connectés
function sendMessagesToClients() {
    getMessages((messages) => {
        const nonEmptyMessages = messages.filter((message) => message.content.trim() !== '');

        if (nonEmptyMessages.length > 0) {
            const messageData = JSON.stringify({ type: 'messages', data: nonEmptyMessages });

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(messageData, (error) => {
                        if (error) {
                            console.error('Erreur lors de l\'envoi du message au client WebSocket:', error);
                        }
                    });
                }
            });
        }
    });
}

// Connexion d'un client WebSocket
wss.on('connection', (ws) => {
    console.log('Client WebSocket connecté.');

    getMessages((messages) => {
        const messageData = JSON.stringify({ type: 'messages', data: messages });
        ws.send(messageData, (error) => {
            if (error) {
                console.error('Erreur lors de l\'envoi des messages au client WebSocket:', error);
            }
        });
    });

    ws.on('message', (message) => {
        console.log('Message reçu du client WebSocket:', message);

        try {
            const messageObject = JSON.parse(message);
            insertMessage(messageObject);

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(messageObject), (error) => {
                        if (error) {
                            console.error('Erreur lors de l\'envoi du message au client WebSocket:', error);
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Erreur lors du traitement du message du client WebSocket:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client WebSocket déconnecté.');
    });
});

// Planification de l'envoi des messages aux clients toutes les 5 secondes
//setTimeout(sendMessagesToClients, 0);
//setInterval(sendMessagesToClients, 5000);

