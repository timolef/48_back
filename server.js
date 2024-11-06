const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const app = express();
const port = 3000;
const jwt = require('jsonwebtoken');

// Configuration de MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'quarantehuit'
});

connection.connect(err => {
  if (err) {
    console.error('Erreur de connexion à MySQL : ', err);
    return;
  }
  console.log('Connecté à MySQL');
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Routes
app.post('/register', (req, res) => {
    const { name, firstname, email, pseudo, password, birthdate, gender } = req.body;
  
    // Hash du mot de passe avec bcrypt
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(password, salt, (err, hash) => {
        if (err) throw err;
        
        // Insertion des données dans la table users avec le mot de passe hashé
        const user = { name, firstname, email, pseudo, mot_de_passe: hash, birthdate, gender };
        connection.query('INSERT INTO users SET ?', user, (error, results, fields) => {
          if (error) {
            console.error(error);
            res.status(500).send('Erreur lors de l\'inscription');
          } else {
            console.log('Utilisateur inscrit avec succès');
            res.status(200).send('Inscription réussie');
          }
        });
      });
    });
  });

  app.post('/login', (req, res) => {
    const { email, password } = req.body;
  
    const sql = 'SELECT * FROM users WHERE email = ?';
    connection.query(sql, [email], async (err, results) => {
      if (err) {
        console.error('Erreur lors de la connexion:', err);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
      } else {
        if (results.length > 0) {
          const user = results[0];
            console.log(user)
          // Vérifier le mot de passe
          const passwordMatch = await bcrypt.compare(password, user.mot_de_passe);
  
          if (passwordMatch) {
            const token = jwt.sign({ userId: user.id, username: user.username }, 'lad53-dz41c2+', { expiresIn: '10h' });
            console.log('Connexion réussie');
            res.status(200).json({ message: 'Connexion réussie', token, userId: user.id, username: user.pseudo, name: user.name, firstname: user.firstname, email: user.email, birthdate: user.birthdate, gender: user.gender, isAdmin: user.isAdmin});
          } else {
            console.log('Mot de passe incorrect');
            res.status(401).json({ error: 'Mot de passe incorrect' });
          }
        } else {
          console.log('Utilisateur non trouvé');
          res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
      }
    });
});

app.post('/users', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  connection.query(sql, [email], async (err, results) => {
      if (err) {
          console.error('Erreur lors de la récupération des utilisateurs:', err);
          res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
      } else {
          if (results.length > 0) {
              const user = results[0];
              console.log(user)
              // Vérifier si l'utilisateur est un administrateur
              if (user.isAdmin) {
                  const getAllUsersSql = 'SELECT * FROM users';
                  connection.query(getAllUsersSql, (err, users) => {
                      if (err) {
                          console.error('Erreur lors de la récupération des utilisateurs:', err);
                          res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
                      } else {
                          console.log('Liste de tous les utilisateurs récupérée avec succès');
                          res.status(200).json({ users });
                      }
                  });
              } else {
                  console.log('L\'utilisateur n\'est pas un administrateur');
                  res.status(403).json({ error: 'Vous n\'avez pas les autorisations nécessaires pour accéder à cette ressource' });
              }
          } else {
              console.log('Utilisateur non trouvé');
              res.status(404).json({ error: 'Utilisateur non trouvé' });
          }
      }
  });
});

app.delete('/users/:userId', (req, res) => {
  const userId = req.params.userId;

  const sql = 'DELETE FROM users WHERE id = ?';
  connection.query(sql, [userId], (err, result) => {
      if (err) {
          console.error('Erreur lors de la suppression de l\'utilisateur :', err);
          res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
      } else {
          console.log('Utilisateur supprimé avec succès');
          res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
      }
  });
});

app.put('/users/:userId', (req, res) => {
  const userId = req.params.userId;
  const { firstname, name, email, pseudo, isAdmin } = req.body;

  // Requête SQL pour mettre à jour l'utilisateur
  const sql = 'UPDATE users SET firstname = ?, name = ?, email = ?, pseudo = ?, isAdmin = ? WHERE id = ?';
  connection.query(sql, [firstname, name, email, pseudo, isAdmin, userId], (err, result) => {
    if (err) {
      console.error('Erreur lors de la modification de l\'utilisateur :', err);
      res.status(500).json({ error: 'Erreur lors de la modification de l\'utilisateur' });
    } else {
      console.log('Utilisateur modifié avec succès');
      res.status(200).json({ message: 'Utilisateur modifié avec succès' });
    }
  });
});

