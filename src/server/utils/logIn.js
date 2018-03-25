/**
 * React Starter Kit for Firebase
 * https://github.com/kriasoft/react-firebase-starter
 * Copyright (c) 2015-present Kriasoft | MIT License
 */

/* @flow */

import idx from 'idx';
import db from '../db';

export function generateUsername() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 10; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

export default async function logIn(req, profile, credentials) {
  const identityKeys = {
    'user_identities.provider': profile.provider,
    'user_identities.id': profile.id,
  };

  const email = idx(profile, x => x.emails[0].value);
  const photo = idx(profile, x => x.photos[0].value);

  let user = await db
    .table('user_identities')
    .leftJoin('users', 'users.id', 'user_identities.user_id')
    .where(identityKeys)
    .select('users.*')
    .first();

  if (user) {
    await Promise.all([
      db
        .table('user_identities')
        .where(identityKeys)
        .update({
          credentials: JSON.stringify(credentials),
          profile: JSON.stringify(profile._json),
          updated_at: db.fn.now(),
        }),
      db
        .table('users')
        .where({ id: user.id })
        .update({ last_signin_at: db.fn.now() }),
    ]);
  } else {
    user = await db
      .table('users')
      .where(email ? { email } : db.raw('false'))
      .first();

    if (!user) {
      [user] = await db
        .table('users')
        .insert({
          email,
          username: profile.username || generateUsername(),
          display_name: profile.displayName,
          photo_url: photo,
        })
        .returning('*');
    }

    await db.table('user_identities').insert({
      user_id: user.id,
      provider: profile.provider,
      id: profile.id,
      profile: JSON.stringify(profile._json),
      credentials: JSON.stringify(credentials),
    });
  }

  return user;
}
