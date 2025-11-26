const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        const { action, username, password, recovery_key, new_password } = JSON.parse(event.body);

        // --- REGISTRO COM CHAVE DE RECUPERAÇÃO ---
        if (action === 'register') {
            if (!username || !password || !recovery_key) {
                return { statusCode: 400, body: JSON.stringify({ error: "Preencha usuário, senha e palavra-chave." }) };
            }
            const hash = await bcrypt.hash(password, 10);
            // Hasheamos também a chave de recuperação para segurança
            const keyHash = await bcrypt.hash(recovery_key, 10);

            try {
                await client.query(
                    'INSERT INTO users (username, password_hash, recovery_key, data) VALUES ($1, $2, $3, $4) RETURNING id',
                    [username, hash, keyHash, '{}']
                );
                return { statusCode: 200, body: JSON.stringify({ message: "Usuário criado!" }) };
            } catch (err) {
                if(err.code === '23505') return { statusCode: 400, body: JSON.stringify({ error: "Usuário já existe." }) };
                throw err;
            }
        }

        // --- LOGIN ---
        if (action === 'login') {
            const res = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (res.rows.length === 0) return { statusCode: 401, body: JSON.stringify({ error: "Usuário não encontrado." }) };

            const user = res.rows[0];
            const valid = await bcrypt.compare(password, user.password_hash);
            
            if (!valid) return { statusCode: 401, body: JSON.stringify({ error: "Senha incorreta." }) };

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            return { statusCode: 200, body: JSON.stringify({ token, data: user.data }) };
        }

        // --- RECUPERAR SENHA (RESET) ---
        if (action === 'reset') {
            if (!username || !recovery_key || !new_password) {
                return { statusCode: 400, body: JSON.stringify({ error: "Dados incompletos." }) };
            }

            const res = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (res.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Usuário não existe." }) };
            
            const user = res.rows[0];

            // Verifica se a chave de recuperação bate
            if (!user.recovery_key) return { statusCode: 400, body: JSON.stringify({ error: "Este usuário não tem chave configurada." }) };
            
            const validKey = await bcrypt.compare(recovery_key, user.recovery_key);
            if (!validKey) return { statusCode: 403, body: JSON.stringify({ error: "Palavra-chave incorreta." }) };

            // Atualiza a senha
            const newHash = await bcrypt.hash(new_password, 10);
            await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);

            return { statusCode: 200, body: JSON.stringify({ message: "Senha alterada com sucesso!" }) };
        }

        return { statusCode: 400, body: "Ação inválida" };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        await client.end();
    }
};