app.get('/posts', (req, res) => {
  // Récupérer tous les posts de la base de données
  connection.query('SELECT * FROM posts', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la récupération des posts : ', error);
      res.status(500).send('Erreur lors de la récupération des posts');
    } else {
      console.log('Posts récupérés avec succès');
      res.json(results);
    }
  });
});

app.post('/posts', (req, res) => {
  const { title, content, authorId } = req.body;

  // Insérer le post dans la base de données
  connection.query('INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)', [title, content, authorId], (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de l\'ajout du post : ', error);
      res.status(500).send('Erreur lors de l\'ajout du post');
    } else {
      console.log('Post ajouté avec succès');
      res.status(200).send('Post ajouté avec succès');
    }
  });
});

app.patch('/posts/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, authorId } = req.body;

  // Mise à jour du post dans la base de données
  const sql = 'UPDATE posts SET title = ?, content = ?, author_id = ? WHERE id = ?';
  connection.query(sql, [title, content, authorId, id], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la mise à jour du post : ', error);
          res.status(500).send('Erreur lors de la mise à jour du post');
      } else if (results.affectedRows === 0) {
          console.log('Aucun post trouvé avec cet ID');
          res.status(404).send('Aucun post trouvé avec cet ID');
      } else {
          console.log('Post mis à jour avec succès');
          res.status(200).send('Post mis à jour avec succès');
      }
  });
});

app.delete('/posts/:postId', (req, res) => {
  const postId = req.params.postId;
  // Supprimer le post de la base de données
  connection.query('DELETE FROM posts WHERE id = ?', postId, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la suppression du post : ', error);
      res.status(500).send('Erreur lors de la suppression du post');
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send('Post non trouvé');
      } else {
        console.log('Post supprimé avec succès');
        res.status(200).send('Post supprimé avec succès');
      }
    }
  });
});

// Endpoint pour récupérer toutes les ressources éducatives
app.get('/educative-resources', (req, res) => {
  connection.query('SELECT * FROM educative_resources', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la récupération des ressources éducatives : ', error);
      res.status(500).send('Erreur lors de la récupération des ressources éducatives');
    } else {
      res.status(200).json(results);
    }
  });
});

app.post('/educative-resources', (req, res) => {
  const { title, type, description, link } = req.body;

  // Insertion de l'article dans la base de données
  const sql = 'INSERT INTO educative_resources (title, type, description, link) VALUES (?, ?, ?, ?)';
  connection.query(sql, [title, type, description, link], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la création de l\'article : ', error);
          res.status(500).send('Erreur lors de la création de l\'article');
      } else {
          console.log('Article créé avec succès');
          res.status(201).send('Article créé avec succès');
      }
  });
});

app.patch('/educative-resources/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, link } = req.body;

  // Mise à jour de l'organisation d'assistance dans la base de données
  const sql = 'UPDATE educative_resources SET title = ?, description = ?, link = ? WHERE id = ?';
  connection.query(sql, [title, description, link, id], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la mise à jour de la ressource educative : ', error);
          res.status(500).send('Erreur lors de la mise à jour de la ressource educative');
      } else if (results.affectedRows === 0) {
          console.log('Aucune ressource trouvée avec cet ID');
          res.status(404).send('Aucune ressource trouvée avec cet ID');
      } else {
          console.log('Ressource educative mise à jour avec succès');
          res.status(200).send('Ressource educative mise à jour avec succès');
      }
  });
});

app.delete('/educative-resources/:id', (req, res) => {
  const resourceId = req.params.id;
  connection.query('DELETE FROM educative_resources WHERE id = ?', resourceId, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la suppression de la ressource éducative : ', error);
      res.status(500).send('Erreur lors de la suppression de la ressource éducative');
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send('Ressource éducative non trouvée');
      } else {
        console.log('Ressource éducative supprimée avec succès');
        res.status(200).send('Ressource éducative supprimée avec succès');
      }
    }
  });
});


