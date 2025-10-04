const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const app = express();
require('dotenv').config();
const port = 3000;
const jwt = require('jsonwebtoken');
const { createClient } = require("@libsql/client");
// Configuration de MySQL
const client = createClient({
  url: process.env.TURSO_DB_URL,      // ton lien libsql://...
  authToken: process.env.TURSO_DB_TOKEN, // ton token Turso
});

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
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
app.post("/register", async (req, res) => {
  try {
    const { name, firstname, email, pseudo, password, birthdate, gender } = req.body;

    // Hash du mot de passe
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Insertion dans la table users
    const query = `
      INSERT INTO users (name, firstname, email, pseudo, mot_de_passe, birthdate, gender, isAdmin)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `;

    await client.execute({
      sql: query,
      args: [name, firstname, email, pseudo, hash, birthdate, gender],
    });

    console.log("Utilisateur inscrit avec succès");
    res.status(200).send("Inscription réussie");
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    res.status(500).send("Erreur lors de l'inscription");
  }
});

  app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Requête sur l'email
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });

    if (result.rows.length === 0) {
      console.log("Utilisateur non trouvé");
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.mot_de_passe);

    if (!passwordMatch) {
      console.log("Mot de passe incorrect");
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.pseudo },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    console.log("Connexion réussie");
    res.status(200).json({
      message: "Connexion réussie",
      token,
      userId: user.id,
      username: user.pseudo,
      name: user.name,
      firstname: user.firstname,
      email: user.email,
      birthdate: user.birthdate,
      gender: user.gender,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    console.error("Erreur lors de la connexion:", err);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

app.post("/users", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });

    if (result.rows.length === 0) {
      console.log("Utilisateur non trouvé");
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const user = result.rows[0];
    console.log(user);

    // Vérifier si l'utilisateur est administrateur
    if (user.isAdmin) {
      const allUsers = await client.execute("SELECT * FROM users");

      console.log("Liste de tous les utilisateurs récupérée avec succès");
      return res.status(200).json({ users: allUsers.rows });
    } else {
      console.log("L'utilisateur n'est pas un administrateur");
      return res
        .status(403)
        .json({ error: "Vous n'avez pas les autorisations nécessaires pour accéder à cette ressource" });
    }
  } catch (err) {
    console.error("Erreur lors de la récupération des utilisateurs:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
  }
});

app.delete("/users/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const result = await client.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [userId],
    });

    if (result.rowsAffected > 0) {
      console.log("Utilisateur supprimé avec succès");
      res.status(200).json({ message: "Utilisateur supprimé avec succès" });
    } else {
      console.log("Utilisateur non trouvé");
      res.status(404).json({ error: "Utilisateur non trouvé" });
    }
  } catch (err) {
    console.error("Erreur lors de la suppression de l'utilisateur :", err);
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  }
});

app.put("/users/:userId", async (req, res) => {
  const userId = req.params.userId;
  const { firstname, name, email, pseudo, isAdmin } = req.body;

  try {
    const result = await client.execute({
      sql: `
        UPDATE users
        SET firstname = ?, name = ?, email = ?, pseudo = ?, isAdmin = ?
        WHERE id = ?
      `,
      args: [firstname, name, email, pseudo, isAdmin, userId],
    });

    if (result.rowsAffected > 0) {
      console.log("Utilisateur modifié avec succès");
      res.status(200).json({ message: "Utilisateur modifié avec succès" });
    } else {
      console.log("Utilisateur non trouvé");
      res.status(404).json({ error: "Utilisateur non trouvé" });
    }
  } catch (err) {
    console.error("Erreur lors de la modification de l'utilisateur :", err);
    res.status(500).json({ error: "Erreur lors de la modification de l'utilisateur" });
  }
});

app.get("/posts", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM posts");
    console.log("Posts récupérés avec succès");
    
    console.log(result.rows)
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des posts :", err);
    res.status(500).send("Erreur lors de la récupération des posts");
  }
});


