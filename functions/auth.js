const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        const { action, username, password } = JSON.parse(event.body);

        if (action === 'register') {
            const hash = await bcrypt.hash(password, 10);
            try {
                // Cria usuário com dados vazios
                const res = await client.query(
                    'INSERT INTO users (username, password_hash, data) VALUES ($1, $2, $3) RETURNING id',
                    [username, hash, '{}']
                );
                return { statusCode: 200, body: JSON.stringify({ message: "Usuário criado!" }) };
            } catch (err) {
                if(err.code === '23505') return { statusCode: 400, body: JSON.stringify({ error: "Usuário já existe." }) };
                throw err;
            }
        }

        if (action === 'login') {
            const res = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (res.rows.length === 0) return { statusCode: 401, body: JSON.stringify({ error: "Usuário não encontrado." }) };

            const user = res.rows[0];
            const valid = await bcrypt.compare(password, user.password_hash);
            
            if (!valid) return { statusCode: 401, body: JSON.stringify({ error: "Senha incorreta." }) };

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            return { statusCode: 200, body: JSON.stringify({ token, data: user.data }) };
        }

        return { statusCode: 400, body: "Ação inválida" };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        await client.end();
    }
};