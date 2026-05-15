import DatabaseService from './services/DatabaseService.ts';
import AuthService from './services/AuthService.ts';

const username = process.env.INIT_USER || 'admin';
const password = process.env.INIT_PASS || 'changeme';
const email = `${username}@localhost`;

await DatabaseService.initialize();

try {
    const user = await AuthService.register(username, email, password, true);
    console.log(`Admin créé : ${user.username} (id=${user.id})`);
} catch (e: any) {
    if (e.message.includes('already exists')) {
        console.log(`L'utilisateur "${username}" existe déjà, rien à faire.`);
    } else {
        console.error('Erreur :', e.message);
        process.exit(1);
    }
}

await DatabaseService.close();