// Endpoint pour récupérer tous les guides de prévention
app.get('/prevention-support-guides', (req, res) => {
  connection.query('SELECT * FROM prevention_support_guides', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la récupération des guides de prévention : ', error);
      res.status(500).send('Erreur lors de la récupération des guides de prévention');
    } else {
      res.status(200).json(results);
    }
  });
});

app.post('/prevention-support-guides', (req, res) => {
  const { title, description, link } = req.body;

  // Insertion du guide de prévention dans la base de données
  const sql = 'INSERT INTO prevention_support_guides (title, description, link) VALUES (?, ?, ?)';
  connection.query(sql, [title, description, link], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la création du guide de prévention : ', error);
          res.status(500).send('Erreur lors de la création du guide de prévention');
      } else {
          console.log('Guide de prévention créé avec succès');
          res.status(201).send('Guide de prévention créé avec succès');
      }
  });
});

app.patch('/prevention-support-guides/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, link } = req.body;

  // Mise à jour du guide de prévention dans la base de données
  const sql = 'UPDATE prevention_support_guides SET title = ?, description = ?, link = ? WHERE id = ?';
  connection.query(sql, [title, description, link, id], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la mise à jour du guide de prévention : ', error);
          res.status(500).send('Erreur lors de la mise à jour du guide de prévention');
      } else {
          if (results.affectedRows === 0) {
              console.log('Aucun guide de prévention trouvé avec cet identifiant');
              res.status(404).send('Aucun guide de prévention trouvé avec cet identifiant');
          } else {
              console.log('Guide de prévention mis à jour avec succès');
              res.status(200).send('Guide de prévention mis à jour avec succès');
          }
      }
  });
});

app.delete('/prevention-support-guides/:id', (req, res) => {
  const guideId = req.params.id;
  connection.query('DELETE FROM prevention_support_guides WHERE id = ?', guideId, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la suppression du guide de prévention : ', error);
      res.status(500).send('Erreur lors de la suppression du guide de prévention');
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send('Guide de prévention non trouvé');
      } else {
        console.log('Guide de prévention supprimé avec succès');
        res.status(200).send('Guide de prévention supprimé avec succès');
      }
    }
  });
});



// Endpoint pour récupérer toutes les organisations d'assistance
app.get('/assistance-organizations', (req, res) => {
  connection.query('SELECT * FROM assistance_organizations', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la récupération des organisations d\'assistance : ', error);
      res.status(500).send('Erreur lors de la récupération des organisations d\'assistance');
    } else {
      res.status(200).json(results);
    }
  });
});



app.post('/assistance-organizations', (req, res) => {
  const { name, phone, description, link } = req.body;

  // Insertion de l'organisation d'assistance dans la base de données
  const sql = 'INSERT INTO assistance_organizations (name, phone, description, link) VALUES (?, ?, ?, ?)';
  connection.query(sql, [name, phone, description, link], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la création de l\'organisation d\'assistance : ', error);
          res.status(500).send('Erreur lors de la création de l\'organisation d\'assistance');
      } else {
          console.log('Organisation d\'assistance créée avec succès');
          res.status(201).send('Organisation d\'assistance créée avec succès');
      }
  });
});


app.patch('/assistance-organizations/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, description, link } = req.body;

  // Mise à jour de l'organisation d'assistance dans la base de données
  const sql = 'UPDATE assistance_organizations SET name = ?, phone = ?, description = ?, link = ? WHERE id = ?';
  connection.query(sql, [name, phone, description, link, id], (error, results, fields) => {
      if (error) {
          console.error('Erreur lors de la mise à jour de l\'organisation d\'assistance : ', error);
          res.status(500).send('Erreur lors de la mise à jour de l\'organisation d\'assistance');
      } else if (results.affectedRows === 0) {
          console.log('Aucune organisation trouvée avec cet ID');
          res.status(404).send('Aucune organisation trouvée avec cet ID');
      } else {
          console.log('Organisation d\'assistance mise à jour avec succès');
          res.status(200).send('Organisation d\'assistance mise à jour avec succès');
      }
  });
});