app.post("/posts", async (req, res) => {
  const { title, content, authorId } = req.body;

  try {
    await client.execute({
      sql: "INSERT INTO posts (title, content, author_id, created_at) VALUES (?, ?, ?, datetime('now'))",
      args: [title, content, authorId],
    });

    console.log("Post ajouté avec succès");
    res.status(200).send("Post ajouté avec succès");
  } catch (err) {
    console.error("Erreur lors de l'ajout du post :", err);
    res.status(500).send("Erreur lors de l'ajout du post");
  }
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

app.delete("/posts/:postId", async (req, res) => {
  const postId = req.params.postId;

  try {
    const result = await client.execute({
      sql: "DELETE FROM posts WHERE id = ?",
      args: [postId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Post non trouvé");
    }

    console.log("Post supprimé avec succès");
    res.status(200).send("Post supprimé avec succès");
  } catch (err) {
    console.error("Erreur lors de la suppression du post :", err);
    res.status(500).send("Erreur lors de la suppression du post");
  }
});


// Endpoint pour récupérer toutes les ressources éducatives
app.get("/educative-resources", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM educative_resources");
    console.log(result.rows)
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des ressources éducatives :", err);
    res.status(500).send("Erreur lors de la récupération des ressources éducatives");
  }
});

app.post("/educative-resources", async (req, res) => {
  const { title, type, description, link } = req.body;

  try {
    await client.execute({
      sql: "INSERT INTO educative_resources (title, type, description, link) VALUES (?, ?, ?, ?)",
      args: [title, type, description, link],
    });

    console.log("Article créé avec succès");
    res.status(201).send("Article créé avec succès");
  } catch (err) {
    console.error("Erreur lors de la création de l'article :", err);
    res.status(500).send("Erreur lors de la création de l'article");
  }
});

app.patch("/educative-resources/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, link } = req.body;

  try {
    const result = await client.execute({
      sql: "UPDATE educative_resources SET title = ?, description = ?, link = ? WHERE id = ?",
      args: [title, description, link, id],
    });

    if (result.rowsAffected === 0) {
      console.log("Aucune ressource trouvée avec cet ID");
      return res.status(404).send("Aucune ressource trouvée avec cet ID");
    }

    console.log("Ressource educative mise à jour avec succès");
    res.status(200).send("Ressource educative mise à jour avec succès");
  } catch (err) {
    console.error("Erreur lors de la mise à jour de la ressource educative :", err);
    res.status(500).send("Erreur lors de la mise à jour de la ressource educative");
  }
});

app.delete("/educative-resources/:id", async (req, res) => {
  const resourceId = req.params.id;

  try {
    const result = await client.execute({
      sql: "DELETE FROM educative_resources WHERE id = ?",
      args: [resourceId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Ressource éducative non trouvée");
    }

    console.log("Ressource éducative supprimée avec succès");
    res.status(200).send("Ressource éducative supprimée avec succès");
  } catch (err) {
    console.error("Erreur lors de la suppression de la ressource éducative :", err);
    res.status(500).send("Erreur lors de la suppression de la ressource éducative");
  }
});


// Endpoint pour récupérer tous les guides de prévention
app.get("/prevention-support-guides", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM prevention_support_guides");
    
    console.log(result.rows)
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des guides de prévention :", err);
    res.status(500).send("Erreur lors de la récupération des guides de prévention");
  }
});

app.post("/prevention-support-guides", async (req, res) => {
  const { title, description, link } = req.body;

  try {
    await client.execute({
      sql: "INSERT INTO prevention_support_guides (title, description, link) VALUES (?, ?, ?)",
      args: [title, description, link],
    });

    console.log("Guide de prévention créé avec succès");
    res.status(201).send("Guide de prévention créé avec succès");
  } catch (err) {
    console.error("Erreur lors de la création du guide de prévention :", err);
    res.status(500).send("Erreur lors de la création du guide de prévention");
  }
});

app.patch("/prevention-support-guides/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, link } = req.body;

  try {
    const result = await client.execute({
      sql: "UPDATE prevention_support_guides SET title = ?, description = ?, link = ? WHERE id = ?",
      args: [title, description, link, id],
    });

    if (result.rowsAffected === 0) {
      console.log("Aucun guide de prévention trouvé avec cet identifiant");
      return res.status(404).send("Aucun guide de prévention trouvé avec cet identifiant");
    }

    console.log("Guide de prévention mis à jour avec succès");
    res.status(200).send("Guide de prévention mis à jour avec succès");
  } catch (err) {
    console.error("Erreur lors de la mise à jour du guide de prévention :", err);
    res.status(500).send("Erreur lors de la mise à jour du guide de prévention");
  }
});

app.delete("/prevention-support-guides/:id", async (req, res) => {
  const guideId = req.params.id;

  try {
    const result = await client.execute({
      sql: "DELETE FROM prevention_support_guides WHERE id = ?",
      args: [guideId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Guide de prévention non trouvé");
    }

    console.log("Guide de prévention supprimé avec succès");
    res.status(200).send("Guide de prévention supprimé avec succès");
  } catch (err) {
    console.error("Erreur lors de la suppression du guide de prévention :", err);
    res.status(500).send("Erreur lors de la suppression du guide de prévention");
  }
});



// Endpoint pour récupérer toutes les organisations d'assistance
app.get("/assistance-organizations", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM assistance_organizations");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des organisations d'assistance :", err);
    res.status(500).send("Erreur lors de la récupération des organisations d'assistance");
  }
});



app.post("/assistance-organizations", async (req, res) => {
  const { name, phone, description, link } = req.body;

  try {
    await client.execute({
      sql: "INSERT INTO assistance_organizations (name, phone, description, link) VALUES (?, ?, ?, ?)",
      args: [name, phone, description, link],
    });

    console.log("Organisation d'assistance créée avec succès");
    res.status(201).send("Organisation d'assistance créée avec succès");
  } catch (err) {
    console.error("Erreur lors de la création de l'organisation d'assistance :", err);
    res.status(500).send("Erreur lors de la création de l'organisation d'assistance");
  }
});


