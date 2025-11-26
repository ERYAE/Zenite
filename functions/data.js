const { Client } = require('pg');
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    // Verificar Token
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: "Token ausente" };
    const token = authHeader.split(' ')[1];

    let userId;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch (e) {
        return { statusCode: 403, body: "Token inválido" };
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        if (event.httpMethod === 'POST') {
            // SALVAR DADOS
            const { data } = JSON.parse(event.body);
            await client.query('UPDATE users SET data = $1 WHERE id = $2', [data, userId]);
            return { statusCode: 200, body: JSON.stringify({ message: "Salvo com sucesso" }) };
        } 
        
        if (event.httpMethod === 'GET') {
            // CARREGAR DADOS
            const res = await client.query('SELECT data FROM users WHERE id = $1', [userId]);
            return { statusCode: 200, body: JSON.stringify(res.rows[0].data) };
        }

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        await client.end();
    }
};