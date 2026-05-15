#!/usr/bin/env ts-node

/**
 * Script d'initialisation - Création du premier utilisateur admin
 * 
 * Usage:
 *   npm run init-admin
 *   
 * ou:
 *   ts-node scripts/init-admin.ts
 */

import DatabaseService from './services/DatabaseService.ts';
import AuthService from './services/AuthService.ts';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createFirstAdmin() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Anime Downloader - Initialisation Admin              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    console.log('Initialisation de la base de données...');
    await DatabaseService.initialize();
    console.log('Base de données prête\n');


    const users = await AuthService.getAllUsers();
    
    if (users.length > 0) {
      console.log('Des utilisateurs existent déjà dans la base de données:');
      users.forEach(u => {
        console.log(`   - ${u.username} (${u.email}) ${u.is_admin ? '[ADMIN]' : ''}`);
      });
      console.log('');
      
      const confirm = await question('Voulez-vous quand même créer un nouvel admin ? (oui/non): ');
      if (confirm.toLowerCase() !== 'oui') {
        console.log('\nOpération annulée');
        rl.close();
        process.exit(0);
      }
      console.log('');
    }

    console.log('Veuillez entrer les informations du compte admin:\n');
    
    const username = await question('Nom d\'utilisateur: ');
    if (!username || username.trim().length < 3) {
      console.error('\nLe nom d\'utilisateur doit contenir au moins 3 caractères');
      rl.close();
      process.exit(1);
    }

    const email = await question('Email: ');
    if (!email || !email.includes('@')) {
      console.error('\nEmail invalide');
      rl.close();
      process.exit(1);
    }

    const password = await question('Mot de passe (min. 6 caractères): ');
    if (!password || password.length < 6) {
      console.error('\nLe mot de passe doit contenir au moins 6 caractères');
      rl.close();
      process.exit(1);
    }

    const confirmPassword = await question('Confirmer le mot de passe: ');
    if (password !== confirmPassword) {
      console.error('\nLes mots de passe ne correspondent pas');
      rl.close();
      process.exit(1);
    }

    console.log('\nCréation de l\'administrateur...');

    const user = await AuthService.register(username, email, password, true);

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║            Administrateur créé avec succès!            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log('Informations du compte:');
    console.log(`   • ID:              ${user.id}`);
    console.log(`   • Nom d'utilisateur: ${user.username}`);
    console.log(`   • Email:           ${user.email}`);
    console.log(`   • Admin:           Oui ✓`);
    console.log(`   • Créé le:         ${new Date(user.created_at).toLocaleString('fr-FR')}`);
    console.log('');
    console.log('Vous pouvez maintenant vous connecter avec ces identifiants!');
    console.log('');

  } catch (error: any) {
    console.error('\nErreur lors de la création:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\nConseil: Utilisez un nom d\'utilisateur ou email différent');
    }
    
    rl.close();
    process.exit(1);
  }

  rl.close();
  await DatabaseService.close();
  process.exit(0);
}

createFirstAdmin().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});