app.patch("/assistance-organizations/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, description, link } = req.body;

  try {
    const result = await client.execute({
      sql: "UPDATE assistance_organizations SET name = ?, phone = ?, description = ?, link = ? WHERE id = ?",
      args: [name, phone, description, link, id],
    });

    if (result.rowsAffected === 0) {
      console.log("Aucune organisation trouvée avec cet ID");
      return res.status(404).send("Aucune organisation trouvée avec cet ID");
    }

    console.log("Organisation d'assistance mise à jour avec succès");
    res.status(200).send("Organisation d'assistance mise à jour avec succès");
  } catch (err) {
    console.error("Erreur lors de la mise à jour de l'organisation d'assistance :", err);
    res.status(500).send("Erreur lors de la mise à jour de l'organisation d'assistance");
  }
});

app.delete("/assistance-organizations/:id", async (req, res) => {
  const organizationId = req.params.id;

  try {
    const result = await client.execute({
      sql: "DELETE FROM assistance_organizations WHERE id = ?",
      args: [organizationId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Organisation d'assistance non trouvée");
    }

    console.log("Organisation d'assistance supprimée avec succès");
    res.status(200).send("Organisation d'assistance supprimée avec succès");
  } catch (err) {
    console.error("Erreur lors de la suppression de l'organisation d'assistance :", err);
    res.status(500).send("Erreur lors de la suppression de l'organisation d'assistance");
  }
});

app.post("/news", async (req, res) => {
  const { title, date, description } = req.body;

  try {
    const result = await client.execute({
      sql: "INSERT INTO actualities (title, date, description) VALUES (?, ?, ?)",
      args: [title, date, description],
    });

    console.log("Actualité créée avec succès");
    res.status(201).json({ id: result.lastInsertId, title, date, description });
  } catch (err) {
    console.error("Erreur lors de la création de l'actualité :", err);
    res.status(500).send("Erreur lors de la création de l'actualité");
  }
});

app.patch("/news/:id", async (req, res) => {
  const { id } = req.params;
  const { title, date, description } = req.body;

  try {
    const result = await client.execute({
      sql: "UPDATE actualities SET title = ?, date = ?, description = ? WHERE id = ?",
      args: [title, date, description, id],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Actualité non trouvée");
    }

    console.log("Actualité mise à jour avec succès");
    res.status(200).send("Actualité mise à jour avec succès");
  } catch (err) {
    console.error("Erreur lors de la mise à jour de l'actualité :", err);
    res.status(500).send("Erreur lors de la mise à jour de l'actualité");
  }
});


// Endpoint pour supprimer un événement passé
app.delete("/news/:id", async (req, res) => {
  const eventId = req.params.id;

  try {
    const result = await client.execute({
      sql: "DELETE FROM actualities WHERE id = ?",
      args: [eventId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Actualité non trouvée");
    }

    console.log("Actualité supprimée avec succès");
    res.status(200).send("Actualité supprimée avec succès");
  } catch (err) {
    console.error("Erreur lors de la suppression de l'actualité :", err);
    res.status(500).send("Erreur lors de la suppression de l'actualité");
  }
});


// Endpoint pour créer un événement à venir
app.post("/upcoming-events", async (req, res) => {
  const { title, date, description } = req.body;

  try {
    const result = await client.execute({
      sql: "INSERT INTO upcoming_events (title, date, description) VALUES (?, ?, ?)",
      args: [title, date, description],
    });

    console.log("Événement à venir créé avec succès");
    res.status(201).json({ id: result.lastInsertId, title, date, description });
  } catch (err) {
    console.error("Erreur lors de la création de l'événement à venir :", err);
    res.status(500).send("Erreur lors de la création de l'événement à venir");
  }
});


// Endpoint pour supprimer un événement à venir
app.delete("/upcoming-events/:id", async (req, res) => {
  const eventId = req.params.id;

  try {
    const result = await client.execute({
      sql: "DELETE FROM upcoming_events WHERE id = ?",
      args: [eventId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).send("Événement à venir non trouvé");
    }

    console.log("Événement à venir supprimé avec succès");
    res.status(200).send("Événement à venir supprimé avec succès");
  } catch (err) {
    console.error("Erreur lors de la suppression de l'événement à venir :", err);
    res.status(500).send("Erreur lors de la suppression de l'événement à venir");
  }
});


app.get("/latest-news", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM actualities");

    if (result.rows.length === 0) {
      return res.status(404).send("Aucune actualité trouvée");
    }

    console.log("Dernières actualités récupérées avec succès");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des dernières actualités :", err);
    res.status(500).send("Erreur lors de la récupération des dernières actualités");
  }
});


app.get("/upcoming-events", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM upcoming_events");

    if (result.rows.length === 0) {
      return res.status(404).send("Aucun événement à venir trouvé");
    }

    console.log("Événements à venir récupérés avec succès");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des événements à venir :", err);
    res.status(500).send("Erreur lors de la récupération des événements à venir");
  }
});


app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${port}`);
});