app.delete('/assistance-organizations/:id', (req, res) => {
  const organizationId = req.params.id;
  connection.query('DELETE FROM assistance_organizations WHERE id = ?', organizationId, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la suppression de l\'organisation d\'assistance : ', error);
      res.status(500).send('Erreur lors de la suppression de l\'organisation d\'assistance');
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send('Organisation d\'assistance non trouvée');
      } else {
        console.log('Organisation d\'assistance supprimée avec succès');
        res.status(200).send('Organisation d\'assistance supprimée avec succès');
      }
    }
  });
});

app.post('/news', (req, res) => {
  const { title, date, description } = req.body;
  const event = { title, date, description };
  connection.query('INSERT INTO actualities SET ?', event, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la création de l\'actualité : ', error);
      res.status(500).send('Erreur lors de la création de l\'actualité');
    } else {
      console.log('Actualité créé avec succès');
      res.status(201).json({ id: results.insertId, ...event });
    }
  });
});

app.patch('/news/:id', (req, res) => {
  const { id } = req.params;
  const { title, date, description } = req.body;
  
  const sql = 'UPDATE actualities SET title = ?, date = ?, description = ? WHERE id = ?';
  const values = [title, date, description, id];

  connection.query(sql, values, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la mise à jour de l\'actualité : ', error);
      res.status(500).send('Erreur lors de la mise à jour de l\'actualité');
    } else if (results.affectedRows === 0) {
      res.status(404).send('Actualité non trouvée');
    } else {
      console.log('Actualité mise à jour avec succès');
      res.status(200).send('Actualité mise à jour avec succès');
    }
  });
});

// Endpoint pour supprimer un événement passé
app.delete('/news/:id', (req, res) => {
  const eventId = req.params.id;
  connection.query('DELETE FROM actualities WHERE id = ?', eventId, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la suppression de l\'actualité : ', error);
      res.status(500).send('Erreur lors de la suppression de l\'actualité');
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send('Actualité non trouvé');
      } else {
        console.log('Actualité supprimé avec succès');
        res.status(200).send('Actualité supprimé avec succès');
      }
    }
  });
});

// Endpoint pour créer un événement à venir
app.post('/upcoming-events', (req, res) => {
  const { title, date, description } = req.body;
  const event = { title, date, description };
  connection.query('INSERT INTO upcoming_events SET ?', event, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la création de l\'événement à venir : ', error);
      res.status(500).send('Erreur lors de la création de l\'événement à venir');
    } else {
      console.log('Événement à venir créé avec succès');
      res.status(201).json({ id: results.insertId, ...event });
    }
  });
});

// Endpoint pour supprimer un événement à venir
app.delete('/upcoming-events/:id', (req, res) => {
  const eventId = req.params.id;
  connection.query('DELETE FROM upcoming_events WHERE id = ?', eventId, (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la suppression de l\'événement à venir : ', error);
      res.status(500).send('Erreur lors de la suppression de l\'événement à venir');
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send('Événement à venir non trouvé');
      } else {
        console.log('Événement à venir supprimé avec succès');
        res.status(200).send('Événement à venir supprimé avec succès');
      }
    }
  });
});

app.get('/latest-news', (req, res) => {
  connection.query('SELECT * FROM actualities', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la récupération des dernières actualités : ', error);
      res.status(500).send('Erreur lors de la récupération des dernières actualités');
    } else {
      if (results.length === 0) {
        res.status(404).send('Aucune actualité trouvée');
      } else {
        console.log('Dernières actualités récupérées avec succès');
        res.status(200).json(results);
      }
    }
  });
});

app.get('/upcoming-events', (req, res) => {
  connection.query('SELECT * FROM upcoming_events', (error, results, fields) => {
    if (error) {
      console.error('Erreur lors de la récupération des événements à venir : ', error);
      res.status(500).send('Erreur lors de la récupération des événements à venir');
    } else {
      if (results.length === 0) {
        res.status(404).send('Aucun événement à venir trouvé');
      } else {
        console.log('Événements à venir récupérés avec succès');
        res.status(200).json(results);
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${port}`);
});