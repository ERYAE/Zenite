const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    try {
        await client.connect();
        // Na Vercel, pegamos os dados do req.body
        const { action, username, password, recovery_key, new_password } = req.body;

        if (action === 'register') {
            if (!username || !password || !recovery_key) {
                return res.status(400).json({ error: "Preencha todos os campos." });
            }
            const hash = await bcrypt.hash(password, 10);
            const keyHash = await bcrypt.hash(recovery_key, 10);

            try {
                await client.query(
                    'INSERT INTO users (username, password_hash, recovery_key, data) VALUES ($1, $2, $3, $4) RETURNING id',
                    [username, hash, keyHash, '{}']
                );
                return res.status(200).json({ message: "Usuário criado!" });
            } catch (err) {
                if(err.code === '23505') return res.status(400).json({ error: "Usuário já existe." });
                throw err;
            }
        }

        if (action === 'login') {
            const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado." });

            const user = result.rows[0];
            const valid = await bcrypt.compare(password, user.password_hash);
            
            if (!valid) return res.status(401).json({ error: "Senha incorreta." });

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            return res.status(200).json({ token, data: user.data });
        }

        if (action === 'reset') {
            const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length === 0) return res.status(404).json({ error: "Usuário não existe." });
            
            const user = result.rows[0];
            if (!user.recovery_key) return res.status(400).json({ error: "Sem chave de recuperação." });
            
            const validKey = await bcrypt.compare(recovery_key, user.recovery_key);
            if (!validKey) return res.status(403).json({ error: "Palavra-chave incorreta." });

            const newHash = await bcrypt.hash(new_password, 10);
            await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);

            return res.status(200).json({ message: "Senha alterada!" });
        }

        return res.status(400).json({ error: "Ação inválida" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
};
