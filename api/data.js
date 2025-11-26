const { Client } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send("Token ausente");
    const token = authHeader.split(' ')[1];

    let userId;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch (e) {
        return res.status(403).send("Token inválido");
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        if (req.method === 'POST') {
            const { data } = req.body;
            await client.query('UPDATE users SET data = $1 WHERE id = $2', [data, userId]);
            return res.status(200).json({ message: "Salvo com sucesso" });
        } 
        
        if (req.method === 'GET') {
            const result = await client.query('SELECT data FROM users WHERE id = $1', [userId]);
            return res.status(200).json(result.rows[0].data);
        }

        return res.status(405).send("Método não permitido");

    } catch (error) {
        return res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
};
